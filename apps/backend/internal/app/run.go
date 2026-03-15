package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/orchestra/orchestra/apps/backend/internal/agents"
	"github.com/orchestra/orchestra/apps/backend/internal/api"
	"github.com/orchestra/orchestra/apps/backend/internal/config"
	"github.com/orchestra/orchestra/apps/backend/internal/db"
	"github.com/orchestra/orchestra/apps/backend/internal/logfile"
	"github.com/orchestra/orchestra/apps/backend/internal/mcp"
	"github.com/orchestra/orchestra/apps/backend/internal/observability"
	"github.com/orchestra/orchestra/apps/backend/internal/orchestrator"
	"github.com/orchestra/orchestra/apps/backend/internal/prompt"
	"github.com/orchestra/orchestra/apps/backend/internal/runtime"
	"github.com/orchestra/orchestra/apps/backend/internal/telemetry"
	"github.com/orchestra/orchestra/apps/backend/internal/terminal"
	"github.com/orchestra/orchestra/apps/backend/internal/tools"
	"github.com/orchestra/orchestra/apps/backend/internal/tracker"
	trackergithub "github.com/orchestra/orchestra/apps/backend/internal/tracker/github"
	ghutil "github.com/orchestra/orchestra/apps/backend/internal/utils/github"
	"github.com/orchestra/orchestra/apps/backend/internal/tracker/memory"
	trackersqlite "github.com/orchestra/orchestra/apps/backend/internal/tracker/sqlite"
	"github.com/orchestra/orchestra/apps/backend/internal/workspace"
	"github.com/rs/zerolog"
)

func Run(logger zerolog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	if cfg.APIToken == "" && runtime.HostRequiresToken(cfg.Host) {
		return fmt.Errorf("non-loopback host %q requires ORCHESTRA_API_TOKEN", cfg.Host)
	}

	addr := cfg.Host + ":" + cfg.PortString()

	dbPath := filepath.Join(cfg.WorkspaceRoot, ".orchestra", "warehouse.db")
	warehouseDB, err := db.Connect(dbPath)
	if err != nil {
		return fmt.Errorf("connect to warehouse db: %w", err)
	}

	orchestratorService := orchestrator.NewService()
	orchestratorService.SetDB(warehouseDB)
	if err := orchestratorService.RestoreStateFromDB(context.Background()); err != nil {
		logger.Warn().Err(err).Msg("failed to restore orchestrator state from DB")
	}

	orchestratorService.SetStateSets(cfg.ActiveStates, cfg.TerminalStates)
	orchestratorService.SetMaxConcurrent(cfg.MaxConcurrent)
	orchestratorService.SetMaxConcurrentByState(cfg.MaxConcurrentByState)

	trackerClient := newTrackerClient(cfg, warehouseDB)
	orchestratorService.SetTrackerClient(trackerClient)
	pubsub := observability.NewPubSub()
	termManager := terminal.NewManager()

	agentRegistry := agents.NewRegistryWithTerminal(cfg.AgentCommands, termManager)
	provider := agents.Provider(cfg.AgentProvider)
	if !agentRegistry.HasProvider(provider) {
		return fmt.Errorf("agent provider %q is not configured", cfg.AgentProvider)
	}
	orchestratorService.SetAgentRegistry(agentRegistry, cfg.AgentCommands, cfg.AgentProvider)

	workspaceService := workspace.Service{Root: cfg.WorkspaceRoot}
	orchestratorService.SetWorkspaceService(workspaceService)
	orchestratorService.SetWorkspaceRoot(cfg.WorkspaceRoot)

	// Initialize MCP (Merge Config + DB)
	allMCPServers := make(map[string]string)
	for k, v := range cfg.MCPServers {
		allMCPServers[k] = v
	}
	if dbServers, err := warehouseDB.ListMCPServers(context.Background()); err == nil {
		for _, s := range dbServers {
			allMCPServers[s.Name] = s.Command
		}
	}

	mcpRegistry := mcp.NewRegistry(allMCPServers, logger)
	mcpRegistry.StartAll(context.Background())
	orchestratorService.SetMCPRegistry(mcpRegistry, allMCPServers)

	logger.Info().Str("agent_provider", cfg.AgentProvider).Str("service_id", runtime.ServiceOrchestrator).Msg("agent provider configured")

	router := api.NewRouterWithPubSub(logger, orchestratorService, &cfg, pubsub, warehouseDB, termManager)

	cleanupTerminalWorkspaces(orchestratorService, trackerClient, workspaceService, cfg.WorkspaceHooks, logger)

	go startGarbageCollector(orchestratorService, warehouseDB, cfg.WorkspaceRoot, cfg.TelemetryRetentionDays, logger)
	go startRefreshWorker(orchestratorService, pubsub, logger)
	go telemetry.StartWatcher(context.Background(), warehouseDB, cfg.ProjectRoots, telemetry.Options{
		Providers:       cfg.TelemetryProviders,
		StoreRawPayload: cfg.TelemetryStoreRawPayload,
	}, logger)

	toolExecutor := tools.NewLinearToolExecutor(trackerClient)
	go startExecutionWorker(orchestratorService, agentRegistry, provider, cfg.AgentProvider, cfg.WorkspaceRoot, cfg.WorkflowFile, cfg.AgentMaxTurns, toolExecutor.Execute, tools.TrackerToolSpecs(), cfg.WorkspaceHooks, pubsub, warehouseDB, logger)

	logger.Info().Str("addr", addr).Str("service_id", runtime.ServiceOrchestrator).Msg("starting orchestrad")

	// Use a custom listener with SO_REUSEADDR so the port is available immediately after restart.
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}

	server := &http.Server{Handler: router}

	// Graceful shutdown on SIGTERM/SIGINT so the TUI can restart cleanly.
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGTERM, syscall.SIGINT)
		<-sig
		logger.Info().Msg("shutting down orchestrad")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	}()

	if err := server.Serve(ln); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("serve: %w", err)
	}

	return nil
}

