# Data Model: Timesheet and Turnover in the AI Dashboard

No persisted data changes. The entities are the declaration and the building blocks of the generated layout.

## Declaration (existing, content extended)

| Aspect | Value |
|--------|-------|
| Baked-in file | `api/dashboard.declaration.md` (copied into the image) |
| Runtime override | `PUT /api/ai-dashboard/declaration` writes `${DECLARATION_DATA_DIR:-/app/data}/dashboard.declaration.md`, which takes priority |
| Cache | The layout is cached in memory by the SHA-256 of the declaration. Changing the declaration regenerates the layout. |

**New default content** (FR-009):
- **Order**: in_progress projects ordered by progress, as today.
- **First**: one `TurnoverOverview` for the current year.
- **Then, per project**: `ProjectCard`, `BurndownChart` and `TimesheetSummary` for the current month.
- **Not included**: no `ProjectTurnover`.

## Building blocks (OpenUI components)

| Block | Args | Data source | Empty / error state |
|-------|------|-------------|---------------------|
| `Dashboard(children)` | array | — | — |
| `ProjectCard(projectId)` | int | AI context projects | unknown project → nothing (as today) |
| `BurndownChart(projectId)` | int | `/api/projects/:id/burndown` | as today |
| **`TimesheetSummary(projectId, month?)`** | int, `"YYYY-MM"` | `/api/projects/:id/timesheet?month=` → `total`, `rate`, `amount` | 0 h shown as `0.00 h`; `rate === null` → "—"; fetch error → notice in block; 404 → "Project not found" |
| **`ProjectTurnover(projectId)`** | int | `/api/projects/:id/turnover` | no years → "No invoices"; error → notice in block |
| **`TurnoverOverview(year?)`** | int | `/api/turnover?year=` | no projects → "No invoices in {year}"; error → notice in block |

**Validation rules**:
- `projectId` is a positive int (`z.coerce.number().int().positive()`).
- `month` must match `^\d{4}-(0[1-9]|1[0-2])$`. If it is invalid, the block falls back to the current month.
- `year` must be an int from 2000 to 2100. If it is invalid, the block falls back to the current year.
- Omitted `month` or `year` is resolved in the browser at render time, never written into the cached layout by default.

## Streaming state (frontend `AIDashboard`)

```text
loading → streaming (blocks grow as statements arrive; root first) → ready ([DONE])
                    ↘ stalled (15 s without token; retry) 
cached → ready (single event)
```

`ready` after streaming must render the same tree as `cached` (FR-015).
