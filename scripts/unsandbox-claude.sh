#!/bin/bash
# unsandbox-claude: Run Claude Code on an unsandbox container
#
# Bootstraps Claude credentials from local ~/.claude/.credentials.json
# into the container, then executes claude -p with the given prompt.
#
# Usage:
#   ./scripts/unsandbox-claude.sh "what OS is this"
#   ./scripts/unsandbox-claude.sh --account 3 "read /etc/os-release"
#   ./scripts/unsandbox-claude.sh --timeout 300 "run the test suite"
#
# Requires:
#   ~/.unsandbox/accounts.csv   (unsandbox API keys: pk,sk per line)
#   ~/.claude/.credentials.json (Claude OAuth credentials)

set -euo pipefail

CREDS_FILE="$HOME/.claude/.credentials.json"
CREDS_MD5_FILE="$HOME/.claude/.unsandbox-creds-md5"
ACCOUNT_INDEX=2
TIMEOUT=120

# Parse args
PROMPT=""
while [ $# -gt 0 ]; do
    case "$1" in
        --account) ACCOUNT_INDEX="$2"; shift 2 ;;
        --timeout) TIMEOUT="$2"; shift 2 ;;
        *) PROMPT="$1"; shift ;;
    esac
done

if [ -z "$PROMPT" ]; then
    echo "Usage: $0 [--account N] [--timeout S] \"prompt\"" >&2
    exit 1
fi

# Check credentials exist
if [ ! -f "$CREDS_FILE" ]; then
    echo "Error: $CREDS_FILE not found. Run 'claude /login' first." >&2
    exit 1
fi

# Detect credential rotation
CURRENT_MD5=$(md5sum "$CREDS_FILE" | awk '{print $1}')
if [ -f "$CREDS_MD5_FILE" ]; then
    PREV_MD5=$(cat "$CREDS_MD5_FILE")
    if [ "$CURRENT_MD5" != "$PREV_MD5" ]; then
        echo "Note: credentials rotated (md5 changed)" >&2
    fi
fi
echo "$CURRENT_MD5" > "$CREDS_MD5_FILE"

# Read unsandbox API key from accounts.csv
PK=$(sed -n "$((ACCOUNT_INDEX + 1))p" ~/.unsandbox/accounts.csv | cut -d, -f1)
SK=$(sed -n "$((ACCOUNT_INDEX + 1))p" ~/.unsandbox/accounts.csv | cut -d, -f2)

if [ -z "$PK" ] || [ -z "$SK" ]; then
    echo "Error: account $ACCOUNT_INDEX not found in ~/.unsandbox/accounts.csv" >&2
    exit 1
fi

# Base64 encode credentials (single line, no wrapping)
CREDS_B64=$(base64 -w0 < "$CREDS_FILE")

# Escape single quotes in prompt for bash embedding
ESCAPED_PROMPT=$(echo "$PROMPT" | sed "s/'/'\\\\''/g")

# Build bootstrap code — umask 077 per unsandbox threat model
CODE=$(cat <<BASHEOF
umask 077
mkdir -p /root/.claude
chmod 700 /root/.claude
echo '$CREDS_B64' | base64 -d > /root/.claude/.credentials.json
chmod 600 /root/.claude/.credentials.json
export PYTHONUNBUFFERED=1
claude -p '$ESCAPED_PROMPT' --allowedTools Read,Bash,Grep,Glob --max-turns 10 2>&1
BASHEOF
)

# Sign request (HMAC-SHA256)
TS=$(date +%s)
BODY=$(python3 -c "
import json, sys
print(json.dumps({
    'language': 'bash',
    'code': sys.stdin.read(),
    'network_mode': 'semitrusted',
    'timeout': $TIMEOUT
}))
" <<< "$CODE")

MSG="${TS}:POST:/execute:${BODY}"
SIG=$(echo -n "$MSG" | openssl dgst -sha256 -hmac "$SK" | awk '{print $2}')

# Execute on unsandbox
RESULT=$(curl -s https://api.unsandbox.com/execute \
    -H "Authorization: Bearer $PK" \
    -H "X-Timestamp: $TS" \
    -H "X-Signature: $SIG" \
    -H "Content-Type: application/json" \
    -d "$BODY")

# Extract and print output
STDOUT=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('stdout',''))" 2>/dev/null || echo "")
STDERR=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('stderr',''))" 2>/dev/null || echo "")
EXIT_CODE=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('exit_code',1))" 2>/dev/null || echo "1")

if [ -n "$STDOUT" ]; then
    echo "$STDOUT"
fi
if [ -n "$STDERR" ]; then
    echo "$STDERR" >&2
fi
exit "$EXIT_CODE"
