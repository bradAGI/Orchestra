# 6.2 Container Build

> **Source files:** `ops/docker/Dockerfile.backend`

Orchestra's backend is containerized using a multi-stage Docker build that produces a minimal, distroless image published to GitHub Container Registry (GHCR).

## 6.2.1 Dockerfile Stages

```mermaid
flowchart LR
    subgraph Stage1["Stage 1: build (golang:1.25)"]
        COPY_MOD[Copy go.mod + go.sum]
        MOD_DL[go mod download]
        COPY_SRC[Copy backend source]
        BUILD_D[Build orchestrad]
        BUILD_C[Build orchestra CLI]
    end

    subgraph Stage2["Stage 2: runtime (distroless)"]
        BIN_D["/usr/local/bin/orchestrad"]
        BIN_C["/usr/local/bin/orchestra"]
        ENV[Environment defaults]
        HC[Healthcheck]
        EP[ENTRYPOINT orchestrad]
    end

    COPY_MOD --> MOD_DL --> COPY_SRC --> BUILD_D --> BUILD_C
    BUILD_D --> BIN_D
    BUILD_C --> BIN_C
    BIN_D --> EP
    BIN_C --> HC
```

### Stage 1: Build

| Step | Command | Purpose |
|------|---------|---------|
| Base image | `golang:1.25` | Go build toolchain |
| Copy module files | `COPY apps/backend/go.mod apps/backend/go.sum` | Enable dependency caching |
| Download deps | `go mod download` | Cache module downloads in a separate layer |
| Copy source | `COPY apps/backend ./apps/backend` | Copy application source |
| Build orchestrad | `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/orchestrad ./cmd/orchestrad` | Static daemon binary |
| Build orchestra | `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/orchestra ./cmd/orchestra` | Static CLI binary |

### Stage 2: Runtime

| Setting | Value | Purpose |
|---------|-------|---------|
| Base image | `gcr.io/distroless/static-debian12` | Minimal attack surface, no shell |
| User | `nonroot:nonroot` | Non-root execution for security |
| Working directory | `/app` | Application root |
| Binaries | `/usr/local/bin/orchestrad`, `/usr/local/bin/orchestra` | Copied from build stage |

## 6.2.2 Build Arguments and Configuration

### Build-time Settings

| Setting | Value | Notes |
|---------|-------|-------|
| `CGO_ENABLED` | `0` | Static binary, no C dependencies |
| `GOOS` | `linux` | Target OS |
| `GOARCH` | `amd64` | Target architecture |

### Runtime Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `ORCHESTRA_SERVER_HOST` | `0.0.0.0` | Bind to all interfaces (required for container networking) |
| `ORCHESTRA_SERVER_PORT` | `4010` | HTTP API port |

### Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/usr/local/bin/orchestra", "check"]
```

The container health check uses the `orchestra check` CLI command, polled every 30 seconds with a 5-second startup grace period.

## 6.2.3 Registry Publishing

Container images are published to GHCR via the `orchestra-container-publish` workflow (see [Section 6.3](ci-cd.md)):

```mermaid
flowchart LR
    TAG["Git tag v*"] --> LOGIN[GHCR Login]
    LOGIN --> META[Extract metadata]
    META --> BUILD[docker build-push]
    BUILD --> GHCR["ghcr.io/owner/orchestra-backend"]
```

**Image coordinates:** `ghcr.io/<owner>/orchestra-backend`

**Tag strategies:**

| Pattern | Example | Use case |
|---------|---------|----------|
| Semver full | `1.2.3` | Pin to exact release |
| Semver minor | `1.2` | Track minor release line |
| SHA | `sha-abc1234` | Pin to exact commit |

### Pulling a Published Image

```bash
docker pull ghcr.io/<owner>/orchestra-backend:latest
docker run -d -p 4010:4010 ghcr.io/<owner>/orchestra-backend:latest
```

---

*Cross-references: [CI/CD Pipelines](ci-cd.md) (Section 6.3), [Configuration Guide](../guides/configuration.md) (Section 5.2), [Deployment](deployment.md) (Section 6.1)*
