# Research: OpenUI AI-Generated Dashboard

**Feature**: 002-openui-ai-dashboard
**Date**: 2026-06-02

---

## Decision 1: openUI SDK + Ollama Compatibility

**Decision**: Use `@openuidev/react-lang` and `@openuidev/react-headless` in the frontend.
Connect them to Ollama via the Fastify API using Ollama's OpenAI-compatible endpoint
(`/v1/chat/completions`). The API acts as the AI proxy — the browser never calls Ollama
directly.

**Rationale**: openUI's SDK communicates through any OpenAI-compatible streaming endpoint.
Ollama exposes `/v1/chat/completions` with SSE streaming at `http://ollama:11434`. Routing
the request through Fastify (rather than directly from the browser) satisfies Constitution
Principle III and keeps Ollama off the public network.

**Alternatives considered**:
- Direct browser → Ollama: violates Principle III (layer bypass); exposes Ollama port.
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

## Decision 6: Declaration File Location and Loading

**Decision**: The declaration file is `dashboard.declaration.md` at the repository root.
It is read at runtime by the Fastify API service (filesystem access within the container)
via `fs.readFile`. The file is `COPY`-ed into the API container image at build time, and
also available via a bind mount during development (so edits take effect without rebuild).

**Rationale**: Placing it at the project root makes it immediately visible to operators.
The API service reads it (not the frontend), so the prose is kept server-side and not
exposed to the browser as a static asset. This also avoids Vite treating it as a build
asset.

**Alternatives considered**:
- `frontend/public/dashboard.declaration.md` (static asset): exposes declaration to
  anyone who can reach the frontend; leaks prompt engineering to end users.
- Database-stored declaration: over-engineering for a single config file.

---

## Summary of Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| openUI + Ollama compatibility | Via OpenAI-compatible `/v1/chat/completions`; proxied through Fastify |
| Streaming transport | SSE (`text/event-stream`) from Fastify; EventSource in browser |
| Cache implementation | In-memory Map, keyed on SHA-256 of declaration content |
| Ollama model auto-pull | Custom `entrypoint.sh` + named volume for persistence |
| XSS / component sandboxing | openUI component registry; arbitrary tags silently ignored |
| Declaration file location | `dashboard.declaration.md` at repo root; read by API at runtime |
