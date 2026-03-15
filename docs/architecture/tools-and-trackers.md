# Tools & Tracker Integration

In the Orchestra architecture, agents are not just text generators; they are active operators capable of interacting with the outside world through a controlled interface. The `tools` and `tracker` packages define these capabilities.

## The Tool Executor (`internal/tools`)

When an agent needs to perform an action (like looking up an issue or changing its state), it outputs a structured tool-call request. The `TrackerToolExecutor` parses this request, validates the schema, and routes it to the appropriate backend subsystem.

### Built-in System Tools

Currently, Orchestra injects the following core capabilities into every agent's context:

1.  **`tracker_query`**:
    *   **Purpose**: Allows the agent to query the tracker state machine.
    *   **Use Case**: An agent can ask "What are all the issues currently in the 'Review' state?" or "Get me the specific details for issue FETCH-12."
2.  **`update_issue`**:
    *   **Purpose**: Mutates the state of an issue in the tracker.
    *   **Use Case**: Once an agent finishes writing code, it calls `update_issue` with `{ "state": "Review", "assignee_id": "human-reviewer" }`. This signals the orchestrator that the turn is complete.
3.  **Issue History Audit**:
    -   **Purpose**: Records every change made to an issue's metadata.
    -   **Use Case**: The orchestrator automatically logs changes to `state` and `assignee` in a dedicated `issue_history` table, providing a permanent audit trail for agent sessions.

## The Tracker Client (`internal/tracker`)

The `TrackerToolExecutor` routes actions through the tracker client interface.

### Supported Backends

*   **SQLite Client**: The primary tracker backend using SQLite for issue storage and state management.
*   **Memory Client**: An in-memory implementation used for automated testing, ensuring the orchestrator can run entirely offline if needed.
*   **GitHub Client**: Syncs issues bidirectionally with GitHub repositories.

## Model Context Protocol (MCP)

MCP integration is implemented. Agents can dynamically discover and use external tools hosted on MCP servers. See the [MCP documentation](../architecture/overview.md) for details on server configuration and tool discovery.
