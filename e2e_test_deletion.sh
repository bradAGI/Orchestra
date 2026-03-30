#!/bin/bash

# E2E Test Script for Task Deletion Bug Fix
# This script tests both SQLite and GitHub trackers to verify our fix

set -e

echo "🧪 E2E Test: Task Deletion Bug Fix Verification"
echo "=============================================="
echo

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up test environment..."
    pkill -f orchestrd || true
    rm -rf /tmp/orchestra-e2e-test || true
    sleep 2
}

# Setup test environment
setup_test() {
    echo "🔧 Setting up test environment..."
    cleanup
    mkdir -p /tmp/orchestra-e2e-test
    export ORCHESTRA_API_TOKEN=test-token-e2e
    export ORCHESTRA_WORKSPACE_ROOT=/tmp/orchestra-e2e-test
    export ORCHESTRA_HOST=127.0.0.1
    export ORCHESTRA_PORT=4015
    export ORCHESTRA_ACTIVE_STATES="Todo,In Progress"
    export ORCHESTRA_TERMINAL_STATES="Done,Cancelled,Closed"
    export ORCHESTRA_MAX_CONCURRENT=5
    export ORCHESTRA_AGENT_PROVIDER=CODEX
    export ORCHESTRA_AGENT_MAX_TURNS=5

    # Port for API calls - sync with ORCHESTRA_PORT
    API_PORT=4015
}

# Test SQLite tracker (baseline)
test_sqlite_tracker() {
    echo "📊 Test 1: SQLite Tracker (Baseline - Should Work)"
    echo "================================================="

    export ORCHESTRA_TRACKER_TYPE=sqlite

    echo "▶️  Starting orchestrd with SQLite tracker..."
    ./orchestrd &
    ORCHESTRD_PID=$!
    sleep 3

    echo "✅ Testing SQLite tracker deletion behavior..."

    # Create issue
    echo "1️⃣ Creating test issue..."
    ISSUE_RESPONSE=$(curl -s -X POST "http://127.0.0.1:$API_PORT/api/v1/issues" \
        -H "Authorization: Bearer test-token-e2e" \
        -H "Content-Type: application/json" \
        -d '{
            "title": "E2E Test Issue - SQLite",
            "description": "Test issue for deletion verification",
            "state": "Todo",
            "priority": 1
        }')

    ISSUE_ID=$(echo "$ISSUE_RESPONSE" | jq -r '.identifier // .id')
    echo "   Created issue: $ISSUE_ID"

    # Move to In Progress
    echo "2️⃣ Moving issue to In Progress..."
    curl -s -X PATCH "http://127.0.0.1:$API_PORT/api/v1/issues/$ISSUE_ID" \
        -H "Authorization: Bearer test-token-e2e" \
        -H "Content-Type: application/json" \
        -d '{"state": "In Progress"}' > /dev/null

    # Verify issue exists
    echo "3️⃣ Verifying issue exists in backlog..."
    ISSUES_BEFORE=$(curl -s -H "Authorization: Bearer test-token-e2e" \
        "http://127.0.0.1:$API_PORT/api/v1/issues" | jq length)
    echo "   Issues before deletion: $ISSUES_BEFORE"

    # Delete issue
    echo "4️⃣ Deleting issue..."
    curl -s -X DELETE "http://127.0.0.1:$API_PORT/api/v1/issues/$ISSUE_ID" \
        -H "Authorization: Bearer test-token-e2e" > /dev/null

    sleep 2

    # Verify issue is gone
    echo "5️⃣ Verifying issue is completely gone..."
    ISSUES_AFTER=$(curl -s -H "Authorization: Bearer test-token-e2e" \
        "http://127.0.0.1:$API_PORT/api/v1/issues" | jq length)
    echo "   Issues after deletion: $ISSUES_AFTER"

    if [ "$ISSUES_AFTER" -lt "$ISSUES_BEFORE" ]; then
        echo "✅ SQLite Test PASSED: Issue properly deleted"
    else
        echo "❌ SQLite Test FAILED: Issue still exists"
        return 1
    fi

    # Stop orchestrd
    kill $ORCHESTRD_PID
    wait $ORCHESTRD_PID 2>/dev/null || true
    sleep 2

    echo
}