func newTrackerClient(cfg config.Config, localDB *db.DB) tracker.Client {
	if strings.ToLower(cfg.TrackerType) == "github" {
		// For GitHub, Endpoint is owner/repo
		parts := strings.Split(cfg.TrackerEndpoint, "/")
		if len(parts) == 2 {
			return trackergithub.NewClient(parts[0], parts[1], cfg.TrackerToken, nil)
		}
	}
	if localDB == nil {
		return memory.NewClient(nil)
	}
	return trackersqlite.NewClient(localDB, cfg.TrackerWorkerAssigneeIDs)
}

func startExecutionWorker(
	service *orchestrator.Service,
	registry *agents.Registry,
	provider agents.Provider,
	providerName string,
	workspaceRoot string,
	workflowFile string,
	agentMaxTurns int,
	toolExecutor agents.ToolExecutor,
	toolSpecs []map[string]any,
	workspaceHooks workspace.Hooks,
	pubsub *observability.PubSub,
	warehouseDB *db.DB,
	logger zerolog.Logger,
) {
	workspaceService := workspace.Service{Root: workspaceRoot}
	ticker := time.NewTicker(300 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		processExecutionTick(service, workspaceService, registry, provider, providerName, workspaceRoot, workflowFile, agentMaxTurns, toolExecutor, toolSpecs, workspaceHooks, pubsub, warehouseDB, logger)
	}
}

