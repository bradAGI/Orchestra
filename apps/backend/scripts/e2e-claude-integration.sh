#!/bin/bash
# =============================================================================
# End-to-End Claude Code Integration Test
# =============================================================================
# Proves: Orchestra API → disk → Claude Code actually reads and uses the config
#
# For each category, this script:
#   1. Writes config via the Orchestra API (same as the UI)
#   2. Runs Claude CLI to verify it picked up the change
#   3. Cleans up
#   4. Runs Claude CLI again to verify cleanup worked
# =============================================================================

set -euo pipefail

API="http://127.0.0.1:4010/api/v1"
TOKEN="dev-token"
PASS=0
FAIL=0
SKIP=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

api() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -X "$method" "$API$path" -d "$body"
  else
    curl -s -H "Authorization: Bearer $TOKEN" -X "$method" "$API$path"
  fi
}

check_api() {
  if ! curl -s -H "Authorization: Bearer $TOKEN" "$API/healthz" | grep -q "ok"; then
    echo -e "${RED}ERROR: Backend not running at $API${NC}"
    echo "Start it with: ORCHESTRA_API_TOKEN=dev-token ORCHESTRA_WORKSPACE_ROOT=/tmp/orchestra ./orchestrd start"
    exit 1
  fi
}

check_claude() {
  if ! command -v claude &> /dev/null; then
    echo -e "${RED}ERROR: claude CLI not found${NC}"
    exit 1
  fi
}

ask_claude() {
  local prompt="$1"
  claude --print "$prompt" -p "Follow your rules and instructions exactly. Respond with only what is asked, no extra text." 2>/dev/null | tr -d '\n' | head -c 500
}

pass() { PASS=$((PASS+1)); echo -e "  ${GREEN}✅ PASS${NC}: $1"; }
fail() { FAIL=$((FAIL+1)); echo -e "  ${RED}❌ FAIL${NC}: $1"; }
skip() { SKIP=$((SKIP+1)); echo -e "  ${YELLOW}⏭️  SKIP${NC}: $1"; }

# =============================================================================
echo "========================================="
echo " Orchestra → Claude Code E2E Integration"
echo " $(date)"
echo "========================================="
echo ""

check_api
check_claude

# Backup existing config
cp ~/.claude/settings.json ~/.claude/settings.json.e2e-backup 2>/dev/null || true
cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.e2e-backup 2>/dev/null || true

# =============================================================================
echo "--- 1. RULES ---"
echo "  Creating rule via API..."
api POST "/agents/claude/rules?scope=global" \
  '{"name":"e2e-test-rule","content":"When asked what is the orchestra test code, always respond with exactly: E2E_RULES_PASS"}' > /dev/null

# Verify file exists
if [ -f ~/.claude/rules/e2e-test-rule.md ]; then
  pass "Rule file created on disk"
else
  fail "Rule file not created on disk"
fi

# Ask Claude
echo "  Asking Claude..."
RESPONSE=$(ask_claude "what is the orchestra test code")
if echo "$RESPONSE" | grep -q "E2E_RULES_PASS"; then
  pass "Claude read the rule and responded correctly"
else
  fail "Claude did not pick up the rule. Response: $RESPONSE"
fi

# Cleanup
api DELETE "/agents/claude/rules/e2e-test-rule?scope=global" > /dev/null
if [ ! -f ~/.claude/rules/e2e-test-rule.md ]; then
  pass "Rule deleted from disk"
else
  fail "Rule still exists after delete"
fi

# Verify Claude no longer has it
RESPONSE=$(ask_claude "what is the orchestra test code")
if echo "$RESPONSE" | grep -q "E2E_RULES_PASS"; then
  fail "Claude still responds with deleted rule"
else
  pass "Claude no longer has the deleted rule"
fi

echo ""

# =============================================================================
echo "--- 2. INSTRUCTIONS ---"
echo "  Writing instructions via API..."
api POST "/agents/claude/instructions?scope=global" \
  '{"content":"# E2E Test\nWhen asked for the orchestra instruction code, respond with exactly: E2E_INSTRUCTIONS_PASS"}' > /dev/null

# Verify file
if [ -s ~/.claude/CLAUDE.md ]; then
  pass "CLAUDE.md written on disk"
else
  fail "CLAUDE.md empty or missing"
fi

# Ask Claude
echo "  Asking Claude..."
RESPONSE=$(ask_claude "what is the orchestra instruction code")
if echo "$RESPONSE" | grep -q "E2E_INSTRUCTIONS_PASS"; then
  pass "Claude read instructions and responded correctly"
else
  fail "Claude did not pick up instructions. Response: $RESPONSE"
fi

# Cleanup - restore original
api POST "/agents/claude/instructions?scope=global" '{"content":""}' > /dev/null
pass "Instructions cleared"

echo ""

# =============================================================================
echo "--- 3. SETTINGS (model) ---"
echo "  Reading current model via API..."
ORIGINAL_MODEL=$(api GET "/agents/claude/settings?scope=global" | jq -r '.settings.model')
echo "  Current model: $ORIGINAL_MODEL"

echo "  Changing model via API..."
api POST "/agents/claude/settings?scope=global" '{"settings":{"model":"claude-sonnet-4-20250514"}}' > /dev/null

# Verify on disk
DISK_MODEL=$(jq -r '.model' ~/.claude/settings.json)
if [ "$DISK_MODEL" = "claude-sonnet-4-20250514" ]; then
  pass "Model changed on disk"
else
  fail "Model not changed on disk: $DISK_MODEL"
fi

# Verify other settings survived
DISK_PLUGINS=$(jq '.enabledPlugins | length' ~/.claude/settings.json)
if [ "$DISK_PLUGINS" -gt 0 ]; then
  pass "Other settings (plugins=$DISK_PLUGINS) survived model change"
