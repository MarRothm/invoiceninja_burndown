# Feature Specification: OpenUI AI-Generated Dashboard

**Feature Branch**: `002-openui-ai-dashboard`

**Created**: 2026-06-02

**Status**: Draft

**Input**: User description: "Convert burndown frontend to openUI generative dashboard alongside existing; Ollama qwen2.5:7b local in container; define ProjectCard BurndownChart StatusBadge components; toggle between legacy and AI-generated dashboard"

## Clarifications

### Session 2026-06-09

- Q: When generation finishes and all tokens have been received, what should the dashboard do without any user action? → A: Auto-complete — the dashboard silently transitions to the full layout the moment the last token is received, with no flicker, no reload button, and no user intervention required.
- Q: Should deleted projects (soft-deleted in InvoiceNinja) be shown in the standard and AI dashboards? Besides deleted, should archived projects also be hidden? → A: Hide both — projects with `is_deleted: true` AND projects with a non-null `archived_at` timestamp must be excluded from all dashboard views (standard and AI).
- Q: Where should GitHub Actions publish built Docker images? → A: GitHub Container Registry (ghcr.io) — uses existing GitHub credentials, free for private packages, PAT-based auth compatible with Portainer.
- Q: How should Portainer detect and apply a new image after a GitHub Actions push? → A: Portainer stack webhook — GitHub Actions calls the Portainer webhook URL as the final step after a successful image push, triggering an immediate event-driven redeploy.
- Q: What event should trigger the GitHub Actions image build and push? → A: Push to master branch — every commit merged to master builds a new image tagged `latest` and triggers the Portainer webhook.
- Q: When the page loads and localStorage has the AI dashboard as the active view (no toggle click), what must the frontend do? → A: Auto-trigger immediately — the frontend MUST start streaming (or load from cache) exactly as if the user had just clicked the toggle; no additional user action is required.
- Q: What signal definitively marks "streaming ended" to the frontend renderer? → A: Explicit done sentinel — the backend MUST emit a defined end-of-stream signal as the final event when generation is complete; the frontend MUST transition to the complete (fully rendered) layout state immediately upon receiving this sentinel, not on connection close or silence timeout alone.
- Q: If the stream ends (sentinel received) but the AI generated zero renderable components, what must the user see? → A: Error with retry — display a "Dashboard generation failed — retry" message with a button that re-triggers streaming without a page reload; do not show a blank screen or silently fall back to legacy.
- Q: What should happen if streaming starts successfully but then stalls mid-stream (no new tokens for an extended period)? → A: Separate stall timeout — if no new token is received for a defined interval (e.g. 15 s) after the last token, show a non-destructive "generation seems stuck — retry?" prompt while keeping the partial layout visible; this is distinct from the initial 30 s response timeout.
- Q: What is the normative stall timeout duration (the fixed interval after the last received token before the "seems stuck" prompt appears)? → A: 15 seconds — if no new token arrives for 15 s after the last received token, the stall prompt MUST appear. This value is fixed, not configurable.

### Session 2026-06-02

- Q: What format should the Dashboard Declaration file use? → A: Plain-language prose (no YAML or structured syntax required).
- Q: Should the AI-generated layout be cached or regenerated on every page load? → A: Cache the generated layout; regenerate only when the declaration file changes.
- Q: Should the cached layout persist across container restarts? → A: Ephemeral — cache is lost on restart; one regeneration wait per restart is acceptable.
- Q: How should the qwen2.5:7b model be made available in Ollama on first startup? → A: Auto-pull — Ollama pulls the model automatically on first startup; operator only needs to run `docker compose up`.
- Q: Is `design.md` the single source of truth for all UI styling in this feature? → A: Yes — all colors, typography, spacing, and border-radius values for AI dashboard components MUST be sourced exclusively from `design.md` (InvoiceNinja design system). No ad-hoc values permitted (Constitution Principle V).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Toggle Between Legacy and AI Dashboard (Priority: P1)

A user opens the Burndown dashboard and sees the existing project overview (the legacy
dashboard). A clearly visible toggle in the navigation bar lets them switch to the
AI-generated dashboard view. The AI-generated view presents the same project data in a
layout composed on the fly by the local AI model. The user can switch back to the legacy
view at any time without losing state.

**Why this priority**: The toggle is the safety net for the entire feature. It ensures
the existing dashboard is never removed or broken, and gives users an opt-in path to
the new experience. Nothing else can be validated without this working first.

**Independent Test**: Load the dashboard → confirm legacy view is default → click toggle
→ confirm AI-generated view loads → click toggle again → confirm legacy view returns.

**Acceptance Scenarios**:

