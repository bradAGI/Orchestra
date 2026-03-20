# Security and Code Quality Audit Report: Orchestra

**Audit Date:** 2026-03-20
**Scope:** Electron desktop app, Go backend, Docker/CI infrastructure

---

## Executive Summary

Orchestra's codebase demonstrates solid security foundations — pinned CI actions, distroless Docker images, proper file permissions, and encrypted token storage. However, several medium-severity issues were identified in Electron sandboxing, environment variable handling, missing security headers, and authentication patterns that should be addressed.

**Findings:** 2 HIGH, 8 MEDIUM, 3 LOW severity issues identified. As of 2026-03-20, 6 findings have been resolved (both HIGHs, 4 MEDIUMs). Remaining: 4 MEDIUM, 2 LOW.

---

## 1. Electron Security

### 1.1 ~~Sandbox Disabled in Development~~ — ~~HIGH~~ FIXED

**File:** `apps/desktop/electron/main.cjs`

**Resolved:** `sandbox: true` is now set unconditionally.

### 1.2 ~~Environment Variables Leaked to Backend Subprocess~~ — ~~MEDIUM~~ FIXED

**File:** `apps/desktop/electron/main.cjs`

**Resolved:** Environment variables are now explicitly whitelisted (PATH, HOME, USERPROFILE, TMPDIR, LANG, plus ORCHESTRA_* vars).

### 1.3 ~~API Token Visible in Console Output~~ — ~~MEDIUM~~ FIXED

**File:** `apps/desktop/electron/main.cjs`

**Resolved:** Token is now masked via `maskToken` function before output.

### 1.4 Plaintext Token Fallback — MEDIUM

**File:** `apps/desktop/electron/main.cjs:241`

```javascript
if (safeStorage.isEncryptionAvailable()) {
  encrypted[key] = safeStorage.encryptString(value).toString('base64')
} else {
  encrypted[key] = value  // Plaintext fallback
}
```

**Fix:** Refuse to store tokens without encryption, or require explicit user opt-in with a warning.

---

## 2. Preload & IPC Security

### 2.1 ~~Missing Content Security Policy~~ — ~~HIGH~~ FIXED

**Resolved:** CSP is now enforced in `apps/desktop/electron/main.cjs` via `session.webRequest.onHeadersReceived`.

### 2.2 IPC Handlers Lack Input Validation — MEDIUM

**File:** `apps/desktop/electron/preload.cjs:12,14`

`openExternal()` and `openPath()` are exposed without URL/path validation. Malicious renderer code could open harmful URLs or local files.

**Fix:** Validate URL protocol (allow only `http:`/`https:`) and restrict paths.

---

## 3. Backend API Security

### 3.1 Query Parameter Token Fallback — MEDIUM

**File:** `apps/backend/internal/api/auth.go:24-29`

```go
if qToken := r.URL.Query().Get("token"); qToken == token {
    next.ServeHTTP(w, r)
    return
}
```

Query parameters appear in server logs, browser history, proxy logs, and Referer headers. This exists to support SSE/EventSource which cannot set custom headers.

**Fix:** Implement a temporary token exchange or use secure session cookies for SSE.

### 3.2 ~~Missing Security Response Headers~~ — ~~MEDIUM~~ FIXED

**Resolved:** `securityHeaders` middleware in `router.go` now sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.

### 3.3 ~~No Rate Limiting on OAuth Endpoints~~ — ~~MEDIUM~~ FIXED

**Resolved:** OAuth endpoints now use a separate `oauthRateLimited` router with `RateLimit(5, 10)` applied.

### 3.4 CORS Allows Any Loopback Port — LOW

**File:** `apps/backend/internal/api/router.go:303-327`

```go
allowlist := []string{
    "http://127.0.0.1:*",
    "http://localhost:*",
    "http://[::1]:*",
}
```

Acceptable for local development. For production, restrict to specific ports.

---

## 4. Subprocess Execution

### 4.1 Shell Quote Escaping — GOOD

**File:** `apps/backend/internal/agents/command_runner.go:776-781`

Uses correct POSIX single-quote escaping technique. No injection risk identified.

### 4.2 Environment Variable Inheritance — LOW

**File:** `apps/backend/internal/agents/command_runner.go:109`

Subprocesses inherit all parent environment variables. Could leak sensitive data.

**Fix:** Whitelist required variables only.

---

## 5. Docker & Infrastructure

### 5.1 Distroless Base Image — GOOD

Uses `gcr.io/distroless/static-debian12` with `nonroot:nonroot` user and proper health checks.

### 5.2 Port Exposed to All Interfaces — MEDIUM

**File:** `ops/docker/compose.yml:12-13`

Port 4010 bound to `0.0.0.0`. Should bind to `127.0.0.1:4010:4010` by default.

---

## 6. CI/CD Security

### 6.1 Pinned Actions & Minimal Permissions — GOOD

All workflows use full commit hash pins and explicit minimal permissions.

### 6.2 PR Body Shell Injection Risk — MEDIUM

**File:** `.github/workflows/pr-description-lint.yml:31-38`

PR body is written to a file via shell expansion. Malicious PR body content could contain shell metacharacters.

**Fix:** Pipe the body via stdin instead of shell variable expansion.

---

## 7. Positive Findings

| Area | Detail |
|------|--------|
| Token encryption | AES-256-GCM via `ORCHESTRA_TOKEN_KEY` (backend) |
| File permissions | `0700` dirs, `0600` files, `umask(0077)` |
| Docker | Distroless image, nonroot user, health checks |
| CI/CD | Pinned action SHAs, minimal GITHUB_TOKEN permissions |
| Shell escaping | Correct POSIX single-quote technique |
| Auth middleware | Bearer token validation on all protected routes |
| Dependencies | Recent versions — Electron 41, React 19, Go 1.24 |

---

## 8. Summary Table

| # | Issue | Severity | Location | Status |
|---|-------|----------|----------|--------|
| 1.1 | Sandbox disabled in dev | HIGH | main.cjs | **FIXED** |
| 2.1 | Missing CSP headers | HIGH | main.cjs | **FIXED** |
| 1.2 | Env vars leaked to child | MEDIUM | main.cjs | **FIXED** |
| 1.3 | Token in console output | MEDIUM | main.cjs | **FIXED** |
| 1.4 | Plaintext token fallback | MEDIUM | main.cjs:241 | Open |
| 2.2 | IPC input validation | MEDIUM | preload.cjs:12,14 | Open |
| 3.1 | Query param token auth | MEDIUM | auth.go:24-29 | Open |
| 3.2 | Missing security headers | MEDIUM | router.go | **FIXED** |
| 3.3 | No OAuth rate limiting | MEDIUM | router.go | **FIXED** |
| 5.2 | Port exposed to 0.0.0.0 | MEDIUM | compose.yml:12-13 | Open |
| 6.2 | PR body shell injection | MEDIUM | pr-description-lint.yml:31-38 | Open |
| 3.4 | CORS any loopback port | LOW | router.go:303-327 | Open |
| 4.2 | Subprocess env inheritance | LOW | command_runner.go:109 | Open |

---

## 9. Recommended Priority

1. ~~**Immediate:** Enable sandbox unconditionally, add CSP headers, add security response headers~~ — **ALL DONE**
2. **Next sprint:** ~~Whitelist env vars~~ (done), validate IPC inputs, enforce token encryption, ~~add OAuth rate limiting~~ (done), fix PR body injection
3. **Backlog:** Replace query param token auth, add audit logging, enforce HTTPS in production, restrict CORS ports, bind compose port to 127.0.0.1
