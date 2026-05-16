// Package templates implements loading, rendering, and storing studio task
// templates. Templates are markdown files with YAML front-matter describing
// variables and suggested execution settings.
package templates

import (
	"bytes"
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Variable struct {
	Name     string `yaml:"name" json:"name"`
	Required bool   `yaml:"required" json:"required"`
	Default  string `yaml:"default" json:"default,omitempty"`
}

type Meta struct {
	Name              string     `yaml:"name" json:"name"`
	Description       string     `yaml:"description" json:"description"`
	Variables         []Variable `yaml:"variables" json:"variables"`
	SuggestedProvider string     `yaml:"suggested_provider" json:"suggested_provider,omitempty"`
	SuggestedModel    string     `yaml:"suggested_model" json:"suggested_model,omitempty"`
	SuggestedMaxTurns int        `yaml:"suggested_max_turns" json:"suggested_max_turns,omitempty"`
}

type Template struct {
	Path string `json:"path"`
	Meta Meta   `json:"meta"`
	Body string `json:"body"`
}

var fmDelim = []byte("---\n")

// LoadTemplate reads a markdown template with YAML front-matter from disk.
// The file must begin with `---\n`, contain YAML, and close the front-matter
// with another `---\n` line before the body.
func LoadTemplate(path string) (Template, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Template{}, fmt.Errorf("read: %w", err)
	}
	if !bytes.HasPrefix(raw, fmDelim) {
		return Template{}, fmt.Errorf("template missing front-matter: %s", path)
	}
	rest := raw[len(fmDelim):]
	end := bytes.Index(rest, fmDelim)
	if end < 0 {
		return Template{}, fmt.Errorf("template front-matter not closed: %s", path)
	}
	var meta Meta
	if err := yaml.Unmarshal(rest[:end], &meta); err != nil {
		return Template{}, fmt.Errorf("parse front-matter: %w", err)
	}
	body := string(rest[end+len(fmDelim):])
	return Template{Path: path, Meta: meta, Body: body}, nil
}