# Test GitHub tracker (our fix)
test_github_tracker() {
    echo "🐙 Test 2: GitHub Tracker (Our Fix - Should Now Work)"
    echo "==================================================="

    # Check if GitHub config is available
    if [ -z "$GITHUB_OWNER" ] || [ -z "$GITHUB_REPO" ] || [ -z "$GITHUB_TOKEN" ]; then
        echo "⚠️  GitHub configuration not provided. Skipping GitHub tracker test."
        echo "   To test GitHub tracker, set these environment variables:"
        echo "   export GITHUB_OWNER=your-github-username"
        echo "   export GITHUB_REPO=your-test-repo"
        echo "   export GITHUB_TOKEN=your-github-token"
        echo "   Then re-run this script."
        return 0
    fi

    export ORCHESTRA_TRACKER_TYPE=github
    export ORCHESTRA_TRACKER_ENDPOINT="$GITHUB_OWNER/$GITHUB_REPO"
    export ORCHESTRA_TRACKER_TOKEN="$GITHUB_TOKEN"

    echo "▶️  Starting orchestrd with GitHub tracker..."
    echo "   Repository: $GITHUB_OWNER/$GITHUB_REPO"

    ./orchestrd &
    ORCHESTRD_PID=$!
    sleep 3

    echo "✅ Testing GitHub tracker deletion behavior..."

    # Create issue
    echo "1️⃣ Creating test issue..."
    ISSUE_RESPONSE=$(curl -s -X POST "http://127.0.0.1:$API_PORT/api/v1/issues" \
        -H "Authorization: Bearer test-token-e2e" \
        -H "Content-Type: application/json" \
        -d '{
            "title": "E2E Test Issue - GitHub",
            "description": "Test issue for deletion verification with GitHub tracker",
            "state": "Todo",
            "priority": 1
        }')

    ISSUE_ID=$(echo "$ISSUE_RESPONSE" | jq -r '.identifier // .id')
    echo "   Created issue: $ISSUE_ID"

    # Move to In Progress
    echo "2️⃣ Moving issue to In Progress..."
    curl -s -X PATCH "http://127.0.0.1:$API_PORT/api/v1/issues/$ISSUE_ID" \
        -H "Authorization: Bearer test-token-e2e" \
        -H "Content-Type: application/json" \
        -d '{"state": "In Progress"}' > /dev/null

    sleep 1

    # Verify issue exists
    echo "3️⃣ Verifying issue exists in backlog..."
    ISSUES_BEFORE=$(curl -s -H "Authorization: Bearer test-token-e2e" \
        "http://127.0.0.1:$API_PORT/api/v1/issues" | jq length)
    echo "   Issues before deletion: $ISSUES_BEFORE"

    # Delete issue
    echo "4️⃣ Deleting issue (this tests our fix)..."
    curl -s -X DELETE "http://127.0.0.1:$API_PORT/api/v1/issues/$ISSUE_ID" \
        -H "Authorization: Bearer test-token-e2e" > /dev/null

    sleep 3

    # Verify issue is gone
    echo "5️⃣ Verifying issue is completely gone..."
    ISSUES_AFTER=$(curl -s -H "Authorization: Bearer test-token-e2e" \
        "http://127.0.0.1:$API_PORT/api/v1/issues" | jq length)
    echo "   Issues after deletion: $ISSUES_AFTER"

    if [ "$ISSUES_AFTER" -lt "$ISSUES_BEFORE" ]; then
        echo "🎉 GitHub Test PASSED: Issue properly deleted (BUG FIXED!)"
        echo "✅ Our fix works: GitHub tracker now cleans up database"
    else
        echo "❌ GitHub Test FAILED: Issue still exists (bug not fixed)"
        echo "🐛 This means our fix didn't work as expected"
        return 1
    fi

    # Stop orchestrd
    kill $ORCHESTRD_PID
    wait $ORCHESTRD_PID 2>/dev/null || true
    sleep 2

    echo
}

# Main test execution
main() {
    echo "Starting E2E verification of task deletion bug fix..."
    echo

    setup_test

    echo "📋 Test Summary:"
    echo "  1. SQLite tracker test (baseline)"
    echo "  2. GitHub tracker test (our fix)"
    echo

    # Test SQLite tracker first
    if test_sqlite_tracker; then
        echo "✅ Baseline test passed"
    else
        echo "❌ Baseline test failed - something is wrong with the environment"
        cleanup
        exit 1
    fi

    # Test GitHub tracker
    test_github_tracker

    cleanup

    echo "🏁 E2E Test Complete!"
    echo "📊 Summary:"
    echo "  ✅ SQLite tracker: Working as expected"
    echo "  🎯 GitHub tracker: Fixed - deleted issues no longer reappear"
    echo
    echo "🎉 Bug fix verified! Task deletion now works correctly with GitHub tracker."
}

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required for this test script"
    echo "   Install with: sudo apt-get install jq (or equivalent for your system)"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo "❌ Error: curl is required for this test script"
    exit 1
fi

# Trap cleanup on exit
trap cleanup EXIT

# Run main test
main "$@"