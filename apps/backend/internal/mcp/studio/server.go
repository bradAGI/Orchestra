package studio

import (
	"context"
	"encoding/json"
	"fmt"
)

// ManagerAPI is the subset of studio.Manager the MCP server depends on.
type ManagerAPI interface {
	SetTitle(sessionID, title string) error
	SetDescription(sessionID, desc string) error
	AddAcceptanceCriterion(sessionID, criterion string) error
	RemoveAcceptanceCriterion(sessionID string, index int) error
	AttachFile(sessionID, path string) error
	AttachLink(sessionID, url, label string) error
	SetProvider(sessionID, provider string) error
	SetModel(sessionID, model string) error
	SetMaxTurns(sessionID string, turns int) error
	Push(ctx context.Context, sessionID string) (string, error)
	ApplyTemplate(sessionID, name string, vars map[string]string) error
}

type Server struct {
	mgr       ManagerAPI
	sessionID string
	tools     map[string]toolHandler
}

type toolHandler func(ctx context.Context, args json.RawMessage) (json.RawMessage, error)

func New(mgr ManagerAPI, sessionID string) *Server {
	s := &Server{mgr: mgr, sessionID: sessionID}
	s.tools = map[string]toolHandler{
		"set_title":                   s.handleSetTitle,
		"set_description":             s.handleSetDescription,
		"add_acceptance_criterion":    s.handleAddAC,
		"remove_acceptance_criterion": s.handleRemoveAC,
		"attach_file":                 s.handleAttachFile,
		"attach_link":                 s.handleAttachLink,
		"set_provider":                s.handleSetProvider,
		"set_model":                   s.handleSetModel,
		"set_max_turns":               s.handleSetMaxTurns,
		"push_to_backlog":             s.handlePush,
		"apply_template":              s.handleApplyTemplate,
	}
	return s
}

func (s *Server) Dispatch(ctx context.Context, tool string, args json.RawMessage) (json.RawMessage, error) {
	h, ok := s.tools[tool]
	if !ok {
		return nil, fmt.Errorf("unknown tool: %s", tool)
	}
	return h(ctx, args)
}

func ok() json.RawMessage { return json.RawMessage(`{"ok":true}`) }
