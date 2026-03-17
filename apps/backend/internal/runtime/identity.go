// Package runtime provides runtime identity constants and network configuration helpers.
package runtime

import (
	"net"
	"strings"
)

const (
	// ServiceOrchestrator is the service identity for the orchestrator component.
	ServiceOrchestrator = "orchestra.orchestrator"
	// ServiceDashboard is the service identity for the dashboard component.
	ServiceDashboard = "orchestra.dashboard"
)

// HostRequiresToken returns true if the given host address requires API token
// authentication. Localhost and loopback addresses are exempt.
func HostRequiresToken(host string) bool {
	trimmed := strings.TrimSpace(strings.Trim(host, "[]"))
	if trimmed == "" {
		return false
	}
	if strings.EqualFold(trimmed, "localhost") {
		return false
	}
	ip := net.ParseIP(trimmed)
	if ip == nil {
		return true
	}
	if ip.IsLoopback() {
		return false
	}
	return true
}