func processExecutionTick(
	service *orchestrator.Service,
	workspaceService workspace.Service,
	registry *agents.Registry,
	provider agents.Provider,
	providerName string,
	workspaceRoot string,
	workflowFile string,
	agentMaxTurns int,
	toolExecutor agents.ToolExecutor,
	toolSpecs []map[string]any,
	workspaceHooks workspace.Hooks,
	pubsub *observability.PubSub,
	warehouseDB *db.DB,
	logger zerolog.Logger,
) {
	entry, ok := service.ClaimNextRunnable()
	if !ok {
		return
	}

	shouldDispatch, revalidateErr := service.RevalidateClaimedIssue(context.Background(), entry.IssueID)
	if revalidateErr != nil {
		service.ReleaseClaim(entry.IssueID)
		logger.Warn().Err(revalidateErr).Str("issue_id", entry.IssueID).Msg("issue revalidation failed; skipping dispatch")
		publishSnapshot(pubsub, service)
		return
	}
	if !shouldDispatch {
		logger.Info().Str("issue_id", entry.IssueID).Msg("issue no longer dispatchable after revalidation")
		publishSnapshot(pubsub, service)
		return
	}

	// Backfill title/description/project from tracker if missing (e.g. retry path creates entries without these fields)
	if entry.Title == "" || entry.Description == "" || entry.ProjectID == "" {
		issue, fetchErr := service.FetchIssueByID(context.Background(), entry.IssueID)
		if fetchErr == nil && issue != nil {
			if entry.Title == "" {
				entry.Title = issue.Title
			}
			if entry.Description == "" {
				entry.Description = issue.Description
			}
			if entry.ProjectID == "" {
				entry.ProjectID = issue.ProjectID
			}
		}
	}

	// Resolve provider from entry or configuration
	activeProvider := provider
	activeProviderName := providerName

	if entry.Provider != "" {
		candidate := agents.Provider(strings.ToLower(entry.Provider))
		if registry.HasProvider(candidate) {
			activeProvider = candidate
			activeProviderName = string(candidate)
		}
	} else if entry.AssigneeID != "" {
		// Fallback: Resolve provider from assignee if possible
		p := strings.TrimPrefix(entry.AssigneeID, "agent-")
		candidate := agents.Provider(strings.ToLower(p))
		if registry.HasProvider(candidate) {
			activeProvider = candidate
			activeProviderName = string(candidate)
		}
	}

	// If the task belongs to a project, use the project's root_path as the workspace
	// so the agent operates on the actual codebase, not an empty temp directory.
	var workspacePath string
	var effectiveWorkspaceRoot string
	var created bool
	var createRes workspace.HookResult
	var err error
	var resolvedProject db.Project
	if entry.ProjectID != "" && warehouseDB != nil {
		project, projErr := warehouseDB.GetProjectByID(context.Background(), entry.ProjectID)
		resolvedProject = project
		if projErr != nil {
			logger.Warn().Err(projErr).Str("issue_id", entry.IssueID).Str("project_id", entry.ProjectID).Msg("failed to lookup project for workspace")
		} else if project.RootPath == "" || !filepath.IsAbs(project.RootPath) {
			logger.Warn().Str("issue_id", entry.IssueID).Str("root_path", project.RootPath).Msg("project root path is empty or not absolute")
		} else if info, statErr := os.Stat(project.RootPath); statErr != nil || !info.IsDir() {
			logger.Warn().Str("issue_id", entry.IssueID).Str("root_path", project.RootPath).Msg("project root path does not exist or is not a directory")
		} else {
			workspacePath = project.RootPath
			effectiveWorkspaceRoot = filepath.Dir(project.RootPath)
			logger.Info().Str("issue_id", entry.IssueID).Str("project_path", workspacePath).Msg("using project root as workspace")
		}
	} else {
		logger.Info().Str("issue_id", entry.IssueID).Str("project_id", entry.ProjectID).Bool("db_nil", warehouseDB == nil).Msg("skipping project workspace lookup")
	}
	if effectiveWorkspaceRoot == "" {
		effectiveWorkspaceRoot = workspaceRoot
	}

	if workspacePath == "" {
		// Fallback to the generated workspace if no project path available
		publishLifecycleEvent(pubsub, "hook_started", map[string]any{"issue_id": entry.IssueID, "issue_identifier": entry.IssueIdentifier, "hook_type": "after_create"})
		var ensureErr error
		workspacePath, created, createRes, ensureErr = workspaceService.EnsureIssueWorkspace(entry.IssueIdentifier, activeProviderName, workspaceHooks)
		if ensureErr != nil {
			err = ensureErr
		}
	} else {
		publishLifecycleEvent(pubsub, "hook_started", map[string]any{"issue_id": entry.IssueID, "issue_identifier": entry.IssueIdentifier, "hook_type": "after_create"})
		publishLifecycleEvent(pubsub, "hook_completed", map[string]any{"issue_id": entry.IssueID, "issue_identifier": entry.IssueIdentifier, "hook_type": "after_create", "reused": true})
	}
	if err != nil {
		publishLifecycleEvent(pubsub, "hook_failed", map[string]any{"issue_id": entry.IssueID, "issue_identifier": entry.IssueIdentifier, "hook_type": "after_create", "error": err.Error(), "output": createRes.Output})
		attempt := entry.TurnCount + 1
		dueAt := service.NextRetryDue(entry.IssueID, attempt)
		publishLifecycleEvent(pubsub, "run_failed", map[string]any{
			"issue_id":         entry.IssueID,
			"issue_identifier": entry.IssueIdentifier,
			"provider":         activeProviderName,
			"attempt":          attempt,
			"error":            err.Error(),
			"cause":            "workspace_prepare_failed",
		})
		if service.ShouldRetryAttempt(attempt) {
			publishLifecycleEvent(pubsub, "retry_scheduled", map[string]any{
				"issue_id":         entry.IssueID,
				"issue_identifier": entry.IssueIdentifier,
				"provider":         activeProviderName,
				"attempt":          attempt,
				"due_at":           dueAt.UTC().Format(time.RFC3339),
				"cause":            "workspace_prepare_failed",
			})
		}
		service.RecordRunFailure(entry.IssueID, activeProviderName, entry.IssueIdentifier, attempt, dueAt, err)
		logger.Error().Err(err).Str("issue_id", entry.IssueID).Str("provider", activeProviderName).Msg("workspace preparation failed")
		publishSnapshot(pubsub, service)
		return
	}
	if created {
		publishLifecycleEvent(pubsub, "hook_completed", map[string]any{"issue_id": entry.IssueID, "issue_identifier": entry.IssueIdentifier, "hook_type": "after_create", "output": createRes.Output})
	} else {
		// Even if not created, we mark it as completed since we "ensured" it exists
		publishLifecycleEvent(pubsub, "hook_completed", map[string]any{"issue_id": entry.IssueID, "issue_identifier": entry.IssueIdentifier, "hook_type": "after_create", "reused": true})
	}
	runAfterHook := func() {
		publishLifecycleEvent(pubsub, "hook_started", map[string]any{"issue_id": entry.IssueID, "issue_identifier": entry.IssueIdentifier, "hook_type": "after_run"})
		if res, err := workspaceService.RunAfterRunHook(workspacePath, workspaceHooks); err != nil {
			publishLifecycleEvent(pubsub, "hook_failed", map[string]any{"issue_id": entry.IssueID, "issue_identifier": entry.IssueIdentifier, "hook_type": "after_run", "error": err.Error(), "output": res.Output})
		} else {
			publishLifecycleEvent(pubsub, "hook_completed", map[string]any{"issue_id": entry.IssueID, "issue_identifier": entry.IssueIdentifier, "hook_type": "after_run", "output": res.Output})
		}
	}

	if entry.TurnCount == 0 {
		publishLifecycleEvent(pubsub, "hook_started", map[string]any{"issue_id": entry.IssueID, "issue_identifier": entry.IssueIdentifier, "hook_type": "before_run"})
		if res, err := workspaceService.RunBeforeRunHook(workspacePath, workspaceHooks); err != nil {
			publishLifecycleEvent(pubsub, "hook_failed", map[string]any{"issue_id": entry.IssueID, "issue_identifier": entry.IssueIdentifier, "hook_type": "before_run", "error": err.Error(), "output": res.Output})
			runAfterHook()
			attempt := entry.TurnCount + 1
			dueAt := service.NextRetryDue(entry.IssueID, attempt)
			publishLifecycleEvent(pubsub, "run_failed", map[string]any{
				"issue_id":         entry.IssueID,
				"issue_identifier": entry.IssueIdentifier,
				"provider":         activeProviderName,
				"attempt":          attempt,
				"error":            err.Error(),
				"cause":            "before_run_hook_failed",
			})
			if service.ShouldRetryAttempt(attempt) {
				publishLifecycleEvent(pubsub, "retry_scheduled", map[string]any{
					"issue_id":         entry.IssueID,
					"issue_identifier": entry.IssueIdentifier,
					"provider":         activeProviderName,
					"attempt":          attempt,
					"due_at":           dueAt.UTC().Format(time.RFC3339),
					"cause":            "before_run_hook_failed",
				})
			}
			service.RecordRunFailure(entry.IssueID, activeProviderName, entry.IssueIdentifier, attempt, dueAt, err)
			logger.Error().Err(err).Str("issue_id", entry.IssueID).Str("provider", activeProviderName).Msg("workspace before_run hook failed")
			publishSnapshot(pubsub, service)
			return
		}
		publishLifecycleEvent(pubsub, "hook_completed", map[string]any{"issue_id": entry.IssueID, "issue_identifier": entry.IssueIdentifier, "hook_type": "before_run"})
	}

	attempt := entry.TurnCount + 1
	publishLifecycleEvent(pubsub, "run_started", map[string]any{
		"issue_id":         entry.IssueID,
		"issue_identifier": entry.IssueIdentifier,
		"provider":         activeProviderName,
		"attempt":          attempt,
	})
	renderedPrompt, promptErr := prompt.Build(workflowFile, prompt.BuildInput{
		Issue:   tracker.Issue{ID: entry.IssueID, Identifier: entry.IssueIdentifier, Title: entry.Title, Description: entry.Description, State: entry.State},
		Attempt: attempt,
	})
	if promptErr != nil {
		logger.Warn().Err(promptErr).Str("issue_id", entry.IssueID).Msg("prompt build failed; using fallback prompt")
		renderedPrompt = buildExecutionPrompt(entry.IssueIdentifier, entry.Title, entry.Description, attempt)
	}

	// On subsequent turns, append prior turn context so agent knows what it already did
	if attempt > 1 && warehouseDB != nil {
		priorContext := buildPriorTurnContext(warehouseDB, entry.IssueID, entry.IssueIdentifier)
		if priorContext != "" {
			renderedPrompt += "\n\n" + priorContext
		}
	}

	runCtx, cancel := context.WithCancel(context.Background())
	defer cancel()
	service.RegisterCancel(entry.IssueID, activeProviderName, cancel)
	defer service.DeregisterCancel(entry.IssueID, activeProviderName)

	var eventsBuffer []agents.Event

	// Fetch MCP tools and resources
	allToolSpecs := make([]map[string]any, 0, len(toolSpecs))
	disabledSet := make(map[string]struct{})
	// Fetch issue to get disabled tools if using SQLite or memory tracker
	// For now, assume trackerClient has populated DisabledTools if applicable
	for _, dt := range entry.DisabledTools {
		disabledSet[strings.ToLower(dt)] = struct{}{}
	}

	for _, ts := range toolSpecs {
		if name, ok := ts["name"].(string); ok {
			if _, disabled := disabledSet[strings.ToLower(name)]; !disabled {
				allToolSpecs = append(allToolSpecs, ts)
			}
		}
	}

	var allResourceSpecs []map[string]any

	if mcpReg := service.GetMCPRegistry(); mcpReg != nil {
		mcpTools, _ := mcpReg.ListTools(runCtx)
		for _, mt := range mcpTools {
			if name, ok := mt["name"].(string); ok {
				if _, disabled := disabledSet[strings.ToLower(name)]; !disabled {
					allToolSpecs = append(allToolSpecs, mt)
				}
			}
		}

		mcpResources, _ := mcpReg.ListResources(runCtx)
		allResourceSpecs = append(allResourceSpecs, mcpResources...)
	}

	// Create a tool executor that can route to MCP
	mcpAwareExecutor := func(tool string, args map[string]any) map[string]any {
		// Check if it's an MCP tool (prefixed with server name)
		if mcpReg := service.GetMCPRegistry(); mcpReg != nil {
			if strings.Contains(tool, "_") {
				parts := strings.SplitN(tool, "_", 2)
				serverName := parts[0]
				toolName := parts[1]
				res, err := mcpReg.ExecuteTool(context.Background(), serverName, toolName, args)
				if err == nil {
					return res
				}
			}
		}
		return toolExecutor(tool, args)
	}

	sessionID := fmt.Sprintf("%s-%d", entry.IssueIdentifier, time.Now().UnixNano())
	_ = logfile.ResetLatestLog(workspaceRoot, entry.IssueIdentifier, sessionID)
	sessionLogPath := filepath.Join(workspaceRoot, "_logs", logfile.Sanitize(entry.IssueIdentifier), "latest.log")
	service.RecordRunArtifact(entry.IssueID, activeProviderName, sessionID, sessionLogPath)

	if warehouseDB != nil {
		// Link session to the task's project — never create new projects from the execution worker
		_ = warehouseDB.RecordSession(context.Background(), sessionID, entry.ProjectID, entry.IssueID, sessionID, activeProviderName, "main")
	}

	result, runErr := registry.RunTurn(runCtx, activeProvider, agents.TurnRequest{
		SessionID:       sessionID,
		Workspace:       workspacePath,
		WorkspaceRoot:   effectiveWorkspaceRoot,
		Prompt:          renderedPrompt,
		IssueIdentifier: entry.IssueIdentifier,
		Attempt:         int(attempt),
		Timeout:         30 * time.Minute,
		AutoApprove:     true,
		ToolExecutor:    mcpAwareExecutor,
		ToolSpecs:       allToolSpecs,
		ResourceSpecs:   allResourceSpecs,
	}, func(event agents.Event) {
		service.RecordRunEvent(entry.IssueID, activeProviderName, event)
		publishRunEvent(pubsub, entry, activeProviderName, event)
		eventsBuffer = append(eventsBuffer, event)

		// Persist to database in real-time
		if warehouseDB != nil && event.SessionID != "" {
			// Skip recording PTY echo noise (echoed prompts, shell decorations)
			if event.Kind == "pty" && (event.Message == "" || len(event.Message) < 5) {
				// skip
			} else if event.Kind == "pty" && (strings.Contains(event.Message, "## Instructions") || strings.Contains(event.Message, "## Task") || strings.Contains(event.Message, "step one")) {
				// skip PTY events that are just the echoed prompt
			} else {
				eventID := uuid.New().String()
				raw, _ := json.Marshal(event.Raw)
				_ = warehouseDB.RecordEvent(context.Background(), eventID, event.SessionID, event.Kind, event.Message, raw, int(event.Usage.InputTokens), int(event.Usage.OutputTokens), event.Timestamp.Format(time.RFC3339))
			}
		}

		// Append to log file in real-time
		if event.SessionID != "" && event.RawLine != "" {
			_, _ = logfile.AppendToSessionLog(workspaceRoot, entry.IssueIdentifier, event.SessionID, event.RawLine+"\n")
		}

		// Log to stdout for TUI visibility
		if event.Message != "" {
			logger.Info().
				Str("issue", entry.IssueIdentifier).
				Str("provider", activeProviderName).
				Str("kind", event.Kind).
				Msg(event.Message)
		}
	})

	if runErr != nil {
		runAfterHook()
		dueAt := service.NextRetryDue(entry.IssueID, attempt)
		publishLifecycleEvent(pubsub, "run_failed", map[string]any{
			"issue_id":         entry.IssueID,
			"issue_identifier": entry.IssueIdentifier,
			"provider":         activeProviderName,
			"attempt":          attempt,
			"error":            runErr.Error(),
			"cause":            "agent_run_failed",
		})
		if service.ShouldRetryAttempt(attempt) {
			publishLifecycleEvent(pubsub, "retry_scheduled", map[string]any{
				"issue_id":         entry.IssueID,
				"issue_identifier": entry.IssueIdentifier,
				"provider":         activeProviderName,
				"attempt":          attempt,
				"due_at":           dueAt.UTC().Format(time.RFC3339),
				"cause":            "agent_run_failed",
			})
		}
		service.RecordRunFailure(entry.IssueID, activeProviderName, entry.IssueIdentifier, attempt, dueAt, runErr)
		logger.Error().Err(runErr).Str("issue_id", entry.IssueID).Str("provider", activeProviderName).Msg("agent run failed")
		publishSnapshot(pubsub, service)
		return
	}

	service.RecordRunResult(entry.IssueID, activeProviderName, result.SessionID, result.Usage.InputTokens, result.Usage.OutputTokens, result.Usage.TotalTokens)

	continueTurn, checkErr := service.ShouldContinueTurn(context.Background(), entry.IssueID, activeProviderName, attempt, agentMaxTurns)
	if checkErr != nil {
		runAfterHook()
		dueAt := service.NextRetryDue(entry.IssueID, attempt)
		publishLifecycleEvent(pubsub, "run_failed", map[string]any{
			"issue_id":         entry.IssueID,
			"issue_identifier": entry.IssueIdentifier,
			"provider":         providerName,
			"attempt":          attempt,
			"error":            checkErr.Error(),
			"cause":            "continuation_check_failed",
		})
		if service.ShouldRetryAttempt(attempt) {
			publishLifecycleEvent(pubsub, "retry_scheduled", map[string]any{
				"issue_id":         entry.IssueID,
				"issue_identifier": entry.IssueIdentifier,
				"provider":         providerName,
				"attempt":          attempt,
				"due_at":           dueAt.UTC().Format(time.RFC3339),
				"cause":            "continuation_check_failed",
			})
		}
		service.RecordRunFailure(entry.IssueID, activeProviderName, entry.IssueIdentifier, attempt, dueAt, checkErr)
		logger.Error().Err(checkErr).Str("issue_id", entry.IssueID).Msg("failed to check turn continuation")
		publishSnapshot(pubsub, service)
		return
	}

	if continueTurn {
		service.PrepareNextTurn(entry.IssueID, activeProviderName, attempt)
		publishLifecycleEvent(pubsub, "run_continues", map[string]any{
			"issue_id":         entry.IssueID,
			"issue_identifier": entry.IssueIdentifier,
			"provider":         providerName,
			"attempt":          attempt,
			"session_id":       result.SessionID,
		})
		logger.Info().Str("issue_id", entry.IssueID).Str("session_id", result.SessionID).Int64("attempt", attempt).Msg("turn completed; continuing")
		publishSnapshot(pubsub, service)
		return
	}

	service.RecordRunSuccess(entry.IssueID, activeProviderName)

	// Move issue to Review on successful completion
	if _, err := service.UpdateIssue(context.Background(), entry.IssueIdentifier, map[string]any{"state": "Review"}); err != nil {
		logger.Warn().Err(err).Str("issue_id", entry.IssueID).Msg("failed to set issue to Review after success")
	}

	publishLifecycleEvent(pubsub, "run_succeeded", map[string]any{
		"issue_id":         entry.IssueID,
		"issue_identifier": entry.IssueIdentifier,
		"provider":         providerName,
		"attempt":          attempt,
		"session_id":       result.SessionID,
	})

	runAfterHook()

	// Post completion comment to GitHub issue if linked
	if entry.ProjectID != "" && warehouseDB != nil {
		// Extract the last substantive agent message for the summary
		agentSummary := ""
		for i := len(eventsBuffer) - 1; i >= 0; i-- {
			msg := strings.TrimSpace(eventsBuffer[i].Message)
			if msg != "" && len(msg) > 50 {
				agentSummary = msg
				break
			}
		}

		go func() {
			project := resolvedProject
			if project.GitHubOwner == "" || project.GitHubRepo == "" || project.GitHubToken == "" {
				return
			}
			issue, fetchErr := service.FetchIssueByID(context.Background(), entry.IssueID)
			if fetchErr != nil || issue == nil || issue.URL == "" {
				return
			}
			issueNumber := extractGitHubIssueNumber(issue.URL)
			if issueNumber <= 0 {
				return
			}

			comment := fmt.Sprintf("## %s Agent Run Completed\n\n", strings.ToUpper(activeProviderName))
			comment += fmt.Sprintf("**Issue**: %s\n**Agent**: %s\n**Turns**: %d\n\n", entry.IssueIdentifier, activeProviderName, entry.TurnCount+1)
			if agentSummary != "" {
				comment += "### Summary\n\n" + agentSummary + "\n"
			}
			comment += "\n---\n*Automatically posted by Orchestra*"

			if err := ghutil.PostIssueComment(context.Background(), project.GitHubOwner, project.GitHubRepo, project.GitHubToken, issueNumber, comment); err != nil {
				logger.Warn().Err(err).Str("issue_id", entry.IssueID).Msg("failed to post GitHub comment")
			} else {
				logger.Info().Str("issue_id", entry.IssueID).Int("github_issue", issueNumber).Msg("posted completion comment to GitHub")
			}
		}()
	}

	logger.Info().Str("issue_id", entry.IssueID).Str("session_id", result.SessionID).Msg("agent run completed — issue moved to Review")
	publishSnapshot(pubsub, service)
}

