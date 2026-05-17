package templates

import (
	"os"
	"path/filepath"
	"testing"
)

func TestStoreListsTemplates(t *testing.T) {
	dir := t.TempDir()
	templatesDir := filepath.Join(dir, ".orchestra", "studio", "templates")
	if err := os.MkdirAll(templatesDir, 0755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(templatesDir, "a.md"), []byte("---\nname: a\n---\nbody"), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := os.WriteFile(filepath.Join(templatesDir, "b.md"), []byte("---\nname: b\n---\nbody"), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}

	s := NewStore(dir)
	tpls, err := s.List()
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(tpls) != 2 {
		t.Fatalf("expected 2, got %d", len(tpls))
	}
	if tpls[0].Meta.Name != "a" || tpls[1].Meta.Name != "b" {
		t.Fatalf("not sorted: %+v", tpls)
	}
}

func TestStoreListsEmptyDir(t *testing.T) {
	s := NewStore(t.TempDir())
	tpls, err := s.List()
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(tpls) != 0 {
		t.Fatalf("expected 0, got %d", len(tpls))
	}
}

func TestStoreWriteAndGet(t *testing.T) {
	s := NewStore(t.TempDir())
	body := "---\nname: x\ndescription: X\n---\nhello"
	if err := s.Write("x", []byte(body)); err != nil {
		t.Fatalf("write: %v", err)
	}
	tpl, err := s.Get("x")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if tpl.Meta.Name != "x" {
		t.Fatalf("name=%q", tpl.Meta.Name)
	}
}

func TestStoreRejectsBadName(t *testing.T) {
	s := NewStore(t.TempDir())
	if err := s.Write("../escape", []byte("---\nname: e\n---\n")); err == nil {
		t.Fatalf("expected rejection of traversal")
	}
	if _, err := s.Get("../escape"); err == nil {
		t.Fatalf("expected rejection on get")
	}
	if err := s.Delete("../escape"); err == nil {
		t.Fatalf("expected rejection on delete")
	}
}

func TestStoreDelete(t *testing.T) {
	s := NewStore(t.TempDir())
	if err := s.Write("x", []byte("---\nname: x\n---\n")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := s.Delete("x"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := s.Get("x"); err == nil {
		t.Fatalf("expected gone")
	}
}