1. **Given** a user is on the legacy dashboard, **When** they activate the AI dashboard
   toggle, **Then** the view switches to the AI-generated dashboard without a full page
   reload and the toggle clearly reflects the active mode.
2. **Given** a user is on the AI dashboard, **When** they deactivate the toggle,
   **Then** the legacy dashboard is restored exactly as it was before switching.
3. **Given** the AI service is unavailable, **When** a user attempts to switch to the
   AI dashboard, **Then** they see a clear error message and the legacy dashboard
   remains displayed.
4. **Given** a user previously activated the AI dashboard and then reloads the page
   (localStorage retains the AI dashboard preference), **When** the page finishes
   loading, **Then** the AI dashboard MUST begin streaming (or serve from cache)
   automatically — exactly as if the user had just clicked the toggle — with no
   additional user action required.

---

### User Story 2 - AI-Generated Project Overview (Priority: P2)

A user on the AI dashboard sees their projects presented as dynamically generated
cards and charts. The AI model reads the current project data and assembles a dashboard
layout using defined components (project cards, burndown charts, status badges). The
layout streams progressively — content appears as the model generates it rather than
waiting for a complete response.

**Why this priority**: This is the core value of the feature — a dashboard that can
describe itself declaratively and have the AI compose the presentation.

**Independent Test**: Switch to AI dashboard → verify project cards appear for each
active project → verify burndown chart renders for at least one project → verify
status badges reflect actual budget status from the API.

**Acceptance Scenarios**:

1. **Given** the AI dashboard is active and projects exist, **When** the dashboard
   loads, **Then** at least one project card appears within 10 seconds showing the
   project name and budget status.
2. **Given** the AI dashboard is active, **When** the model streams its response,
   **Then** components appear progressively (first card before all cards are complete)
   rather than all at once after a long wait.
3. **Given** a project is over budget, **When** the AI dashboard renders, **Then**
   that project's status badge reflects the over-budget state distinctly from
   on-budget projects.
4. **Given** the AI dashboard has finished generating (last token received), **When**
   the streaming state ends, **Then** the complete layout is displayed automatically
   showing all in_progress projects — no user action, page reload, or retry required.

---

### User Story 3 - Declarative Dashboard Description (Priority: P3)

A developer or operator can modify a human-readable declaration file that describes
what the AI dashboard should show and how it should be prioritised. After saving the
file and reloading the dashboard, the AI model uses the updated declaration to
generate a different layout without any code changes to the frontend.

**Why this priority**: This is the "no-code" configuration promise of the feature —
the dashboard behaviour changes by editing a text file, not by writing React components.

**Independent Test**: Edit the declaration file to add "highlight projects over 80%
budget consumed" → reload AI dashboard → verify the layout or emphasis reflects the
new instruction.

**Acceptance Scenarios**:

1. **Given** the declaration file is updated to emphasise a specific data field,
   **When** the AI dashboard is reloaded, **Then** the generated layout reflects
   the updated instruction without any frontend code changes.
2. **Given** a non-developer edits the declaration file using only plain language,
   **When** the AI dashboard loads, **Then** the AI interprets and renders the
   described layout without requiring technical syntax knowledge.

---

### Edge Cases

- What happens when the AI model takes more than 30 seconds to respond (no first token)?
  The dashboard must show a loading indicator and time out gracefully with a retry option.
- What happens if streaming has started (at least one token received) but then stalls with no new tokens?
  The frontend MUST apply a separate stall timeout: if no new token arrives within 15 seconds
  of the last received token, a non-destructive "generation seems stuck — retry?" prompt MUST
  appear while the partial layout remains visible. The user MUST NOT be required to perform a
  full page reload to recover. This 15-second stall threshold is fixed and not configurable.
- What happens when the AI generates output referencing a component that does not exist?
  Only registered components are rendered; unknown component names are silently skipped
  or shown as a placeholder, never as a crash.
- What happens when project data from the API is empty (no projects)?
  The AI dashboard must handle the empty state gracefully, showing a meaningful message.
- What happens when the Ollama service container is not running?
  The toggle to AI mode must be disabled or show a "local AI unavailable" notice.
- What happens when the model auto-pull fails on first startup (e.g. no internet access)?
  The AI dashboard must degrade gracefully — the legacy dashboard remains fully accessible
  and the toggle shows "AI unavailable" until the model is successfully pulled.
- What does the user see while the cache is being rebuilt after a declaration change?
  A loading/streaming state is shown; the previous cached layout is not used as a
  fallback (the new layout streams progressively as tokens arrive).
