# Streaming Protocol Plan

This plan expands the streaming standards into implementation work.

## SSE Plan

### Deliverables

- document event names
- define event envelope schema fragments
- define snapshot payload reuse from canonical `StateSnapshot`
- add examples for `snapshot` and one incremental event

### Standard

- `snapshot` is a first-class event type
- every event has `type`, `timestamp`, and `data`
- event names are stable protocol identifiers
- event `data` may be event-specific, but must be documented

### Next Steps

1. inspect `observability.Event` producers
2. list actual event names in use
3. create `common/event-summary` and related event schema fragments
4. document SSE examples in `docs/api/sse-events.md`

## Terminal WebSocket Plan

### Deliverables

- client control message definition
- auth and origin rules
- output frame behavior
- issue-session filtering notes

### Standard

- control messages are JSON objects with explicit `type`
- raw terminal input remains allowed for PTY passthrough
- binary output frames are documented as transport behavior, not arbitrary JSON payloads

### Next Steps

1. document the `resize` message formally
2. decide whether additional control messages are planned
3. document binary output semantics and auth/query parameters
4. add protocol examples next to backend terminal docs
