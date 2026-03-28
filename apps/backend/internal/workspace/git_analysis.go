package workspace

import (
	"bufio"
	"context"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// GitMetrics holds the result of analysing a worktree after a session completes.
type GitMetrics struct {
	LinesAdded   int
	LinesRemoved int
	FilesChanged int
	TestFiles    int
	Commits      int
	Hunks        int
}

// testFilePatterns lists suffix/prefix patterns that identify test files.
var testFilePatterns = []string{
	"_test.go",
	".test.ts",
	".test.tsx",
	".spec.ts",
	".spec.tsx",
	"_test.py",
}

// isTestFile returns true if the filename matches a known test file pattern.
func isTestFile(name string) bool {
	base := filepath.Base(name)
	for _, pat := range testFilePatterns {
		if strings.HasSuffix(base, pat) {
			return true
		}
	}
	// Python convention: test_*.py
	if strings.HasPrefix(base, "test_") && strings.HasSuffix(base, ".py") {
		return true
	}
	return false
}

// AnalyzeSessionOutput runs git analysis on a worktree after a session completes.
// It diffs the current HEAD against the base branch or a specified base commit.
// If the worktree path doesn't exist or git commands fail, it returns zero metrics
// with no error (non-fatal).
func AnalyzeSessionOutput(worktreePath string, baseBranch string) (GitMetrics, error) {
	var m GitMetrics

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 1. git diff --numstat for lines added/removed, files changed, test files
	numstat, err := runGit(ctx, worktreePath, "diff", "--numstat", baseBranch+"..HEAD")
	if err != nil {
		return m, nil // non-fatal
	}
	m.LinesAdded, m.LinesRemoved, m.FilesChanged, m.TestFiles = parseNumstat(numstat)

	// 2. git log --oneline for commit count
	logOutput, err := runGit(ctx, worktreePath, "log", "--oneline", baseBranch+"..HEAD")
	if err != nil {
		return m, nil
	}
	m.Commits = countNonEmptyLines(logOutput)

	// 3. Count hunks via diff @@ markers
	diffOutput, err := runGit(ctx, worktreePath, "diff", baseBranch+"..HEAD")
	if err != nil {
		return m, nil
	}
	m.Hunks = countHunks(diffOutput)

	return m, nil
}

// runGit executes a git command in the given directory and returns stdout.
func runGit(ctx context.Context, dir string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// parseNumstat parses the output of `git diff --numstat` and returns
// total lines added, removed, unique files changed, and test file count.
func parseNumstat(output string) (added, removed, files, testFiles int) {
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 3)
		if len(parts) < 3 {
			continue
		}
		// Binary files show "-" for added/removed
		a, errA := strconv.Atoi(parts[0])
		r, errR := strconv.Atoi(parts[1])
		if errA != nil || errR != nil {
			// Binary file — still counts as a changed file
			files++
			if isTestFile(parts[2]) {
				testFiles++
			}
			continue
		}
		added += a
		removed += r
		files++
		if isTestFile(parts[2]) {
			testFiles++
		}
	}
	return
}

// countNonEmptyLines counts the number of non-empty lines in the input.
func countNonEmptyLines(output string) int {
	count := 0
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		if strings.TrimSpace(scanner.Text()) != "" {
			count++
		}
	}
	return count
}

// countHunks counts the number of hunk headers (lines starting with @@) in a diff.
func countHunks(diff string) int {
	count := 0
	scanner := bufio.NewScanner(strings.NewReader(diff))
	for scanner.Scan() {
		if strings.HasPrefix(scanner.Text(), "@@") {
			count++
		}
	}
	return count
}
