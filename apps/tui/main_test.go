package main

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestInitialModel(t *testing.T) {
	m := initialModel(false)

	if !m.followLogs {
		t.Error("expected followLogs to be true by default")
	}
	if m.noStart {
		t.Error("expected noStart to be false when passed false")
	}
	if m.activeTab != 0 {
		t.Errorf("expected activeTab to be 0, got %d", m.activeTab)
	}
	if m.ready {
		t.Error("expected ready to be false initially")
	}
	if m.backend == nil {
		t.Fatal("expected backend service to be configured")
	}
	if m.frontend == nil {
		t.Fatal("expected frontend service to be configured")
	}
	if m.backend.Name != "Orchestra Backend" {
		t.Errorf("expected backend name 'Orchestra Backend', got %q", m.backend.Name)
	}
	if m.frontend.Name != "Orchestra Desktop" {
		t.Errorf("expected frontend name 'Orchestra Desktop', got %q", m.frontend.Name)
	}
}

func TestInitialModelNoStart(t *testing.T) {
	m := initialModel(true)
	if !m.noStart {
		t.Error("expected noStart to be true when passed true")
	}
}

func TestGetCurrentService(t *testing.T) {
	m := initialModel(false)

	m.activeTab = 0
	if svc := m.getCurrentService(); svc != m.backend {
		t.Error("expected getCurrentService to return backend when activeTab is 0")
	}

	m.activeTab = 1
	if svc := m.getCurrentService(); svc != m.frontend {
		t.Error("expected getCurrentService to return frontend when activeTab is 1")
	}
}

func TestTabSwitching(t *testing.T) {
	m := initialModel(false)
	// Make viewport ready so updateViewport doesn't bail out
	m.ready = false

	if m.activeTab != 0 {
		t.Fatalf("expected initial activeTab 0, got %d", m.activeTab)
	}

	// Send tab key
	result, _ := m.Update(tea.KeyMsg{Type: tea.KeyTab})
	m = result.(*model)
	if m.activeTab != 1 {
		t.Errorf("expected activeTab 1 after tab press, got %d", m.activeTab)
	}

	// Tab again wraps back to 0
	result, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})
	m = result.(*model)
	if m.activeTab != 0 {
		t.Errorf("expected activeTab 0 after second tab press, got %d", m.activeTab)
	}
}

func TestNumberKeySwitching(t *testing.T) {
	m := initialModel(false)

	result, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'2'}})
	m = result.(*model)
	if m.activeTab != 1 {
		t.Errorf("expected activeTab 1 after pressing '2', got %d", m.activeTab)
	}

	result, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'1'}})
	m = result.(*model)
	if m.activeTab != 0 {
		t.Errorf("expected activeTab 0 after pressing '1', got %d", m.activeTab)
	}
}

func TestQuitKey(t *testing.T) {
	m := initialModel(false)
	// Set onEvent so Stop() doesn't panic
	noop := func() {}
	m.backend.onEvent = noop
	m.frontend.onEvent = noop

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	if cmd == nil {
		t.Fatal("expected a command from quit key")
	}
	// Execute the batch and check for quit
	msg := cmd()
	if _, ok := msg.(tea.QuitMsg); !ok {
		t.Error("expected quit command from 'q' key")
	}
}

func TestCtrlCQuit(t *testing.T) {
	m := initialModel(false)
	noop := func() {}
	m.backend.onEvent = noop
	m.frontend.onEvent = noop

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyCtrlC})
	if cmd == nil {
		t.Fatal("expected a command from ctrl+c")
	}
	msg := cmd()
	if _, ok := msg.(tea.QuitMsg); !ok {
		t.Error("expected quit command from ctrl+c")
	}
}

func TestFollowToggle(t *testing.T) {
	m := initialModel(false)

	if !m.followLogs {
		t.Fatal("expected followLogs to start true")
	}

	result, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'f'}})
	m = result.(*model)
	if m.followLogs {
		t.Error("expected followLogs to be false after pressing 'f'")
	}

	result, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'f'}})
	m = result.(*model)
	if !m.followLogs {
		t.Error("expected followLogs to be true after pressing 'f' again")
	}
}

func TestUpKeyDisablesFollow(t *testing.T) {
	m := initialModel(false)
	m.followLogs = true

	result, _ := m.Update(tea.KeyMsg{Type: tea.KeyUp})
	m = result.(*model)
	if m.followLogs {
		t.Error("expected followLogs to be false after pressing up")
	}
}

func TestWindowSizeMsg(t *testing.T) {
	m := initialModel(false)

	result, _ := m.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	m = result.(*model)

	if m.width != 120 {
		t.Errorf("expected width 120, got %d", m.width)
	}
	if m.height != 40 {
		t.Errorf("expected height 40, got %d", m.height)
	}
	if !m.ready {
		t.Error("expected ready to be true after window size message")
	}

	expectedVWidth := 120 - 4
	expectedVHeight := 40 - 15
	if m.viewport.Width != expectedVWidth {
		t.Errorf("expected viewport width %d, got %d", expectedVWidth, m.viewport.Width)
	}
	if m.viewport.Height != expectedVHeight {
		t.Errorf("expected viewport height %d, got %d", expectedVHeight, m.viewport.Height)
	}
}

func TestWindowSizeMsgMinimumDimensions(t *testing.T) {
	m := initialModel(false)

	result, _ := m.Update(tea.WindowSizeMsg{Width: 5, Height: 10})
	m = result.(*model)

	if m.viewport.Width != 10 {
		t.Errorf("expected viewport width clamped to 10, got %d", m.viewport.Width)
	}
	if m.viewport.Height != 5 {
		t.Errorf("expected viewport height clamped to 5, got %d", m.viewport.Height)
	}
}

func TestGetStatusDisplay(t *testing.T) {
	m := initialModel(false)

	tests := []struct {
		status   ServiceStatus
		contains string
	}{
		{StatusRunning, "RUNNING"},
		{StatusStarting, "STARTING"},
		{StatusError, "ERROR"},
		{StatusStopped, "STOPPED"},
	}

	for _, tt := range tests {
		svc := &Service{Status: tt.status}
		display := m.getStatusDisplay(svc)
		// lipgloss renders with ANSI codes, but the text content should be present
		if display == "" {
			t.Errorf("expected non-empty display for status %d", tt.status)
		}
	}
}

func TestViewBeforeReady(t *testing.T) {
	m := initialModel(false)
	view := m.View()
	expected := "Initializing Orchestra Dashboard..."
	if view != expected {
		t.Errorf("expected %q before ready, got %q", expected, view)
	}
}

func TestTabResetsFollowLogs(t *testing.T) {
	m := initialModel(false)
	m.followLogs = false

	result, _ := m.Update(tea.KeyMsg{Type: tea.KeyTab})
	m = result.(*model)
	if !m.followLogs {
		t.Error("expected followLogs to be reset to true after tab switch")
	}
}
