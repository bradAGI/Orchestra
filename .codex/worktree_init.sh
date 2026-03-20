#!/usr/bin/env bash
set -eo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
project_root="$repo_root"

cd "$project_root"

# Install backend dependencies
cd apps/backend && go mod download && cd "$project_root"

# Install frontend dependencies
cd apps/desktop && npm ci && cd "$project_root"
