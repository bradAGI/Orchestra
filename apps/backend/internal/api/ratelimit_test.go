package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiter_AllowWithinBurst(t *testing.T) {
	rl := &rateLimiter{
		visitors: make(map[string]*bucket),
		rate:     10,
		burst:    5,
	}

	for i := 0; i < 5; i++ {
		if !rl.allow("192.168.1.1") {
			t.Fatalf("request %d should have been allowed within burst limit", i+1)
		}
	}
}

func TestRateLimiter_RejectExceedingRate(t *testing.T) {
	rl := &rateLimiter{
		visitors: make(map[string]*bucket),
		rate:     1,
		burst:    3,
	}

	// Use up the burst
	for i := 0; i < 3; i++ {
		if !rl.allow("10.0.0.1") {
			t.Fatalf("request %d should have been allowed within burst", i+1)
		}
	}

	// Next request should be rejected
	if rl.allow("10.0.0.1") {
		t.Fatal("request exceeding burst should have been rejected")
	}
}

func TestRateLimiter_IndependentIPs(t *testing.T) {
	rl := &rateLimiter{
		visitors: make(map[string]*bucket),
		rate:     1,
		burst:    2,
	}

	// Exhaust IP A
	for i := 0; i < 2; i++ {
		rl.allow("ip-a")
	}
	if rl.allow("ip-a") {
		t.Fatal("ip-a should be rate-limited")
	}

	// IP B should still be allowed
	if !rl.allow("ip-b") {
		t.Fatal("ip-b should not be affected by ip-a's limit")
	}
}

func TestRateLimiter_TokenRefill(t *testing.T) {
	rl := &rateLimiter{
		visitors: make(map[string]*bucket),
		rate:     1000, // 1000 tokens/sec so refill is fast
		burst:    2,
	}

	// Exhaust tokens
	for i := 0; i < 2; i++ {
		rl.allow("refill-ip")
	}
	if rl.allow("refill-ip") {
		t.Fatal("should be rejected after burst exhausted")
	}

	// Manually advance lastSeen to simulate time passing
	rl.mu.Lock()
	b := rl.visitors["refill-ip"]
	b.lastSeen = b.lastSeen.Add(-10 * time.Millisecond) // 10ms ago at 1000/s = 10 tokens refilled
	rl.mu.Unlock()

	if !rl.allow("refill-ip") {
		t.Fatal("should be allowed after tokens have refilled")
	}
}

func TestRateLimitMiddleware_Returns429(t *testing.T) {
	mw := RateLimit(1, 2)

	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First two requests should pass (burst=2)
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "middleware-test-ip"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i+1, rec.Code)
		}
	}

	// Third request should be rate-limited
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "middleware-test-ip"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	errObj, ok := body["error"].(map[string]any)
	if !ok {
		t.Fatal("response missing error object")
	}
	if errObj["code"] != "rate_limited" {
		t.Fatalf("expected error code 'rate_limited', got %q", errObj["code"])
	}
}

func TestRateLimitMiddleware_XForwardedFor(t *testing.T) {
	mw := RateLimit(1, 1)

	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First request with X-Forwarded-For should pass
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "shared-proxy"
	req.Header.Set("X-Forwarded-For", "real-client-a")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("first request should pass, got %d", rec.Code)
	}

	// Second request from different forwarded IP should also pass
	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	req2.RemoteAddr = "shared-proxy"
	req2.Header.Set("X-Forwarded-For", "real-client-b")
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("request from different forwarded IP should pass, got %d", rec2.Code)
	}
}
