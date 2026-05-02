package usage

import (
	"crypto/sha1"
	"encoding/hex"
	"path/filepath"
	"sort"
	"strings"
)

// worktreeIndex maps absolute filesystem paths to project metadata. It's
// built by Service from the orchestrator's known projects + worktrees and
// passed to scanners so they can attribute sessions to projects.
type worktreeIndex struct {
	entries []worktreeEntry // sorted by Path length, longest first
}

type worktreeEntry struct {
	Path       string
	ProjectKey string
	Label      string
	WorktreeID string
	RepoID     string
}

func newWorktreeIndex(entries []worktreeEntry) worktreeIndex {
	cleaned := make([]worktreeEntry, 0, len(entries))
	for _, e := range entries {
		if e.Path == "" {
			continue
		}
		e.Path = filepath.Clean(e.Path)
		cleaned = append(cleaned, e)
	}
	sort.SliceStable(cleaned, func(i, j int) bool {
		return len(cleaned[i].Path) > len(cleaned[j].Path)
	})
	return worktreeIndex{entries: cleaned}
}

// resolve returns (projectKey, label, worktreeID, repoID) for the given cwd.
// If cwd doesn't fall inside any known worktree, the project is keyed off the
// cwd's last two path segments and worktreeID is "" — which the scope='orca'
// filter uses to exclude these.
func (w worktreeIndex) resolve(cwd string) (string, string, string, string) {
	if cwd == "" {
		return "unknown", "Unknown location", "", ""
	}
	cleaned := filepath.Clean(cwd)
	for _, e := range w.entries {
		if cleaned == e.Path || strings.HasPrefix(cleaned+string(filepath.Separator), e.Path+string(filepath.Separator)) {
			return e.ProjectKey, e.Label, e.WorktreeID, e.RepoID
		}
	}
	// Best-effort label: last two segments.
	parts := strings.Split(cleaned, string(filepath.Separator))
	if len(parts) >= 2 {
		label := strings.Join(parts[len(parts)-2:], "/")
		return "path:" + hashPath(cleaned), label, "", ""
	}
	return "path:" + hashPath(cleaned), cleaned, "", ""
}

// fingerprint returns a stable hash of the index — used to invalidate
// scanner caches when worktrees change.
func (w worktreeIndex) fingerprint() string {
	if len(w.entries) == 0 {
		return ""
	}
	h := sha1.New()
	for _, e := range w.entries {
		h.Write([]byte(e.Path))
		h.Write([]byte{0})
		h.Write([]byte(e.WorktreeID))
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil))
}

func hashPath(p string) string {
	h := sha1.Sum([]byte(p))
	return hex.EncodeToString(h[:])[:10]
}
