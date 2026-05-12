package studio

import (
	"context"
	"encoding/json"
	"fmt"
)

func (s *Server) handleSetTitle(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
	var a struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &a); err != nil {
		return nil, err
	}
	if a.Text == "" {
		return nil, fmt.Errorf("text required")
	}
	if err := s.mgr.SetTitle(s.sessionID, a.Text); err != nil {
		return nil, err
	}
	return ok(), nil
}

func (s *Server) handleSetDescription(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
	var a struct {
		Markdown string `json:"markdown"`
	}
	if err := json.Unmarshal(raw, &a); err != nil {
		return nil, err
	}
	if err := s.mgr.SetDescription(s.sessionID, a.Markdown); err != nil {
		return nil, err
	}
	return ok(), nil
}

func (s *Server) handleAddAC(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
	var a struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &a); err != nil {
		return nil, err
	}
	if a.Text == "" {
		return nil, fmt.Errorf("text required")
	}
	if err := s.mgr.AddAcceptanceCriterion(s.sessionID, a.Text); err != nil {
		return nil, err
	}
	return ok(), nil
}

func (s *Server) handleRemoveAC(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
	var a struct {
		Index int `json:"index"`
	}
	if err := json.Unmarshal(raw, &a); err != nil {
		return nil, err
	}
	if err := s.mgr.RemoveAcceptanceCriterion(s.sessionID, a.Index); err != nil {
		return nil, err
	}
	return ok(), nil
}

func (s *Server) handleAttachFile(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
	var a struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal(raw, &a); err != nil {
		return nil, err
	}
	if a.Path == "" {
		return nil, fmt.Errorf("path required")
	}
	if err := s.mgr.AttachFile(s.sessionID, a.Path); err != nil {
		return nil, err
	}
	return ok(), nil
}

func (s *Server) handleAttachLink(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
	var a struct {
		URL   string `json:"url"`
		Label string `json:"label"`
	}
	if err := json.Unmarshal(raw, &a); err != nil {
		return nil, err
	}
	if a.URL == "" {
		return nil, fmt.Errorf("url required")
	}
	if err := s.mgr.AttachLink(s.sessionID, a.URL, a.Label); err != nil {
		return nil, err
	}
	return ok(), nil
}

func (s *Server) handleSetProvider(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
	var a struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(raw, &a); err != nil {
		return nil, err
	}
	if err := s.mgr.SetProvider(s.sessionID, a.Name); err != nil {
		return nil, err
	}
	return ok(), nil
}

func (s *Server) handleSetModel(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
	var a struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(raw, &a); err != nil {
		return nil, err
	}
	if err := s.mgr.SetModel(s.sessionID, a.Name); err != nil {
		return nil, err
	}
	return ok(), nil
}

func (s *Server) handleSetMaxTurns(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
	var a struct {
		N int `json:"n"`
	}
	if err := json.Unmarshal(raw, &a); err != nil {
		return nil, err
	}
	if a.N <= 0 {
		return nil, fmt.Errorf("n must be > 0")
	}
	if err := s.mgr.SetMaxTurns(s.sessionID, a.N); err != nil {
		return nil, err
	}
	return ok(), nil
}

func (s *Server) handlePush(ctx context.Context, _ json.RawMessage) (json.RawMessage, error) {
	id, err := s.mgr.Push(ctx, s.sessionID)
	if err != nil {
		return nil, err
	}
	out, _ := json.Marshal(map[string]string{"issue_id": id})
	return out, nil
}