func buildExecutionPrompt(issueIdentifier string, title string, description string, attempt int64) string {
	prompt := fmt.Sprintf("You are an autonomous coding agent working on issue **%s**.\n\n## Task\n**%s**\n\n%s", issueIdentifier, title, description)
	prompt += "\n\n## Instructions\n\n1. Write an **Operational Plan** using markdown checkboxes (`- [ ]` pending, `- [x]` done).\n\n2. Work through each step. After completing a step, restate the plan with updated checkboxes.\n\n3. Use all available tools to implement changes.\n\n4. Verify your work compiles/passes. Do NOT stop until all items are checked off."
	prompt += fmt.Sprintf("\n\nAttempt: %d", attempt)
	return prompt
}

func buildPriorTurnContext(warehouseDB *db.DB, issueID string, issueIdentifier string) string {
	history, err := warehouseDB.GetUnifiedHistory(context.Background(), issueID)
	if err != nil || len(history) == 0 {
		return ""
	}

	var agentMessages []string
	for _, h := range history {
		kind, _ := h["kind"].(string)
		msg, _ := h["message"].(string)
		if msg == "" || len(msg) < 20 {
			continue
		}
		// Only include agent messages (not PTY noise, not state changes)
		if kind == "message" || kind == "agent_message" || kind == "item.completed" {
			agentMessages = append(agentMessages, msg)
		}
	}

	if len(agentMessages) == 0 {
		return ""
	}

	// Take the last few messages to keep context manageable
	maxMessages := 5
	if len(agentMessages) > maxMessages {
		agentMessages = agentMessages[len(agentMessages)-maxMessages:]
	}

	ctx := "## Prior Turn Context\n\nYou have already worked on this task in previous turns. Here is what you reported:\n\n"
	for _, msg := range agentMessages {
		// Truncate very long messages
		if len(msg) > 500 {
			msg = msg[:500] + "..."
		}
		ctx += "> " + strings.ReplaceAll(msg, "\n", "\n> ") + "\n\n"
	}
	ctx += "**Continue from where you left off. Do NOT restart from scratch. Check what files already exist before creating new ones.**\n"

	return ctx
}

