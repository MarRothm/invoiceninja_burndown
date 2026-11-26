# Data Model: AI Dashboard as the Only Dashboard

No persistent data changes. No API, schema or sync changes (FR-009).

## Frontend UI state (App)

| State | Before | After |
|-------|--------|-------|
| `dashMode` (`legacy` \| `ai`, localStorage `burndown_dashboard_mode`) | toggle | **removed**; the key is cleared on start |
| `projects`, `selected`, `burndown`, `chartLoad`, `loading` | classic list / detail | **removed** (`AIDashboard` loads its own projects) |
| `view` (`dashboard` \| `turnover`) | kept | kept; `dashboard` = AI Dashboard |
| `aiStatus` | initial `unavailable` | initial **`checking`**; then `ready` \| `unavailable` \| `model_missing` (+ `cached`) |
| `error` | shown in the classic view only | shown above the main area in every view |
| `aiReloadKey`, `turnoverKey`, `timesheetProject`, `timesheetMonth` | kept | kept |

## AIDashboard status transitions (additions only)

```
loading ──(aiStatus ∈ {unavailable, model_missing} ∧ ¬cached)──▶ unavailable
unavailable / error ──(aiStatus = ready)──▶ loading   (existing auto-retry)
```