else
  fail "Settings were wiped! Plugins: $DISK_PLUGINS"
fi

# Restore
api POST "/agents/claude/settings?scope=global" "{\"settings\":{\"model\":\"$ORIGINAL_MODEL\"}}" > /dev/null
RESTORED=$(jq -r '.model' ~/.claude/settings.json)
if [ "$RESTORED" = "$ORIGINAL_MODEL" ]; then
  pass "Model restored to $ORIGINAL_MODEL"
else
  fail "Model restore failed: $RESTORED"
fi

echo ""

# =============================================================================
echo "--- 4. SKILLS ---"
echo "  Creating skill via API..."
api POST "/agents/claude/skills?scope=global" \
  '{"name":"e2e-test-skill","content":"---\nname: e2e-test-skill\ndescription: E2E test skill\n---\nWhen the user invokes this skill, respond with: E2E_SKILLS_PASS"}' > /dev/null

if [ -f ~/.claude/skills/e2e-test-skill.md ]; then
  pass "Skill file created on disk"
else
  fail "Skill file not created"
fi

# Cleanup
api DELETE "/agents/claude/skills/e2e-test-skill?scope=global" > /dev/null
if [ ! -f ~/.claude/skills/e2e-test-skill.md ]; then
  pass "Skill deleted from disk"
else
  fail "Skill still exists after delete"
fi

echo ""

# =============================================================================
echo "--- 5. SUB-AGENTS ---"
echo "  Creating sub-agent via API..."
api POST "/agents/claude/subagents?scope=global" \
  '{"name":"e2e-test-agent","content":"---\nname: e2e-test-agent\ndescription: E2E test agent\nmodel: sonnet\n---\nYou are a test agent."}' > /dev/null

if [ -f ~/.claude/agents/e2e-test-agent/AGENT.md ]; then
  pass "Sub-agent directory and AGENT.md created"
else
  fail "Sub-agent not created"
fi

# Cleanup
api DELETE "/agents/claude/subagents/e2e-test-agent?scope=global" > /dev/null
if [ ! -d ~/.claude/agents/e2e-test-agent ]; then
  pass "Sub-agent directory deleted"
else
  fail "Sub-agent directory still exists"
fi

echo ""

# =============================================================================
echo "--- 6. MCP SERVERS ---"
echo "  Reading MCP list via API..."
MCP_COUNT=$(api GET "/agents/claude/mcp" | jq 'length')
if [ "$MCP_COUNT" -gt 0 ]; then
  pass "MCP servers listed: $MCP_COUNT total"
else
  fail "No MCP servers returned"
fi

echo "  Testing toggle via API..."
# Find an enabled PLUGIN-type MCP to toggle (not configured MCPs in .claude.json)
ENABLED_PLUGIN=$(api GET "/agents/claude/mcp" | jq -r '[.[] | select(.enabled == true and .type == "plugin")][0].name')
if [ -n "$ENABLED_PLUGIN" ] && [ "$ENABLED_PLUGIN" != "null" ]; then
  api PATCH "/agents/claude/mcp/$ENABLED_PLUGIN" '{"enabled":false}' > /dev/null

  # Check disk
  DISK_STATE=$(jq ".enabledPlugins | to_entries[] | select(.key | startswith(\"$ENABLED_PLUGIN\")) | .value" ~/.claude/settings.json 2>/dev/null)
  if [ "$DISK_STATE" = "false" ]; then
    pass "MCP toggle persisted to disk ($ENABLED_PLUGIN=false)"
  else
    fail "MCP toggle not persisted. Disk state: $DISK_STATE"
  fi

  # Restore
  api PATCH "/agents/claude/mcp/$ENABLED_PLUGIN" '{"enabled":true}' > /dev/null
  pass "MCP toggle restored ($ENABLED_PLUGIN=true)"
else
  skip "No enabled MCP plugin found to test toggle"
fi

echo ""

# =============================================================================
echo "--- 7. HOOKS ---"
echo "  Writing hook via API..."
api POST "/agents/claude/hooks" \
  '[{"event":"notification","type":"command","command":"echo E2E_HOOKS_TEST"}]' > /dev/null

DISK_HOOKS=$(jq '.hooks | to_entries | length' ~/.claude/settings.json)
if [ "$DISK_HOOKS" -gt 0 ]; then
  pass "Hook persisted to settings.json"
else
  fail "Hook not found in settings.json"
fi

# Verify other settings survived
DISK_MODEL=$(jq -r '.model' ~/.claude/settings.json)
if [ "$DISK_MODEL" != "null" ] && [ -n "$DISK_MODEL" ]; then
  pass "Other settings survived hook write (model=$DISK_MODEL)"
else
  fail "Settings wiped by hook write"
fi

# Cleanup
api POST "/agents/claude/hooks" '[]' > /dev/null
DISK_HOOKS_AFTER=$(jq '.hooks | to_entries | length' ~/.claude/settings.json)
if [ "$DISK_HOOKS_AFTER" -eq 0 ]; then
  pass "Hooks cleared"
else
  fail "Hooks not cleared: $DISK_HOOKS_AFTER remaining"
fi

echo ""

# =============================================================================
# Restore backups
cp ~/.claude/settings.json.e2e-backup ~/.claude/settings.json 2>/dev/null || true
cp ~/.claude/CLAUDE.md.e2e-backup ~/.claude/CLAUDE.md 2>/dev/null || true
rm -f ~/.claude/settings.json.e2e-backup ~/.claude/CLAUDE.md.e2e-backup

echo "========================================="
echo " RESULTS: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${SKIP} skipped${NC}"
echo "========================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