func extractGitHubIssueNumber(url string) int {
	// Extract issue number from URL like https://github.com/owner/repo/issues/18
	parts := strings.Split(strings.TrimRight(url, "/"), "/")
	if len(parts) < 2 {
		return 0
	}
	if parts[len(parts)-2] != "issues" {
		return 0
	}
	n, err := strconv.Atoi(parts[len(parts)-1])
	if err != nil {
		return 0
	}
	return n
}

func cleanupTerminalWorkspaces(service *orchestrator.Service, trackerClient tracker.Client, workspaceService workspace.Service, hooks workspace.Hooks, logger zerolog.Logger) {
	if trackerClient == nil {
		return
	}
	terminalStates := service.TerminalStates()
	issues, err := trackerClient.FetchIssuesByStates(context.Background(), terminalStates)
	if err != nil {
		logger.Warn().Err(err).Msg("startup terminal workspace cleanup skipped")
		return
	}

	for _, issue := range issues {
		if err := workspaceService.RemoveIssueWorkspaces(issue.Identifier, "", hooks); err != nil {
			logger.Warn().Err(err).Str("issue_identifier", issue.Identifier).Msg("startup workspace cleanup failed")
		}
	}
}

func startGarbageCollector(service *orchestrator.Service, warehouseDB *db.DB, root string, retentionDays int, logger zerolog.Logger) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if retentionDays <= 0 {
				retentionDays = 7
			}
			// Prune old database events (keep 7 days)
			if warehouseDB != nil {
				affected, err := warehouseDB.PruneEvents(context.Background(), retentionDays)
				if err != nil {
					logger.Warn().Err(err).Msg("database pruning failed")
				} else if affected > 0 {
					logger.Info().Int64("count", affected).Msg("pruned old database events")
				}
			}

			active := service.GetActiveWorkspaceIdentifiers()
			activeSet := make(map[string]struct{})
			for _, id := range active {
				activeSet[id] = struct{}{}
			}

			entries, err := os.ReadDir(root)
			if err != nil {
				continue
			}

			for _, entry := range entries {
				if !entry.IsDir() {
					continue
				}
				name := entry.Name()
				if _, ok := activeSet[name]; ok {
					continue
				}

				// Check if it's an orchestra workspace (safety check)
				marker := filepath.Join(root, name, ".orchestra")
				if _, err := os.Stat(marker); os.IsNotExist(err) {
					continue
				}

				// Check age - don't delete brand new workspaces that might be initializing
				info, err := entry.Info()
				if err == nil && time.Since(info.ModTime()) < 2*time.Hour {
					continue
				}

				logger.Info().Str("workspace", name).Msg("cleaning up orphaned workspace")
				_ = os.RemoveAll(filepath.Join(root, name))
			}
		}
	}
}

