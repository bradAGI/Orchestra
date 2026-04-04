# Streaming Contracts

This document tracks protocol work that should run alongside the schema refactor.

## SSE: `/api/v1/events`

Observed behavior:

- content type is `text/event-stream`
- always emits a `snapshot` event first
- supports `once=1` to send one snapshot and close
- emits incremental events using the pubsub event type as the SSE event name
- emits a new `snapshot` after each incremental event and every 5 seconds

Documentation work:

1. Define the canonical event envelope shape.
2. Define the `snapshot` payload using the canonical state schema.
3. Enumerate known event names from `observability.Event.Type`.
4. Decide whether event `data` is open-ended or type-specific per event name.

## WebSocket: `/api/v1/terminal/{session_id}`

Observed behavior:

- requires bearer auth when API auth is enabled
- accepts `project_id` query param
- reads raw text/binary input
- also accepts JSON control messages with `type`, `rows`, and `cols`
- currently supports at least `resize`
- streams PTY output back as websocket binary frames

Documentation work:

1. Define the client control message schema.
2. Define server frame expectations and filtering behavior for issue-scoped sessions.
3. Document auth modes and origin checks.
4. Decide whether terminal protocol docs belong under `docs/api/` or `docs/backend/terminal.md`.
