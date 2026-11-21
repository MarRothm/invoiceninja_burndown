# Research: Use Host Ollama Instance for the AI Dashboard

**Feature**: 006-host-ollama-instance | **Date**: 2026-11-21 (revised after clarification session)

**Target environment (verified)**:
- `macmini.local` runs macOS. It is the Docker host for the Portainer stack (port 6088) **and** runs the host Ollama.
- The host Ollama is v0.40.17 and answers on port 11434. It already accepts LAN connections.
- Installed models: `qwen3-vl:8b` only.

## R1 — How the `api` container reaches the host Ollama

**Decision**:
- The default `OLLAMA_URL` is `http://host.docker.internal:11434`, in both `docker-compose.yml` (`${OLLAMA_URL:-http://host.docker.internal:11434}`) and the code fallback in `api/src/services/ai-dashboard.js`.
- Add `extra_hosts: ["host.docker.internal:host-gateway"]` to the `api` service.

**Rationale**:
- On macOS, both Docker Desktop and OrbStack resolve `host.docker.internal` natively and forward it to the Mac itself, including services bound only to loopback. Traffic never leaves the machine.
- The `extra_hosts` entry does nothing on macOS. It keeps the same default working if the stack ever moves to a Linux Docker Engine (≥ 20.10), where the name doesn't exist unless it's mapped.
- Clarification Q2: the default must not depend on the LAN name or on mDNS.

**Alternatives considered**:
- `http://macmini.local:11434` as the default: rejected (Q2). It needs `.local` mDNS resolution inside containers, which isn't reliable in Docker on macOS, sends traffic out over the LAN interface, and breaks if the host is renamed. It is kept as a documented override example.
- `network_mode: host`: rejected. It breaks the `postgres`/`redis` service-name DNS and the external `invoiceninja` network.
- The README's current `http://host-gateway:11434`: rejected. `host-gateway` is only valid as an `extra_hosts` value, not as a hostname that resolves, so the README is fixed.

## R2 — Host Ollama network exposure

**Decision**: Leave the host's binding as it is: LAN-reachable (Q3). Record it in `SECURITY.md` as an accepted risk:
- **What's exposed**: an unauthenticated inference and model-management API, reachable by anyone on the LAN.
- **Control**: the private-network boundary (Principle I).
- **Optional hardening**: bind the host Ollama to loopback only (`launchctl setenv OLLAMA_HOST 127.0.0.1` or the Ollama app setting). The default address keeps working because `host.docker.internal` reaches the Mac's loopback.

**Rationale**: It's the user's decision. Other LAN clients may depend on the current binding. The feature mustn't change shared host configuration.

**Alternatives considered**: require loopback-only binding (rejected in Q3); stay silent about it (rejected: Principle I demands that accepted risks are acknowledged).

The earlier Linux-specific guidance is **removed** from this plan because it doesn't apply to the macOS target: Docker bridge-IP binding, systemd drop-in, UFW rule.

## R3 — Model provisioning and choice

**Decision**:
- The model stays `qwen2.5:7b` (Q1). The operator runs `ollama pull qwen2.5:7b` on macmini once, **before** redeploying the stack.
- The stack never pulls models. Delete `ollama/Dockerfile`, `ollama/entrypoint.sh`, the CI build step and the `ollama_data` volume.

**Rationale**:
- `qwen2.5:7b` has no thinking step, is reliable at strict output formats, and is what the system prompt was tuned and validated against.
- Benchmark on macmini (real system prompt and declaration, 5 projects): `qwen3-vl:8b` produced correct output but took 36.9 s, because of 1,151 completion tokens of which about 1,000 were hidden reasoning. That's over the 30 s generation timeout.

**Alternatives considered**:
- `qwen3-vl:8b` with thinking disabled per request: needs code changes and new validation. Out of scope.
- `qwen2.5:3b`: smaller and faster, but not tested.
- Auto-pull from the API: rejected (FR-004). The stack must not modify the shared host service.

## R4 — Status semantics: replace `pulling` with `model_missing`

**Decision**:
- `checkOllamaStatus()` returns `ready`, `model_missing` or `unavailable`.
- The model match is exact. A configured model without a tag is normalised to `:latest`, then compared against each entry's `name` or `model` in `GET /api/tags`. The current check only matches the family prefix, so `qwen3-vl:8b` would never match, but `qwen2.5:14b` would wrongly count as ready.
- A 404 from chat-completions ("model not found") is mapped to `AI_UNAVAILABLE` (503).

**Frontend changes**:
- `App.jsx` enables the toggle only on `ready`.
- `AIDashboard.jsx` shows a hint that fits the state: `ollama pull <model>` on the host for `model_missing`; "host Ollama not reachable at `OLLAMA_URL`" for `unavailable`. The obsolete `docker compose up -d ollama` hint is removed.
- `DashboardToggle` gets a tooltip for each state.

**Rationale**: FR-005 and the "model differs only by tag" edge case. `pulling` is misleading once nothing pulls.

**Alternatives considered**: keep `pulling` for compatibility. Rejected: the in-repo frontend is the only consumer.

## R5 — Recovery without restart

**Decision**: No change. The frontend already polls status every 15 s and reloads automatically when the status goes back to `ready` (FR-007).

## R6 — `/api/health`

**Decision**: Unchanged. The AI view is optional and must not make the core stack unhealthy. AI readiness stays visible through `/api/ai-dashboard/status` and `/debug` (`ollamaUrl`, FR-008).

## R7 — Testing

**Decision**: Add a new file `api/tests/ai-dashboard.test.js` with unit tests for `checkOllamaStatus()`. They stub `global.fetch` and cover these cases:
- exact match → `ready`
- only `qwen3-vl:8b` present → `model_missing`
- only `qwen2.5:14b` present → `model_missing`
- untagged model vs. `:latest` → `ready`
- non-OK response → `unavailable`
- fetch throws → `unavailable`

Also extend `routes.test.js` so `/api/ai-dashboard/status` is checked to return `model_missing`.

Manual validation on macmini follows `quickstart.md`.
