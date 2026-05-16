package templates

import "testing"

func TestRenderSubstitutes(t *testing.T) {
	out, err := Render("Hello {{name}}", map[string]string{"name": "world"})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if out != "Hello world\n" {
		t.Fatalf("got %q", out)
	}
}

func TestRenderUsesDefault(t *testing.T) {
	out, err := Render(`{{name | default("anon")}}`, map[string]string{})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if out != "anon\n" {
		t.Fatalf("got %q", out)
	}
}

func TestRenderMissingNoDefault(t *testing.T) {
	if _, err := Render("{{missing}}", map[string]string{}); err == nil {
		t.Fatalf("expected error")
	}
}

func TestValidateMissingRequired(t *testing.T) {
	tpl := Template{Meta: Meta{Variables: []Variable{{Name: "file", Required: true}}}}
	if err := Validate(tpl, map[string]string{}); err == nil {
		t.Fatalf("expected error for missing required var")
	}
}

func TestValidatePassesWithValue(t *testing.T) {
	tpl := Template{Meta: Meta{Variables: []Variable{{Name: "file", Required: true}}}}
	if err := Validate(tpl, map[string]string{"file": "x.go"}); err != nil {
		t.Fatalf("unexpected: %v", err)
	}
}
