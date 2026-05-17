package templates

import (
	"os"
	"path/filepath"
	"testing"
)

const exampleTemplate = `---
name: add-tests
description: Add unit tests
variables:
  - name: file
    required: true
  - name: framework
suggested_provider: claude-code
suggested_max_turns: 8
---
Add unit tests to ` + "`{{file}}`" + ` using {{framework}}.
`

func TestLoadTemplate(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "add-tests.md")
	if err := os.WriteFile(path, []byte(exampleTemplate), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}
	tpl, err := LoadTemplate(path)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if tpl.Meta.Name != "add-tests" {
		t.Fatalf("name=%q", tpl.Meta.Name)
	}
	if len(tpl.Meta.Variables) != 2 || !tpl.Meta.Variables[0].Required {
		t.Fatalf("vars=%+v", tpl.Meta.Variables)
	}
	if tpl.Meta.SuggestedProvider != "claude-code" {
		t.Fatalf("provider=%q", tpl.Meta.SuggestedProvider)
	}
	if tpl.Meta.SuggestedMaxTurns != 8 {
		t.Fatalf("max_turns=%d", tpl.Meta.SuggestedMaxTurns)
	}
}

func TestLoadTemplateRejectsMissingFrontMatter(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "bad.md")
	if err := os.WriteFile(path, []byte("just a body"), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}
	if _, err := LoadTemplate(path); err == nil {
		t.Fatalf("expected error")
	}
}

func TestLoadTemplateRejectsUnclosedFrontMatter(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "bad.md")
	if err := os.WriteFile(path, []byte("---\nname: x\nno-closing-delim\n"), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}
	if _, err := LoadTemplate(path); err == nil {
		t.Fatalf("expected error")
	}
}