func startRefreshWorker(service *orchestrator.Service, pubsub *observability.PubSub, logger zerolog.Logger) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	service.QueueRefresh()

	for range ticker.C {
		service.QueueRefresh()
		if !service.RefreshPending() {
			continue
		}
		before := service.Snapshot()

		if err := service.PerformRefresh(context.Background()); err != nil {
			logger.Error().Err(err).Str("service_id", runtime.ServiceOrchestrator).Msg("refresh worker failed")
			publishSnapshot(pubsub, service)
			continue
		}
		after := service.Snapshot()
		publishRefreshRetryLifecycleEvents(pubsub, before, after)
		publishSnapshot(pubsub, service)
		if err := service.PersistStateToDB(context.Background()); err != nil {
			logger.Warn().Err(err).Msg("failed to persist orchestrator state to DB")
		}
	}
}

func publishSnapshot(pubsub *observability.PubSub, service *orchestrator.Service) {
	if pubsub == nil || service == nil {
		return
	}
	pubsub.Publish(observability.Event{Type: "snapshot", Data: service.Snapshot()})
}

func publishLifecycleEvent(pubsub *observability.PubSub, eventType string, data map[string]any) {
	if pubsub == nil {
		return
	}
	if strings.TrimSpace(eventType) == "" {
		return
	}
	pubsub.Publish(observability.Event{Type: eventType, Data: data})
}

