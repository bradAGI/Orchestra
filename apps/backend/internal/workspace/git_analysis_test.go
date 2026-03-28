package workspace

import (
	"testing"
)

func TestParseNumstat(t *testing.T) {
	input := "10\t5\tsrc/main.go\n20\t3\tsrc/main_test.go\n0\t15\tREADME.md\n"
	added, removed, files, testFiles := parseNumstat(input)

	if added != 30 {
		t.Errorf("LinesAdded: got %d, want 30", added)
	}
	if removed != 23 {
		t.Errorf("LinesRemoved: got %d, want 23", removed)
	}
	if files != 3 {
		t.Errorf("FilesChanged: got %d, want 3", files)
	}
	if testFiles != 1 {
		t.Errorf("TestFiles: got %d, want 1", testFiles)
	}
}

func TestParseNumstatEmpty(t *testing.T) {
	added, removed, files, testFiles := parseNumstat("")
	if added != 0 || removed != 0 || files != 0 || testFiles != 0 {
		t.Errorf("expected all zeros for empty input, got %d/%d/%d/%d", added, removed, files, testFiles)
	}
}

func TestParseNumstatBinaryFiles(t *testing.T) {
	input := "-\t-\timage.png\n5\t2\tcode.go\n"
	added, removed, files, testFiles := parseNumstat(input)

	if added != 5 {
		t.Errorf("LinesAdded: got %d, want 5", added)
	}
	if removed != 2 {
		t.Errorf("LinesRemoved: got %d, want 2", removed)
	}
	if files != 2 {
		t.Errorf("FilesChanged: got %d, want 2", files)
	}
	if testFiles != 0 {
		t.Errorf("TestFiles: got %d, want 0", testFiles)
	}
}

func TestIsTestFile(t *testing.T) {
	tests := []struct {
		name string
		want bool
	}{
		{"src/main_test.go", true},
		{"src/app.test.ts", true},
		{"src/app.test.tsx", true},
		{"src/app.spec.ts", true},
		{"src/app.spec.tsx", true},
		{"tests/test_utils.py", true},
		{"tests/utils_test.py", true},
		{"src/main.go", false},
		{"src/app.ts", false},
		{"README.md", false},
		{"test_helper.py", true},
	}

	for _, tc := range tests {
		got := isTestFile(tc.name)
		if got != tc.want {
			t.Errorf("isTestFile(%q) = %v, want %v", tc.name, got, tc.want)
		}
	}
}

func TestCountNonEmptyLines(t *testing.T) {
	tests := []struct {
		input string
		want  int
	}{
		{"", 0},
		{"abc123 first commit\ndef456 second commit\n", 2},
		{"abc123 first commit\n\ndef456 second commit\n", 2},
		{"\n\n\n", 0},
	}

	for _, tc := range tests {
		got := countNonEmptyLines(tc.input)
		if got != tc.want {
			t.Errorf("countNonEmptyLines(%q) = %d, want %d", tc.input, got, tc.want)
		}
	}
}

func TestCountHunks(t *testing.T) {
	diff := `diff --git a/main.go b/main.go
index abc..def 100644
--- a/main.go
+++ b/main.go
@@ -1,5 +1,6 @@
 package main
+import "fmt"
@@ -10,3 +11,5 @@
 func main() {
+    fmt.Println("hello")
`
	got := countHunks(diff)
	if got != 2 {
		t.Errorf("countHunks: got %d, want 2", got)
	}
}

func TestParseNumstatMultipleTestTypes(t *testing.T) {
	input := "10\t0\tutils_test.go\n5\t0\tapp.spec.tsx\n3\t0\ttest_module.py\n1\t0\tregular.go\n"
	_, _, files, testFiles := parseNumstat(input)

	if files != 4 {
		t.Errorf("FilesChanged: got %d, want 4", files)
	}
	if testFiles != 3 {
		t.Errorf("TestFiles: got %d, want 3", testFiles)
	}
}
