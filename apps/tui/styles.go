package main

import "github.com/charmbracelet/lipgloss"

var (
	// PrimaryColor is the main accent color used for borders and highlights.
	PrimaryColor = lipgloss.Color("#7D56F4")
	// SecondaryColor is used for section headers and secondary highlights.
	SecondaryColor = lipgloss.Color("#FF79C6")
	// AccentColor is used for success states and active indicators.
	AccentColor = lipgloss.Color("#50FA7B")
	// ErrorColor is used for error states and failure indicators.
	ErrorColor = lipgloss.Color("#FF5555")
	// BgColor is the background color for the dashboard theme.
	BgColor = lipgloss.Color("#282A36")
	// FgColor is the foreground text color for the dashboard theme.
	FgColor = lipgloss.Color("#F8F8F2")

	// TitleStyle is the lipgloss style for the main dashboard title.
	TitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(FgColor).
			Background(PrimaryColor).
			Padding(0, 1).
			MarginLeft(2)

	// HeaderStyle is the lipgloss style for section headers.
	HeaderStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(SecondaryColor).
			Padding(0, 1)

	// StatusStyleRunning is the lipgloss style for running/active status indicators.
	StatusStyleRunning = lipgloss.NewStyle().
				Foreground(AccentColor).
				Bold(true)

	// StatusStyleStopped is the lipgloss style for stopped/inactive status indicators.
	StatusStyleStopped = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#6272A4")).
				Bold(true)

	// StatusStyleError is the lipgloss style for error status indicators.
	StatusStyleError = lipgloss.NewStyle().
				Foreground(ErrorColor).
				Bold(true)

	// BoxStyle is the lipgloss style for bordered content boxes.
	BoxStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(PrimaryColor).
			Padding(1).
			MarginTop(1)

	// LogBoxStyle is the lipgloss style for the log output viewport.
	LogBoxStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(lipgloss.Color("#44475A")).
			Padding(0, 1)

	// CommandStyle is the lipgloss style for command text display.
	CommandStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#F1FA8C")).
			Italic(true)

	// ActiveTabStyle is the lipgloss style for the currently selected tab.
	ActiveTabStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(FgColor).
			Background(lipgloss.Color("#44475A")).
			Padding(0, 2)

	// InactiveTabStyle is the lipgloss style for unselected tabs.
	InactiveTabStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#6272A4")).
			Padding(0, 2)
)

// GradientTitle renders the given text as a bold, padded title string.
func GradientTitle(text string) string {
	style := lipgloss.NewStyle().Bold(true).Padding(0, 2)
	return style.Render(text)
}