- What happens when the partial layout during streaming shows fewer components than expected (e.g., only the first project card)?
  The partial view during streaming is acceptable; however, the moment streaming ends,
  the renderer MUST automatically re-process the complete accumulated response and
  display all components — the user MUST NOT be required to reload or take any action
  to see the full layout.
- What happens if the stream ends (sentinel received) but the AI generated zero renderable components?
  The frontend MUST display a "Dashboard generation failed — retry" message with a button
  that re-triggers streaming without a page reload. A blank screen or silent fallback to the
  legacy dashboard is not acceptable.
- What happens if the stream connection drops before the end-of-stream sentinel is received?
  The frontend MUST detect the unclean termination (connection close without sentinel) and
  show a "generation incomplete — retry" state rather than silently displaying a partial
  layout as complete.
- What happens when the page is reloaded while the AI dashboard preference is set in localStorage?
  The AI dashboard MUST auto-activate and begin streaming (or serve from cache) immediately
  on page load — the user MUST NOT need to click the toggle again or perform any other action
  to see the AI dashboard. This path must behave identically to a manual toggle activation.
- What happens when a project is soft-deleted or archived in InvoiceNinja?
  The project MUST be excluded from both the standard and AI dashboards on the next
  sync + page load. Deleted and archived projects are never shown to the user regardless
  of their budget or time-tracking state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dashboard MUST provide a toggle control that switches between the
  legacy (existing) dashboard and the AI-generated dashboard within the same page.
- **FR-002**: The legacy dashboard MUST remain fully functional and visually unchanged
  after this feature is introduced — it is the default view.
- **FR-003**: The AI-generated dashboard MUST stream its output progressively; components
  MUST begin appearing before the full response is complete. The backend service MUST
  emit an explicit end-of-stream signal as the final event when generation is complete.
  Upon receiving this signal, the frontend MUST immediately and automatically display
  the complete final layout — all projects and their components — without any user
  action, page reload, or retry. The frontend MUST NOT rely on connection close or
  silence timeout as the sole trigger for this transition.
- **FR-004**: The AI-generated dashboard MUST be composed exclusively from a predefined
  set of components: Dashboard (root container), ProjectCard, BurndownChart, and
  StatusBadge. The AI MUST NOT produce arbitrary markup outside these components.
- **FR-005**: A plain-language prose declaration file MUST define what the AI dashboard
  shows, its priorities, and any emphasis rules — written in natural language, not in
  a structured format such as YAML or JSON. Changes to this file MUST be reflected on
  the next dashboard load without a code deployment.
- **FR-006**: The local AI model MUST run inside the existing Docker Compose stack as a
  container. No external AI API calls are permitted for the dashboard generation. The
  required model MUST be pulled automatically on first startup — no manual model
  installation steps are required of the operator beyond running `docker compose up`.
- **FR-013**: Custom-built service images MUST be built and published to GitHub Container
  Registry (ghcr.io) via a GitHub Actions workflow triggered on every push to the `master`
  branch. Local image builds are NOT permitted as the deployment mechanism. After a
  successful image push, the workflow MUST call the Portainer stack webhook to trigger an
  immediate redeploy — no manual operator action is required to apply a new image.
- **FR-007**: The ProjectCard component MUST display: project name, budgeted hours,
  hours consumed, and remaining hours.
- **FR-008**: The BurndownChart component MUST render the ideal vs. actual burndown
  lines for a given project, consistent with the data the legacy dashboard shows.
- **FR-009**: The StatusBadge component MUST indicate whether a project is on-budget,
  at-risk, or over-budget using visually distinct states. The percentage thresholds
  that determine each state are NOT hardcoded — they are defined by the operator in
  the plain-prose dashboard declaration file. The API reads and parses these thresholds
  from the declaration at runtime and exposes them via `GET /api/ai-dashboard/config`
  so the frontend components always reflect the operator's intent. Default fallback
  thresholds (at-risk ≥ 80%, over-budget > 100%) apply when no threshold is specified
  in the declaration.
- **FR-010**: When the AI service is unavailable, the toggle MUST be disabled or clearly
  indicate unavailability; the legacy dashboard MUST remain accessible.
- **FR-011**: The AI-generated dashboard layout MUST be cached in memory after its first
  successful generation. The cache MUST be invalidated and a fresh layout generated only
  when the declaration file changes. Repeat visits within the same session MUST load
  instantly from cache without re-invoking the AI model. The cache is ephemeral — it does
  not need to survive container restarts; the first visit after a restart triggers
  regeneration.
- **FR-012**: Both the standard (legacy) dashboard and the AI-generated dashboard MUST
  exclude projects that are soft-deleted (`is_deleted: true`) or archived
  (`archived_at IS NOT NULL`) in InvoiceNinja. Such projects MUST NOT appear in any
  project list, ProjectCard, BurndownChart, or status summary visible to the user.

