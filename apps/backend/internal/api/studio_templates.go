package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type studioTplBody struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

func (s *Server) studioTemplatesAvailable(w http.ResponseWriter) bool {
	if s.studioTpls == nil {
		http.Error(w, "studio templates not configured", http.StatusServiceUnavailable)
		return false
	}
	return true
}

// ListStudioTemplates returns all parseable templates in the studio store.
func (s *Server) ListStudioTemplates(w http.ResponseWriter, _ *http.Request) {
	if !s.studioTemplatesAvailable(w) {
		return
	}
	tpls, err := s.studioTpls.List()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if tpls == nil {
		tpls = nil
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tpls)
}

// CreateStudioTemplate persists a new template from the request body.
func (s *Server) CreateStudioTemplate(w http.ResponseWriter, r *http.Request) {
	if !s.studioTemplatesAvailable(w) {
		return
	}
	var b studioTplBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.studioTpls.Write(b.Name, []byte(b.Content)); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// GetStudioTemplate returns a single template by name.
func (s *Server) GetStudioTemplate(w http.ResponseWriter, r *http.Request) {
	if !s.studioTemplatesAvailable(w) {
		return
	}
	name := chi.URLParam(r, "name")
	tpl, err := s.studioTpls.Get(name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tpl)
}

// UpdateStudioTemplate overwrites the named template's content.
func (s *Server) UpdateStudioTemplate(w http.ResponseWriter, r *http.Request) {
	if !s.studioTemplatesAvailable(w) {
		return
	}
	name := chi.URLParam(r, "name")
	var b studioTplBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.studioTpls.Write(name, []byte(b.Content)); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteStudioTemplate removes the named template from the store.
func (s *Server) DeleteStudioTemplate(w http.ResponseWriter, r *http.Request) {
	if !s.studioTemplatesAvailable(w) {
		return
	}
	name := chi.URLParam(r, "name")
	if err := s.studioTpls.Delete(name); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
