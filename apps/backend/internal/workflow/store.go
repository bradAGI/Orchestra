package workflow

import "sync"

// Store provides thread-safe access to a loaded workflow Document,
// supporting hot-reloading and path changes at runtime.
type Store struct {
	mu   sync.RWMutex
	path string
	doc  Document
}

// NewStore creates a new Store by loading the workflow file at the given path.
func NewStore(path string) (*Store, error) {
	doc, err := LoadFile(path)
	if err != nil {
		return nil, err
	}

	return &Store{path: path, doc: doc}, nil
}

// Current returns the currently loaded workflow Document.
func (s *Store) Current() Document {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.doc
}

// ForceReload re-reads the workflow file from disk and replaces the cached Document.
func (s *Store) ForceReload() error {
	doc, err := LoadFile(s.path)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.doc = doc
	return nil
}

// SetPath changes the workflow file path and loads the new file.
func (s *Store) SetPath(path string) error {
	doc, err := LoadFile(path)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.path = path
	s.doc = doc
	return nil
}

// Path returns the current workflow file path.
func (s *Store) Path() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.path
}