### Key Entities

- **Dashboard Declaration**: A human-readable text file (committed to the repository)
  that describes the desired AI dashboard layout, data priorities, and emphasis rules.
  Modified by operators without code changes; updateable at runtime via
  `PUT /api/ai-dashboard/declaration` (no image rebuild required).
- **AI-Generated Layout**: The dashboard view produced by the local AI model at runtime
  by interpreting the declaration and the current project data.
- **Dashboard**: The required root container component that wraps all layout children.
  Every openUI Lang program MUST end with `root = Dashboard([...])`.
- **ProjectCard**: A component that displays one project's budget and consumption summary,
  including an embedded StatusBadge whose thresholds are read from the declaration at runtime.
- **BurndownChart**: A component that renders the ideal vs. actual burndown line chart
  for one project.
- **StatusBadge**: A component that shows the budget health state of a project
  (on-budget / at-risk / over-budget). Rendered inline within ProjectCard.
- **Local AI Service**: The containerised AI model that receives the declaration and
  data, and generates the dashboard layout using the defined component set.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can switch between legacy and AI dashboard in under 1 second
  (toggle response time, excluding AI generation).
- **SC-002**: The first AI-generated component appears on screen within 10 seconds
  of activating the AI dashboard for the first time or after a declaration change
  (streaming start time on a local network). Subsequent loads from cache MUST be
  instant (under 500 ms).
- **SC-003**: The legacy dashboard passes all existing visual and functional checks
  after this feature is deployed — zero regressions.
- **SC-004**: A non-developer can change the dashboard declaration and observe the
  changed AI output without touching any code file other than the declaration.
- **SC-005**: 100% of rendered components are from the defined set (Dashboard,
  ProjectCard, BurndownChart, StatusBadge) — no uncontrolled markup is ever injected.
- **SC-006**: The AI service container starts and the required model becomes available
  as part of a single `docker compose up` with no additional manual steps. On first
  run, the model is pulled automatically; on subsequent runs it loads from the local
  volume immediately.
- **SC-007**: If streaming has started and no new token is received for 15 seconds, a
  "generation seems stuck — retry?" prompt MUST be visible within 1 second of the
  stall threshold being reached, without removing any partial layout already on screen.

## Assumptions

- The existing Fastify API endpoints (`/api/projects`, `/api/projects/:id/burndown`)
  remain the authoritative data source; the AI dashboard reads data from these same
  endpoints.
- The AI model runs locally in a container (no cloud API calls); the chosen model is
  `qwen2.5:7b` via Ollama, which will be shared with the Monatsabschluss project's
  Ollama instance to avoid duplicate infrastructure.
- The toggle persists its state in browser local storage so the user's preference
  is remembered across page reloads. When the page loads with the AI dashboard
  preference set in localStorage, the frontend MUST auto-trigger streaming (or serve
  from cache) immediately — equivalent to the user having just clicked the toggle.
  No additional user action is required to activate the AI dashboard on page reload.
- The legacy dashboard is the default view; users who have never interacted with the
  toggle always see the legacy dashboard first.
- The declaration file is a plain-language prose file (no structured syntax such as
  YAML or JSON) stored in the repository and read at runtime by the API service (not
  served as a frontend static asset — it is kept server-side to avoid exposing prompt
  engineering to the browser). It is not editable via a UI in this version. The prose
  is passed directly as context to the AI model when generating the dashboard.
- The initial set of components (ProjectCard, BurndownChart, StatusBadge) covers the
  minimum viable dashboard; additional components are out of scope for this feature.
- Hardware assumptions: the deployment host has sufficient memory to run
  `qwen2.5:7b` alongside the existing stack services (minimum ~8 GB RAM free).
- **CI/CD**: Custom service images are built exclusively via GitHub Actions on push to
  `master` and published to `ghcr.io`. Local `docker build` is not the deployment path.
  The Portainer deployment is configured with a stack webhook URL; the GHA workflow
  calls this webhook after every successful image push. GitHub repository secrets must
  hold the `GHCR_TOKEN` (for registry push) and `PORTAINER_WEBHOOK_URL` (for redeploy
  trigger). Ollama uses the official upstream image and is not rebuilt by this pipeline.
- **Design system**: All colors, typography, spacing, and component styling for this
  feature MUST be sourced exclusively from `design.md` (InvoiceNinja design system
  tokens at the repository root). This is the single source of truth for styling —
  no ad-hoc hex values, font sizes, or spacing constants that are not defined in
  `design.md` are permitted in any new component.
