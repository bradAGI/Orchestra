# Orchestra Deployment Runbook

## Prerequisites

- Go 1.25+ installed
- Node.js 20+ and npm installed
- SQLite available (bundled via `modernc.org/sqlite`)
- Git CLI installed on the host

## Backend (`orchestrad`)

### Build

```bash
cd apps/backend
go build -o orchestrad ./cmd/orchestrad
go build -o orchestra ./cmd/orchestra
```

### Configuration

All configuration is via environment variables or a `WORKFLOW.md` frontmatter file.

| Variable | Default | Description |
|---|---|---|
| `ORCHESTRA_SERVER_HOST` | `127.0.0.1` | Bind address |
| `ORCHESTRA_SERVER_PORT` | `4010` | HTTP port |
| `ORCHESTRA_WORKSPACE_ROOT` | `~/.orchestra/workspaces` | Workspace directory |
| `ORCHESTRA_API_TOKEN` | (empty) | Bearer token for API auth |
| `ORCHESTRA_LOG_FILE` | `~/.orchestra/orchestrad.log` | Log file path |
| `ORCHESTRA_TOKEN_KEY` | (empty) | AES key for GitHub token encryption at rest |
| `ORCHESTRA_AGENT_PROVIDER` | `codex` | Default agent provider |
| `ORCHESTRA_AGENT_MAX_TURNS` | `10` | Max agent turns per run |
| `ORCHESTRA_MAX_CONCURRENT` | `16` | Max concurrent agent runs |
| `ORCHESTRA_TRACKER_TYPE` | (empty) | Issue tracker type (`github`, `linear`, `memory`) |
| `ORCHESTRA_TRACKER_ENDPOINT` | (empty) | Tracker endpoint (e.g. `owner/repo`) |
| `ORCHESTRA_TRACKER_TOKEN` | (empty) | Tracker API token |
| `ORCHESTRA_GITHUB_CLIENT_ID` | (empty) | GitHub OAuth app client ID |
| `ORCHESTRA_GITHUB_CLIENT_SECRET` | (empty) | GitHub OAuth app client secret |
| `ORCHESTRA_WORKFLOW_FILE` | `WORKFLOW.md` | Path to workflow config file |

### Run

```bash
export ORCHESTRA_SERVER_PORT=4010
export ORCHESTRA_API_TOKEN=your-secret-token
./orchestrad
```

### Docker

```bash
# Build
docker build -f ops/docker/Dockerfile.backend -t orchestra-backend .

# Run
docker run -d \
  -p 4010:4010 \
  -v orchestra-data:/home/nonroot/.orchestra \
  -e ORCHESTRA_API_TOKEN=your-secret-token \
  -e ORCHESTRA_TOKEN_KEY=your-encryption-key \
  orchestra-backend
```

The Docker image runs as `nonroot:nonroot` and includes a health check on `/usr/local/bin/orchestra healthz`.

### Health Check

```bash
curl http://localhost:4010/healthz
# Expected: {"status":"ok"}
```

### Rate Limiting

The API enforces per-IP rate limiting at 20 requests/second with a burst of 60. Clients exceeding this receive HTTP 429 responses.

## Desktop App

### Development

```bash
cd apps/desktop
npm install
npm run dev
```

### Build for Distribution

```bash
cd apps/desktop
npm run dist:desktop
```

Output artifacts are placed in `apps/desktop/release/`.

### Smoke Tests

```bash
# Against a running backend
npm run smoke:ops

# Spawning the Go backend automatically
npm run smoke:ops:go
```

## TUI Dashboard

```bash
cd apps/tui
go build -o orchestra-dash .
./orchestra-dash
```

Press `s` to start/stop services, `Tab`/`1`/`2` to switch views, `f` to toggle log following, `q` to quit.

## Production Checklist

- [ ] Set `ORCHESTRA_API_TOKEN` to a strong random value
- [ ] Set `ORCHESTRA_TOKEN_KEY` for GitHub token encryption at rest
- [ ] Ensure `ORCHESTRA_LOG_FILE` points to a writable, rotated log path
- [ ] Configure firewall rules — `orchestrad` should not be exposed to the public internet
- [ ] Set up log rotation for the log file (e.g. `logrotate`)
- [ ] Monitor the `/healthz` endpoint
- [ ] Set `ORCHESTRA_MAX_CONCURRENT` appropriate to your machine's resources
- [ ] Back up the SQLite database at `~/.orchestra/orchestra.db` regularly

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `unauthorized` errors | Missing or wrong API token | Set `ORCHESTRA_API_TOKEN` in both backend and client config |
| `encrypted token found but ORCHESTRA_TOKEN_KEY is not set` | Encrypted tokens in DB but env var missing | Set `ORCHESTRA_TOKEN_KEY` to the same value used when tokens were stored |
| Port already in use | Another `orchestrad` instance running | `pgrep -af orchestrad` and kill the old process |
| Desktop app blank screen | Backend not reachable | Check backend URL in Settings, verify backend is running |
| GitHub sync fails silently | Token expired or insufficient scopes | Re-authenticate via Settings -> GitHub, ensure `repo` scope |
