package templates

import (
	"fmt"
	"regexp"
	"strings"
)

var placeholderRE = regexp.MustCompile(`\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\|\s*default\(\s*"([^"]*)"\s*\)\s*)?\}\}`)

// Render substitutes `{{name}}` and `{{name | default("fallback")}}`
// placeholders in body using values from vars. Missing variables with no
// default produce an error.
func Render(body string, vars map[string]string) (string, error) {
	var rerr error
	out := placeholderRE.ReplaceAllStringFunc(body, func(match string) string {
		m := placeholderRE.FindStringSubmatch(match)
		name := m[1]
		def := m[2]
		if v, ok := vars[name]; ok && v != "" {
			return v
		}
		if def != "" {
			return def
		}
		if rerr == nil {
			rerr = fmt.Errorf("template: variable %q has no value and no default", name)
		}
		return ""
	})
	return strings.TrimRight(out, "\n") + "\n", rerr
}

// Validate checks that every required variable declared in tpl.Meta has a
// non-empty value in vars.
func Validate(tpl Template, vars map[string]string) error {
	for _, v := range tpl.Meta.Variables {
		if v.Required {
			val, ok := vars[v.Name]
			if !ok || val == "" {
				return fmt.Errorf("template %q: missing required variable %q", tpl.Meta.Name, v.Name)
			}
		}
	}
	return nil
}
