# Data Model: OpenUI AI-Generated Dashboard

**Feature**: 002-openui-ai-dashboard
**Date**: 2026-06-02

No database schema changes. All entities below are either in-memory runtime state
or static files.

---

## Dashboard Declaration

| Property | Value |
|----------|-------|
| File | `dashboard.declaration.md` (repository root) |
| Format | Plain-language prose (Markdown) |
| Editable by | Operator — any text editor, no code knowledge required |
| Loaded by | Fastify API service at request time (not frontend) |
| Versioning | Git-tracked; changes trigger cache invalidation via hash comparison |

**Example content**:
```
Show all active projects ordered by budget consumed (highest first).
For each project, show a ProjectCard with name, budgeted hours, hours used, and remaining hours.
Below each project card, show its BurndownChart.
Use a StatusBadge to mark projects over budget as danger, projects within 10% of budget as at-risk, and all others as on-budget.
```

---

## Layout Cache (in-memory, ephemeral)

| Property | Value |
|----------|-------|
| Location | Module-level Map in `api/src/services/ai-dashboard.js` |
| Key | SHA-256 hex digest of the declaration file content |
| Value | Complete openUI Lang layout string (full AI response) |
| Capacity | 1 entry (single active declaration) |
| Lifetime | API process lifetime; lost on container restart |
| Invalidation | Hash mismatch on next request |

---

## openUI Component Registry

Defines the three components the AI model may reference. Each entry maps a name
(as the model outputs it) to a React component implementation.

| Component Name | File | Data Props | Renders |
|----------------|------|------------|---------|
| `ProjectCard` | `frontend/src/components/ai/ProjectCard.ai.jsx` | `projectId` (int) | Project name, budgeted hours, hours consumed, hours remaining |
| `BurndownChart` | `frontend/src/components/ai/BurndownChart.ai.jsx` | `projectId` (int) | Ideal vs. actual burndown line chart (via `/api/projects/:id/burndown`) |
| `StatusBadge` | `frontend/src/components/ai/StatusBadge.jsx` | `status` (string: `on-budget` \| `at-risk` \| `over-budget`) | Coloured badge using InvoiceNinja design tokens |

**StatusBadge colour mapping** (InvoiceNinja design system):

| Status | Token | Hex |
|--------|-------|-----|
| `on-budget` | `success` | `#36c157` |
| `at-risk` | `warning` | `#e27329` |
| `over-budget` | `danger` | `#da4830` |

---

## AI Dashboard Service (runtime state)

| Entity | Type | Description |
|--------|------|-------------|
| `declarationCache` | `Map<string, string>` | hash → layout string |
| `ollamaBaseUrl` | string | `http://ollama:11434` (from env `OLLAMA_URL`) |
| `declarationPath` | string | Absolute path to `dashboard.declaration.md` |
| `systemPrompt` | string | Generated from openUI component definitions; describes available components to the model |

---

## Docker Service: Ollama

| Property | Value |
|----------|-------|
| Image | `ollama/ollama` |
| Container name | `burndown_ollama` |
| Internal hostname | `ollama` |
| Port | 11434 (internal network only — not exposed to host) |
| Volume | `ollama_data:/root/.ollama` (persists model weights across restarts) |
| Network | `internal` only |
| Entrypoint | `ollama/entrypoint.sh` (auto-pulls `qwen2.5:7b`) |
| Model size | ~5 GB (downloaded once) |
| RAM requirement | ~5–8 GB at inference time |

---

## Frontend State (AIDashboard component)

| State variable | Type | Description |
|----------------|------|-------------|
| `mode` | `'legacy' \| 'ai'` | Current dashboard view; persisted in `localStorage` key `burndown_dashboard_mode` |
| `aiStatus` | `'idle' \| 'loading' \| 'streaming' \| 'ready' \| 'error' \| 'unavailable'` | AI service availability and generation state |
| `layoutString` | `string \| null` | Full or partial openUI Lang response from API stream |
| `ollamaReady` | `boolean` | Whether `/api/ai-dashboard/status` reports Ollama available |
