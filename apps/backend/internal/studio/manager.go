package studio

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/orchestra/orchestra/apps/backend/internal/db"
	"github.com/orchestra/orchestra/apps/backend/internal/observability"
)

// RunnerSpawner abstracts the CLI agent spawn used by a studio session.
// Phase 1 uses a fake; Phase 2 wires real CLI runners.
type RunnerSpawner interface {
	Spawn(ctx context.Context, sess Session, onEvent func(Event)) error
	SendMessage(ctx context.Context, sessionID, message string) error
	Stop(sessionID string) error
}

type Manager struct {
	d       *sql.DB
	bus     *observability.PubSub
	spawner RunnerSpawner
}

func NewManager(d *sql.DB, bus *observability.PubSub, spawner RunnerSpawner) *Manager {
	return &Manager{d: d, bus: bus, spawner: spawner}
}

func (m *Manager) StartSession(ctx context.Context, req StartSessionRequest) (Session, error) {
	if req.Runner == "" {
		return Session{}, fmt.Errorf("studio: runner required")
	}
	id := "studio-" + uuid.NewString()
	row := db.StudioSession{ID: id, ProjectID: req.ProjectID, Runner: req.Runner}
	if err := db.CreateStudioSession(m.d, row); err != nil {
		return Session{}, fmt.Errorf("create session: %w", err)
	}
	if err := db.CreateDraft(m.d, id); err != nil {
		return Session{}, fmt.Errorf("create draft: %w", err)
	}
	sess := Session{ID: id, ProjectID: req.ProjectID, Runner: req.Runner, Status: StatusActive}
	if m.spawner != nil {
		if err := m.spawner.Spawn(ctx, sess, m.dispatch); err != nil {
			_ = db.EndStudioSession(m.d, id, string(StatusDiscarded))
			_ = db.DeleteDraft(m.d, id)
			return Session{}, fmt.Errorf("spawn runner: %w", err)
		}
	}
	return sess, nil
}

func (m *Manager) Discard(sessionID string) error {
	if m.spawner != nil {
		_ = m.spawner.Stop(sessionID)
	}
	if err := db.DeleteDraft(m.d, sessionID); err != nil {
		return err
	}
	return db.EndStudioSession(m.d, sessionID, string(StatusDiscarded))
}

func (m *Manager) GetDraft(sessionID string) (DraftSnapshot, error) {
	d2, err := db.GetDraft(m.d, sessionID)
	if err != nil {
		return DraftSnapshot{}, err
	}
	return toSnapshot(d2)
}

func (m *Manager) dispatch(ev Event) {
	if m.bus == nil {
		return
	}
	m.bus.Publish(observability.Event{
		Type: "studio." + ev.SessionID,
		Data: ev,
	})
}

func toSnapshot(d2 db.IssueDraft) (DraftSnapshot, error) {
	s := DraftSnapshot{
		SessionID:         d2.SessionID,
		Title:             d2.Title,
		Description:       d2.Description,
		SuggestedProvider: d2.SuggestedProvider,
		SuggestedModel:    d2.SuggestedModel,
		MaxTurns:          d2.MaxTurns,
		TemplateName:      d2.TemplateName,
		TemplateVars:      map[string]string{},
		AgentGuidance:     map[string]interface{}{},
	}
	if err := json.Unmarshal([]byte(d2.AcceptanceCriteria), &s.AcceptanceCriteria); err != nil {
		return s, fmt.Errorf("ac json: %w", err)
	}
	if err := json.Unmarshal([]byte(d2.Attachments), &s.Attachments); err != nil {
		return s, fmt.Errorf("attachments json: %w", err)
	}
	if d2.TemplateVars != "" {
		_ = json.Unmarshal([]byte(d2.TemplateVars), &s.TemplateVars)
	}
	if d2.AgentGuidance != "" {
		_ = json.Unmarshal([]byte(d2.AgentGuidance), &s.AgentGuidance)
	}
	return s, nil
}
