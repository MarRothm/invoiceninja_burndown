# Implementation Plan: Use Host Ollama Instance for the AI Dashboard

**Branch**: `006-host-ollama-instance` | **Date**: 2026-11-21 (revised after clarification) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-host-ollama-instance/spec.md`

## Summary

Drop the bundled `ollama` service (image, Dockerfile, entrypoint, CI build step, volume). Point the API at the Ollama that already runs on the Docker host, `macmini.local` (macOS).

- **Address**: the API reaches it through `http://host.docker.internal:11434`. This is the default, can be overridden through `OLLAMA_URL`, and `http://macmini.local:11434` is documented as an override example.
- **Model**: stays `qwen2.5:7b`; the operator pulls it once on the host.
- **Status states**: change from `ready | pulling | unavailable` to `ready | model_missing | unavailable`, with an exact model and tag match.
- **Frontend**: enables the AI toggle only on `ready` and shows hints aimed at the host instance.
- **Network exposure**: the host Ollama stays reachable from the LAN. This is documented as an accepted risk in `SECURITY.md`.

## Technical Context

- **Language/Version**: Node.js (ESM) for the API; React + Vite for the frontend.
- **Primary Dependencies**: Fastify, React, Docker Compose / Portainer. No new dependencies.
- **Storage**: N/A. The `ollama_data` volume is removed.
- **Testing**: Vitest (`api/tests/`), plus manual Docker validation on macmini (`quickstart.md`).
- **Target Platform**:
  - Production: `macmini.local`, a macOS Docker host running Portainer, with Ollama v0.40.17 on the same machine.
  - Development: Docker Desktop or OrbStack.
  - Linux Docker Engine ≥ 20.10 stays supported through `extra_hosts`.
- **Project Type**: Web application (api + frontend + compose stack).
- **Performance Goals**:
  - No regression in layout generation, which must finish within the existing 30 s timeout (SC-003). `qwen2.5:7b` has no thinking step and meets this.
  - `qwen3-vl:8b` was benchmarked at 36.9 s, so it was rejected.
  - The status check keeps its 3 s timeout.
- **Constraints**:
  - Non-AI features stay unaffected when Ollama is unavailable.
  - The stack must not change host Ollama configuration or models.
- **Scale/Scope**: One operator, one host. About 11 files changed and 2 deleted.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| I. Network-boundary security | The host Ollama is unauthenticated and reachable from the LAN. It is kept as is per clarification Q3 and acknowledged as an accepted risk in `SECURITY.md`, with loopback-only binding as optional hardening. The principle requires acknowledgement, not elimination. | ✅ |
| II. InvoiceNinja single source of truth | Untouched. | ✅ |
| III. One responsibility per service | One service removed. The API's responsibility is unchanged; only its upstream address changes. | ✅ |
| IV. Security hygiene | No new dependencies. One fewer image to patch. The accepted risk is documented in `SECURITY.md`. | ✅ |
| V. Simplicity & observable config | Simpler stack. `OLLAMA_URL` and `OLLAMA_MODEL` are documented in `.env.example`. `/api/health` is unchanged (research R6). | ✅ |
| Tech stack: "Container … no host dependencies" | **Deviation.** The optional AI feature now depends on Ollama running on the host. | ⚠️ Justified below |
| Workflow: README currency | The README is updated in the same change: services, env vars, AI section, the "Sharing Ollama" section (its wrong `host-gateway` URL is fixed), and the CI images table. | ✅ (task) |

**Gate result**: PASS, with one justified deviation.

**Post-design re-check**: PASS. The contract changes are limited to the status values and the 404 mapping. There's no new service, dependency or endpoint.

## Project Structure

### Documentation (this feature)

```text
specs/006-host-ollama-instance/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ai-dashboard-status.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
docker-compose.yml                   # remove ollama service + ollama_data volume; api: extra_hosts + OLLAMA_URL default
docker-compose.dev.yml               # remove ollama build override
ollama/Dockerfile                    # DELETE
ollama/entrypoint.sh                 # DELETE
.github/workflows/build-and-push.yml # remove "Build and push burndown-ollama" step
.env.example                         # OLLAMA_URL default host.docker.internal; macmini.local override example; model prerequisite
README.md                            # services, env vars, AI setup (ollama pull on host), sharing section, cleanup, CI images
SECURITY.md                          # accepted risk: unauthenticated LAN-reachable host Ollama; optional loopback hardening

api/src/services/ai-dashboard.js     # default URL; exact model match; 'model_missing'; 404 → AI_UNAVAILABLE
api/tests/ai-dashboard.test.js       # NEW: checkOllamaStatus unit tests
api/tests/routes.test.js             # status route returns model_missing

frontend/src/App.jsx                 # aiAvailable = status === 'ready'; pass model + status to AIDashboard
frontend/src/components/DashboardToggle.jsx   # per-state tooltip
frontend/src/components/ai/AIDashboard.jsx    # host-oriented unavailable / model_missing hints
frontend/src/hooks/api.js            # fallback status object unchanged (already 'unavailable')
```

**Structure decision**: Use the existing web-application layout (`api/`, `frontend/`, compose files at the root). No new modules.

## Implementation Notes

1. **Compose (`api` service)**:

   ```yaml
   extra_hosts:
     - "host.docker.internal:host-gateway"
   environment:
     OLLAMA_URL: ${OLLAMA_URL:-http://host.docker.internal:11434}
     OLLAMA_MODEL: ${OLLAMA_MODEL:-qwen2.5:7b}
   ```

   Also remove `ollama` from any `depends_on`. Today it isn't listed there.

2. **Exact model match**:

   ```js
   const norm = n => (n && !n.includes(':') ? `${n}:latest` : n);
   const want = norm(model);
   const present = models.some(m => norm(m.name) === want || norm(m.model) === want);
   return present ? 'ready' : 'model_missing';
   ```

3. **404 mapping** in `streamFromOllama`: `res.status === 503 || res.status === 404` → `AI_UNAVAILABLE`.
4. **Frontend copy**: use design tokens only (Principle V).
   - `model_missing`: "Model `<model>` not installed on host Ollama", with the hint `ollama pull <model>`.
   - `unavailable`: "Host Ollama not reachable", with a hint to check that Ollama is running on the Docker host.
5. **Rollout order on macmini**:
   1. Run `ollama pull qwen2.5:7b`.
   2. Merge to `master`.
   3. Run Portainer "Pull and redeploy" by hand.
   4. Remove the leftover `burndown_ollama` container and `ollama_data` volume (quickstart §5).
6. The `worker` service needs no Ollama configuration.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Host dependency (tech-stack row "no host dependencies") for the optional AI Dashboard | macmini already runs Ollama. A second bundled copy duplicates ~5 GB of model storage and RAM, plus model management (the feature's purpose). | Keeping the bundled container is exactly what the feature removes. The dependency is contained: only the optional AI view is affected, it degrades to `unavailable` or `model_missing`, and `OLLAMA_URL` can point anywhere. |
