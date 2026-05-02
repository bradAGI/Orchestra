package api

import (
	"crypto/subtle"
	"net"
	"net/http"
	"strings"
)

// tokensEqual compares two secrets in constant time. Returns false on length
// mismatch (early-exit is fine since length itself is not secret).
func tokensEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func requireBearerToken(token string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
			if strings.HasPrefix(authHeader, "Bearer ") && tokensEqual(authHeader[len("Bearer "):], token) {
				next.ServeHTTP(w, r)
				return
			}
			// Fallback: accept token via query parameter only for SSE endpoints
			// (EventSource cannot set Authorization headers). Restricted to
			// known SSE paths to limit query-param token exposure in logs.
			if qToken := r.URL.Query().Get("token"); tokensEqual(qToken, token) {
				if strings.HasSuffix(r.URL.Path, "/events") || strings.HasSuffix(r.URL.Path, "/logs") {
					next.ServeHTTP(w, r)
					return
				}
			}
			writeJSONError(w, http.StatusUnauthorized, "unauthorized", "missing or invalid bearer token")
		})
	}
}

func runtimeHostIsLoopback(host string) bool {
	trimmed := strings.TrimSpace(strings.Trim(host, "[]"))
	if trimmed == "" || strings.EqualFold(trimmed, "localhost") {
		return true
	}
	ip := net.ParseIP(trimmed)
	if ip == nil {
		return false
	}
	return ip.IsLoopback()
}