func publishRunEvent(pubsub *observability.PubSub, entry orchestrator.RunningEntry, providerName string, event agents.Event) {
	if pubsub == nil {
		return
	}

	pubsub.Publish(observability.Event{Type: "run_event", Data: map[string]any{
		"issue_id":         entry.IssueID,
		"issue_identifier": entry.IssueIdentifier,
		"provider":         providerName,
		"event":            event,
	}})
}

func publishRefreshRetryLifecycleEvents(pubsub *observability.PubSub, before orchestrator.Snapshot, after orchestrator.Snapshot) {
	if pubsub == nil {
		return
	}

	existing := map[string]struct{}{}
	for _, retry := range before.Retrying {
		existing[retryLifecycleKey(retry)] = struct{}{}
	}

	for _, retry := range after.Retrying {
		key := retryLifecycleKey(retry)
		if _, ok := existing[key]; ok {
			continue
		}
		publishLifecycleEvent(pubsub, "run_failed", map[string]any{
			"issue_id":         retry.IssueID,
			"issue_identifier": retry.IssueIdentifier,
			"attempt":          retry.Attempt,
			"error":            retry.Error,
			"source":           "refresh",
			"cause":            classifyRefreshRetryCause(retry.Error),
		})
		publishLifecycleEvent(pubsub, "retry_scheduled", map[string]any{
			"issue_id":         retry.IssueID,
			"issue_identifier": retry.IssueIdentifier,
			"attempt":          retry.Attempt,
			"due_at":           retry.DueAt,
			"source":           "refresh",
			"error":            retry.Error,
			"cause":            classifyRefreshRetryCause(retry.Error),
		})
	}
}

func retryLifecycleKey(entry orchestrator.RetryEntry) string {
	return strings.TrimSpace(entry.IssueID) + "|" + fmt.Sprintf("%d", entry.Attempt) + "|" + strings.TrimSpace(entry.Error)
}

func classifyRefreshRetryCause(message string) string {
	normalized := strings.ToLower(strings.TrimSpace(message))
	if strings.Contains(normalized, "stalled run exceeded timeout") || strings.Contains(normalized, "stalled") {
		return "stalled_timeout"
	}
	return "refresh_retry"
}
