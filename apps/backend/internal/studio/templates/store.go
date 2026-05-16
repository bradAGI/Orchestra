package templates

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// Store is a filesystem-backed template repository rooted at
// <projectRoot>/.orchestra/studio/templates.
type Store struct {
	root string
}

// NewStore creates a Store rooted under the given project's .orchestra dir.
func NewStore(projectRoot string) *Store {
	return &Store{root: filepath.Join(projectRoot, ".orchestra", "studio", "templates")}
}

var nameRE = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

func (s *Store) ensureDir() error {
	return os.MkdirAll(s.root, 0755)
}

func (s *Store) pathFor(name string) (string, error) {
	if !nameRE.MatchString(name) {
		return "", fmt.Errorf("template name must match [a-zA-Z0-9_-]+, got %q", name)
	}
	return filepath.Join(s.root, name+".md"), nil
}

// List returns every parseable template in the store, sorted by Meta.Name.
// Files that fail to parse are silently skipped.
func (s *Store) List() ([]Template, error) {
	if err := s.ensureDir(); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(s.root)
	if err != nil {
		return nil, err
	}
	var out []Template
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		tpl, err := LoadTemplate(filepath.Join(s.root, e.Name()))
		if err != nil {
			continue
		}
		out = append(out, tpl)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Meta.Name < out[j].Meta.Name })
	return out, nil
}

// Get loads a single template by its filename stem (no extension).
func (s *Store) Get(name string) (Template, error) {
	p, err := s.pathFor(name)
	if err != nil {
		return Template{}, err
	}
	return LoadTemplate(p)
}

// Write persists content as <name>.md, creating the store directory if needed.
func (s *Store) Write(name string, content []byte) error {
	if err := s.ensureDir(); err != nil {
		return err
	}
	p, err := s.pathFor(name)
	if err != nil {
		return err
	}
	return os.WriteFile(p, content, 0644)
}

// Delete removes <name>.md from the store.
func (s *Store) Delete(name string) error {
	p, err := s.pathFor(name)
	if err != nil {
		return err
	}
	return os.Remove(p)
}
