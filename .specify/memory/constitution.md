<!--
Sync Impact Report
==================
Version change: [template] → 1.0.0 (initial ratification — all placeholders resolved)

Modified principles: N/A (first constitution, no prior version)

Added sections:
- Core Principles (I–V)
- Technology Stack
- Development Workflow
- Governance

Removed sections: N/A

Templates reviewed:
- .specify/templates/plan-template.md ✅ aligned (Constitution Check gate references principles)
- .specify/templates/spec-template.md ✅ aligned (no constitution-specific constraints to add)
- .specify/templates/tasks-template.md ✅ aligned (test discipline reflects Principle III)
- .specify/templates/constitution-template.md ✅ used as base

Deferred TODOs: none
-->

# Burndown Stack Constitution

## Core Principles

### I. Self-Hosted & Network-Boundary Security

This project is designed exclusively for private network or local deployment (Docker Compose,
Portainer). The API MUST NOT require built-in authentication — network isolation is the
security boundary. If exposed publicly, the operator MUST add an authentication layer (e.g.
HTTP Basic Auth via reverse proxy, VPN, or firewall rule) in front of the service. This
constraint MUST be documented wherever the deployment configuration is described.

**Rationale**: Simplicity for the self-hosted use case. Adding auth inside the service would
add complexity with no benefit when a proper network boundary (Traefik, VPN) already enforces
access control. Known accepted risks MUST be acknowledged, not silently ignored.

### II. InvoiceNinja Is the Single Source of Truth

All project and time-entry data MUST originate from the InvoiceNinja API via the sync worker.
Manual data entry or out-of-band modification of synced data is not permitted. The burndown
logic MUST derive from InvoiceNinja's `budgeted_hours` and time entries only. Retroactive
changes to time entries affect the entire history — snapshot locking is not implemented and
is not a planned concern.

**Rationale**: Data integrity depends on a single authoritative source. Diverging from the
InvoiceNinja data model increases maintenance cost and the risk of silent inconsistencies.

### III. Layered Service Architecture (One Responsibility Per Service)

Each service MUST have exactly one responsibility:
- **Worker**: Fetch from InvoiceNinja API → write to PostgreSQL. No business logic beyond sync.
- **PostgreSQL**: Persist project and time-entry data. No application logic.
- **Redis**: Cache API responses. No persistent state.
- **API (Fastify)**: Serve REST endpoints. No direct InvoiceNinja calls.
- **Frontend (React)**: Render burndown charts. No direct database access.
- **Nginx**: Serve the frontend SPA. No routing logic beyond static file serving.

Cross-layer calls that skip a service boundary are not permitted (e.g., frontend MUST NOT
query PostgreSQL directly).

**Rationale**: Clear boundaries make each service independently replaceable and testable.

### IV. Security Hygiene (Dependency Updates & Responsible Disclosure)

- The pentest CI workflow (`pentest.yml`) MUST pass on every pull request merge.
- Dependencies with high-severity CVEs MUST be patched before merging affected code.
- Vulnerabilities MUST be reported privately via GitHub Security Advisory — never via
  public issues.
- Accepted risks MUST be documented in `SECURITY.md`.

**Rationale**: Self-hosted tools running on operator infrastructure carry real risk. Keeping
dependencies updated and auditing them in CI catches issues before they reach production.

### V. Simplicity & Observable Configuration

- YAGNI: Features are not added speculatively. Every addition requires a demonstrated need.
- All runtime configuration MUST be driven by environment variables documented in `.env.example`.
- The API MUST expose a `/api/health` endpoint that reflects actual service readiness.
- Docker Compose MUST be the canonical local deployment method; Portainer is a supported
  overlay, not the primary target.
- The InvoiceNinja design system tokens (from `design.md`) MUST be used for all UI styling
  decisions — no ad-hoc color or typography values.

**Rationale**: Consistent configuration and observable health state reduce operational
surprises. Adhering to a shared design system avoids visual drift over time.

## Technology Stack

This stack is fixed for the current major version. Changes to a core technology require a
MAJOR version bump to the constitution.

| Layer | Technology | Version Policy |
|-------|-----------|----------------|
| API runtime | Node.js (ESM) + Fastify | Keep within major, patch CVEs promptly |
| Database | PostgreSQL | Managed via `init.sql`; schema migrations are sequential SQL files |
| Cache / Queue | Redis (ioredis) | Stateless — safe to wipe between deployments |
| Sync Worker | Node.js (cron via `node-cron`) | Interval configurable via `SYNC_INTERVAL_MINUTES` |
| Frontend | React + Recharts, bundled by Vite | Served as static SPA via Nginx |
| Container | Docker Compose / Portainer | Multi-stage Dockerfiles; no host dependencies |
| Testing (API) | Vitest | Unit and integration tests under `api/tests/` |
| Reverse proxy | Traefik (optional) | Labels in `docker-compose.yml`; removable without breaking core |
| Design system | InvoiceNinja tokens (`design.md`) | Normative for all frontend styling |

## Development Workflow

- **Branching**: Feature branches follow the `claude/feature-name-ID` convention observed in
  git history. PRs MUST target `master`.
- **CI gates**: Both `test.yml` (Vitest) and `pentest.yml` MUST be green before merging.
- **Spec Kit**: New features MUST have a spec (`/speckit-specify`), plan (`/speckit-plan`),
  and task list (`/speckit-tasks`) before implementation begins.
- **Docker-first validation**: UI and integration changes MUST be validated via
  `docker compose up -d --build` in a local environment before a PR is opened.
- **Commit hygiene**: Commits MUST reference the change scope (e.g., `fix:`, `feat:`,
  `docs:`). Co-author attribution for AI-assisted commits follows the Co-Authored-By
  convention.

## Governance

This constitution supersedes all informal practices. Amendments require:
1. A documented rationale explaining why the current principle is insufficient.
2. A version bump following semantic versioning rules (see below).
3. Updates to any template or documentation that references the amended section.

**Versioning policy**:
- MAJOR: Principle removed, redefined, or technology stack changed.
- MINOR: New principle or section added, or material guidance expansion.
- PATCH: Clarifications, wording, typo fixes, non-semantic refinements.

All PRs and reviews MUST verify compliance with the principle most relevant to the change
(e.g., security changes → Principle IV, new services → Principle III, UI changes → Principle V
design token rule). Violations MUST be justified in the Complexity Tracking section of
the plan before implementation proceeds.

Runtime development guidance: `CLAUDE.md` and `design.md` in the repository root.

**Version**: 1.0.0 | **Ratified**: 2026-05-29 | **Last Amended**: 2026-05-29
