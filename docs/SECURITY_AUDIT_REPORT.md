# Security and Code Quality Audit Report: Orchestra

**Audit Date:** 2026-03-20
**Scope:** Electron desktop app, Go backend, Docker/CI infrastructure

---

## Executive Summary

Orchestra's codebase demonstrates solid security foundations — pinned CI actions, distroless Docker images, proper file permissions, and encrypted token storage. However, several medium-severity issues were identified in Electron sandboxing, environment variable handling, missing security headers, and authentication patterns that should be addressed.

**Findings:** 2 HIGH, 8 MEDIUM, 3 LOW severity issues identified.

---

## 1. Electron Security

### 1.1 Sandbox Disabled in Development — HIGH

**File:** `apps/desktop/electron/main.cjs:351`

`sandbox: app.isPackaged` disables the Chromium sandbox in development mode. If a renderer vulnerability is exploited during development, there is no process-level isolation.

**Fix:** Set `sandbox: true` unconditionally. Use a CLI flag (`--no-sandbox`) for explicit dev override if needed.

### 1.2 Environment Variables Leaked to Backend Subprocess — MEDIUM

**File:** `apps/desktop/electron/main.cjs:122-128`

`...process.env` passes all parent environment variables (potentially including API keys, tokens, credentials) to the managed backend subprocess.

**Fix:** Whitelist only required variables:
```javascript
env: {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  ORCHESTRA_SERVER_HOST: '127.0.0.1',
  ORCHESTRA_SERVER_PORT: String(port),
  ORCHESTRA_WORKSPACE_ROOT: workspaceRoot,
  ORCHESTRA_API_TOKEN: token,
}
```

### 1.3 API Token Visible in Console Output — MEDIUM

**File:** `apps/desktop/electron/main.cjs:131-136`

Backend subprocess stdout/stderr is piped to the parent console. The generated API token could appear in logs if the backend echoes it.

**Fix:** Mask/redact the token value in piped output.

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

### 2.1 Missing Content Security Policy — HIGH

No CSP headers are defined in the Electron app or backend responses. XSS in the renderer could inline arbitrary scripts.

**Fix:** Add CSP via `session.webRequest.onHeadersReceived` in main.cjs:
```javascript
"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:*"
```

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

### 3.2 Missing Security Response Headers — MEDIUM

No `X-Content-Type-Options`, `X-Frame-Options`, or `Strict-Transport-Security` headers on API responses.

**Fix:** Add a middleware in `router.go`:
```go
w.Header().Set("X-Content-Type-Options", "nosniff")
w.Header().Set("X-Frame-Options", "DENY")
w.Header().Set("X-XSS-Protection", "1; mode=block")
```

### 3.3 No Rate Limiting on OAuth Endpoints — MEDIUM

**File:** `apps/backend/internal/api/router.go:175-176`

GitHub login/callback endpoints are not protected by the `RateLimit(20, 60)` middleware applied elsewhere.

**Fix:** Apply rate limiting (e.g., 5 requests per 10 seconds) to OAuth endpoints.

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

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1.1 | Sandbox disabled in dev | HIGH | main.cjs:351 |
| 2.1 | Missing CSP headers | HIGH | main.cjs, router.go |
| 1.2 | Env vars leaked to child | MEDIUM | main.cjs:122-128 |
| 1.3 | Token in console output | MEDIUM | main.cjs:131-136 |
| 1.4 | Plaintext token fallback | MEDIUM | main.cjs:241 |
| 2.2 | IPC input validation | MEDIUM | preload.cjs:12,14 |
| 3.1 | Query param token auth | MEDIUM | auth.go:24-29 |
| 3.2 | Missing security headers | MEDIUM | router.go |
| 3.3 | No OAuth rate limiting | MEDIUM | router.go:175-176 |
| 5.2 | Port exposed to 0.0.0.0 | MEDIUM | compose.yml:12-13 |
| 6.2 | PR body shell injection | MEDIUM | pr-description-lint.yml:31-38 |
| 3.4 | CORS any loopback port | LOW | router.go:303-327 |
| 4.2 | Subprocess env inheritance | LOW | command_runner.go:109 |

---

## 9. Recommended Priority

1. **Immediate:** Enable sandbox unconditionally, add CSP headers, add security response headers, fix PR body injection
2. **Next sprint:** Whitelist env vars, validate IPC inputs, enforce token encryption, add OAuth rate limiting
3. **Backlog:** Replace query param token auth, add audit logging, enforce HTTPS in production, restrict CORS ports
