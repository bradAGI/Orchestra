# Contract Ownership

This note defines which artifact is authoritative for each protocol surface.

## Source Of Truth

- JSON Schema is the source of truth for JSON request and response payloads.
- OpenAPI should be derived from the JSON-backed API contracts and route inventory.
- Handler code must serialize payloads that match the canonical JSON schemas.
- Desktop TypeScript types should be generated from or aligned directly to canonical schemas.

## Special Cases

Not every route is best modeled as a plain JSON Schema request/response pair.

### OpenAPI Document

`/api/v1/openapi.yaml` serves a document artifact, not a regular JSON payload. It should be tracked as generated documentation derived from the route inventory and canonical schemas.

### Server-Sent Events

`/api/v1/events` should be documented as an event protocol:

- event names
- envelope shape
- snapshot payload shape
- incremental event payload shape

The JSON parts of event envelopes can still reuse schemas, but the stream itself needs its own protocol doc.

### Terminal WebSocket

`/api/v1/terminal/{session_id}` should be treated as a bidirectional protocol, not a REST response. Document:

- auth requirements
- connection query parameters
- client message types such as `resize`
- server frame behavior
- binary vs text frame expectations

## Consequences

- Do not force websocket or SSE behavior into ordinary REST schema files.
- Add protocol docs for streaming endpoints alongside JSON schemas.
- Keep route docs explicit about whether a route is JSON, redirect, SSE, websocket, multipart, or document delivery.
