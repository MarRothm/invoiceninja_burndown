# Research: OpenUI AI-Generated Dashboard

**Feature**: 002-openui-ai-dashboard
**Date**: 2026-06-02

---

## Decision 1: openUI SDK + Ollama Compatibility

**Decision**: Use `@openuidev/react-lang` in the frontend (parser + renderer). SSE
streaming is handled by the native browser `EventSource` API via a custom `fetchAIDashboard`
helper. Connect to Ollama via Fastify using Ollama's OpenAI-compatible endpoint
(`/v1/chat/completions`). The API acts as the AI proxy — the browser never calls Ollama
directly.

**Rationale**: openUI's SDK provides the authoritative openUI Lang parser and renderer.
`@openuidev/react-headless` (originally planned for streaming state management) is not
needed — the `EventSource` + React `useState` pattern is simpler and has no additional
dependencies. Ollama exposes `/v1/chat/completions` with SSE at `http://ollama:11434`.
Routing through Fastify satisfies Constitution Principle III and keeps Ollama off the
public network.

**Alternatives considered**:
- Direct browser → Ollama: violates Principle III (layer bypass); exposes Ollama port.
- `@openuidev/react-headless` for streaming: adds a dependency for functionality already
  covered by `EventSource`; removed during implementation.
- Custom OpenUI Lang parser without the SDK: significant implementation effort; SDK is
  the authoritative parser for the streaming DSL.

---

## Decision 2: Streaming Transport — Server-Sent Events (SSE)

**Decision**: The Fastify `/api/ai-dashboard` endpoint uses SSE (`text/event-stream`) to
stream openUI Lang tokens from Ollama to the browser. The frontend `AIDashboard` component
consumes the stream using the EventSource API (or `fetch` with `ReadableStream`).

**Rationale**: SSE is unidirectional (server → client), which matches the generation
pattern perfectly. It works over HTTP/1.1 (no WebSocket upgrade needed), is supported by
Nginx without additional configuration, and integrates naturally with React's `useEffect`
+`useState` streaming pattern. Fastify supports SSE via `reply.raw` with
`Content-Type: text/event-stream`.

**Alternatives considered**:
- WebSockets: bidirectional, more complex to implement; overkill for one-way streaming.
- Long-polling: high latency; poor progressive rendering experience.

---

## Decision 3: In-Memory Cache with Declaration Hash

**Decision**: The Fastify AI dashboard service maintains a module-level `Map`:
`{ declarationHash → layoutString }`. On each `/api/ai-dashboard` request:
1. Read `dashboard.declaration.md` from disk.
2. Compute SHA-256 of its content.
3. If hash matches cached entry: return cached layout as a single SSE event (instant).
4. If hash differs (or cache empty): stream from Ollama, accumulate full response,
   store in Map under new hash, invalidate old entry.

**Rationale**: The ephemeral in-memory Map requires no new infrastructure (no Redis
writes for this feature). Keying on a content hash is simpler and more correct than
file mtime (handles copy/paste edits that don't change mtime). The cache holds at most
one entry (the current declaration's layout).

**Alternatives considered**:
- Redis cache: persistent across restarts but adds infrastructure for a non-critical
  optimisation; deferred to future iteration if persistence becomes required.
- File-based cache: adds disk I/O and cleanup logic; unnecessary complexity.

---

## Decision 4: Ollama Auto-Pull via Custom Entrypoint

**Decision**: A custom `ollama/entrypoint.sh` script is used as the Docker entrypoint for
the Ollama container. It:
1. Starts `ollama serve` in the background.
2. Waits until `/api/tags` returns HTTP 200 (model server is ready).
3. Checks if `qwen2.5:7b` is already present (`ollama list`).
4. If not present: runs `ollama pull qwen2.5:7b` (blocks until complete).
5. Foregrounds the serve process.

A named Docker volume (`ollama_data`) at `/root/.ollama` persists downloaded models
across container restarts, so the pull only happens once.

**Rationale**: The `ollama/ollama` image starts the server but does not auto-pull models.
A custom entrypoint is the standard pattern for Ollama in Docker Compose stacks. Using
`ollama serve` with a readiness wait avoids race conditions where the pull fires before
the server is ready.

**Alternatives considered**:
- Dockerfile with `RUN ollama pull`: would embed the 5 GB model in the image layer;
  impractical.
- README instruction to manually pull: violates SC-006 (no manual steps).
- Init container: more complex orchestration than a simple entrypoint script.

---

## Decision 5: openUI Component Registration and XSS Safety

**Decision**: Components are registered in `frontend/src/components/ai/components.js`
using `@openuidev/react-lang`'s component registry API. The registry maps component
names (`ProjectCard`, `BurndownChart`, `StatusBadge`) to their React implementations.
The openUI renderer only instantiates registered components; unrecognised tags in the
model output are silently ignored (FR-004, SC-005).

This architecture is XSS-safe: the browser never evaluates arbitrary HTML from the model.
The model output is parsed as openUI Lang tokens — a structured DSL, not raw HTML — and
the renderer constructs React elements from the registry.

**Rationale**: openUI's core value proposition is this safety boundary. It is the
technically correct solution to the sandboxing concern deferred from `/speckit-clarify`.

**Alternatives considered**:
- Raw HTML generation + `dangerouslySetInnerHTML` + sanitisation: fragile; DOMPurify
  cannot safely allow interactive React components.
- Iframe sandbox: isolates but prevents sharing React context, theme, and data hooks.

---

## Decision 6: Declaration File Location, Loading, and Runtime Updates

**Decision**: The declaration file lives at `api/dashboard.declaration.md` and is baked
into the API container image at build time via `COPY dashboard.declaration.md ./`. A
named Docker volume (`api_data`) mounted at `/app/data` in the API container acts as a
runtime override layer: `readDeclaration()` checks `/app/data/dashboard.declaration.md`
first; if absent it falls back to the baked-in copy. A `PUT /api/ai-dashboard/declaration`
endpoint writes to the data volume and invalidates the cache, so operators can update the
declaration without any image rebuild.

**Rationale**: Portainer bind mounts failed in practice — Docker created a directory at
the mount path when the source file did not exist, making the container refuse to start.
Baking the file into the image ensures a reliable default; the named volume + PUT endpoint
provides a rebuild-free runtime override path (fulfilling FR-005 / SC-004). The API
service reads the file (not the frontend), so the prose stays server-side and is not
exposed to browsers as a static asset.

**Alternatives considered**:
- Repository-root location with bind mount: Portainer-incompatible (directory vs. file
  mount conflict); abandoned after repeated deployment failures.
- `DASHBOARD_DECLARATION` env var: rejected by operator preference ("env should not have
  that much content").
- `frontend/public/` (static asset): exposes declaration to end users; leaks prompt
  engineering.
- Database-stored declaration: over-engineering for a single config file.

---

## Summary of Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| openUI + Ollama compatibility | Via OpenAI-compatible `/v1/chat/completions`; proxied through Fastify |
| Streaming transport | SSE (`text/event-stream`) from Fastify; native `EventSource` in browser |
| Cache implementation | In-memory object, keyed on SHA-256 of declaration content |
| Ollama model auto-pull | Custom `entrypoint.sh` + named volume for persistence |
| XSS / component sandboxing | openUI component registry; arbitrary tags silently ignored |
| Declaration file location | `api/dashboard.declaration.md` baked into image; runtime override via `api_data` volume + `PUT /api/ai-dashboard/declaration` |
