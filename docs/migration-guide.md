# Orchestra Migration Guide

This guide covers schema migrations, workspace migrations, and upgrading between Orchestra versions.

## SQLite Schema Migrations

Orchestra uses automatic schema migrations that run on startup. The migration system in `apps/backend/internal/db/migrate.go` safely adds new columns to existing tables using `PRAGMA table_info()` checks.

### How It Works

1. On startup, `runMigrations(db)` is called after the base schema is applied.
2. Each migration checks if a column already exists before attempting `ALTER TABLE`.
3. Migrations are idempotent — running them multiple times is safe.
4. Errors during migration halt startup with a descriptive error message.

### Current Migrations

| Table | Column | Type | Purpose |
|---|---|---|---|
| `issues` | `priority` | `INTEGER DEFAULT 0` | Issue priority ranking |
| `issues` | `project_id` | `TEXT DEFAULT ''` | Link issue to project |
| `issues` | `provider` | `TEXT DEFAULT ''` | Agent provider override |
| `issues` | `url` | `TEXT DEFAULT ''` | External URL (e.g. GitHub issue link) |
| `issues` | `disabled_tools` | `TEXT DEFAULT ''` | Comma-separated disabled tool names |
| `projects` | `github_owner` | `TEXT DEFAULT ''` | GitHub repository owner |
| `projects` | `github_repo` | `TEXT DEFAULT ''` | GitHub repository name |
| `projects` | `github_token` | `TEXT DEFAULT ''` | GitHub auth token (encrypted if `ORCHESTRA_TOKEN_KEY` set) |
| `sessions` | `session_uuid` | `TEXT DEFAULT ''` | External session UUID |
| `sessions` | `model` | `TEXT DEFAULT ''` | ML model used |
| `sessions` | `branch` | `TEXT DEFAULT ''` | Git branch name |
| `runs` | `session_id` | `TEXT DEFAULT ''` | Link run to telemetry session |

### Manual Migration

If you need to manually inspect or modify the database:

```bash
sqlite3 ~/.orchestra/orchestra.db

-- Check current schema
.schema issues
.schema projects
.schema sessions

-- Verify a column exists
PRAGMA table_info(issues);
```

### Backup Before Upgrade

Always back up the database before upgrading Orchestra:

```bash
cp ~/.orchestra/orchestra.db ~/.orchestra/orchestra.db.backup-$(date +%Y%m%d)
```

## Workspace Migration

Orchestra supports migrating workspaces between different root directories. This is useful when:

- Moving to a new machine
- Reorganizing your workspace layout
- Switching between local and network storage

### Via API

```bash
# Preview the migration plan
curl "http://localhost:4010/api/v1/workspace/migration/plan?from=/old/path&to=/new/path" \
  -H "Authorization: Bearer $TOKEN"

# Execute the migration
curl -X POST "http://localhost:4010/api/v1/workspace/migrate?from=/old/path&to=/new/path" \
  -H "Authorization: Bearer $TOKEN"
```

### Via Desktop App

1. Go to **Settings**
2. Scroll to **Workspace Migration**
3. Enter the source and destination paths
4. Click **Preview Plan** to see what will be moved
5. Click **Apply** to execute

## GitHub Token Encryption

Starting with the current version, GitHub tokens can be encrypted at rest in the SQLite database.

### Enabling Encryption

Set the `ORCHESTRA_TOKEN_KEY` environment variable to any secret string:

```bash
export ORCHESTRA_TOKEN_KEY="my-secret-encryption-key"
```

### How It Works

- Tokens are encrypted with AES-256-GCM before being stored in the `github_token` column.
- Encrypted tokens are prefixed with `enc:v1:` to distinguish them from plaintext.
- Existing plaintext tokens continue to work (backward compatible).
- New tokens stored while `ORCHESTRA_TOKEN_KEY` is set will be encrypted.
- If `ORCHESTRA_TOKEN_KEY` is removed after tokens were encrypted, those tokens become unreadable. Set the variable back to the same value to restore access.

### Rotating the Key

1. Start Orchestra with the old key
2. Note which projects have GitHub connected (they will have tokens)
3. Disconnect GitHub from all projects (Settings -> project -> Disconnect)
4. Stop Orchestra
5. Change `ORCHESTRA_TOKEN_KEY` to the new value
6. Start Orchestra
7. Reconnect GitHub for each project

## Version Upgrade Steps

### General Upgrade

1. **Back up the database**: `cp ~/.orchestra/orchestra.db ~/.orchestra/orchestra.db.backup`
2. **Stop the running backend**: `pkill orchestrad` or stop the Docker container
3. **Build or pull the new version**
4. **Start the new backend** — migrations run automatically on startup
5. **Verify health**: `curl http://localhost:4010/healthz`
6. **Update the desktop app** if applicable

### Docker Upgrade

```bash
# Stop old container
docker stop orchestra-backend

# Pull/build new image
docker build -f ops/docker/Dockerfile.backend -t orchestra-backend .

# Start new container (data persisted in volume)
docker run -d \
  -p 4010:4010 \
  -v orchestra-data:/home/nonroot/.orchestra \
  -e ORCHESTRA_API_TOKEN=your-token \
  orchestra-backend
```

### Rollback

If the new version has issues:

1. Stop the new backend
2. Restore the database backup: `cp ~/.orchestra/orchestra.db.backup ~/.orchestra/orchestra.db`
3. Start the old version binary

Note: Schema migrations are forward-only (columns are added, never removed). Rolling back the binary while keeping a migrated database is generally safe — the old version simply ignores unknown columns.
