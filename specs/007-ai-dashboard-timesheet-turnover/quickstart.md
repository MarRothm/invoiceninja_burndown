# Quickstart: Timesheet and Turnover in the AI Dashboard

## 1. Where the composition is defined

- `api/dashboard.declaration.md` is the default declaration in plain language. It is baked into the image.
- To change it at runtime (no rebuild; this clears the layout cache and regenerates):

  ```bash
  curl -X PUT http://macmini.local:6088/api/ai-dashboard/declaration \
    -H 'Content-Type: application/json' \
    -d '{"content":"Show the turnover overview for the current year first. Then for every in_progress project ordered by progress: a ProjectCard, a BurndownChart and the timesheet summary of the current month."}'
  ```

- Example sentences:
  - "…also show the project turnover for each project"
  - "…timesheet for October 2026"
  - "…turnover overview for 2025"

## 2. Local run

```bash
cd api && npm test
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

The AI view needs a reachable host Ollama that has `qwen2.5:7b`. Locally, point `OLLAMA_URL` at the macmini IP if needed (see the README).

## 3. Verify the live build-up (US4)

1. Run a `PUT` on the declaration (above) to force a cache miss, then open the AI view **without reloading**.
2. The block count grows during generation. At `[DONE]`, all blocks are visible.
3. Reload the page. The cached view must look identical.

Offline check of the framing fix (no browser):

```bash
curl -sN http://localhost:6088/api/ai-dashboard > /tmp/aistream.txt
# EventSource-style reassembly must contain newlines between statements:
python3 -I -c "import re;t=open('/tmp/aistream.txt').read();ev=[ '\n'.join(l[6:] if l.startswith('data: ') else l[5:] for l in e.split('\n') if l.startswith('data:')) for e in t.split('\n\n') if e.strip()];s=''.join(x for x in ev if x!='[DONE]');print(s.splitlines()[0]);print(len(s.splitlines()),'lines')"
# first line must be: root = Dashboard([...])
```

## 4. Verify numbers (SC-001)

For two projects, compare:
- `TimesheetSummary` total, rate and EUR with the timesheet modal for the same month;
- `TurnoverOverview` with the Turnover view for the same year;
- `ProjectTurnover` (if declared) with the project detail turnover table.

## 5. Verify defaults and edge cases

| Declaration / data | Expected |
|--------------------|----------|
| Old declaration (cards and charts only) | Same dashboard as before (SC-005) |
| "timesheet for 2026-10" | Blocks show October 2026 |
| Project without hour rate | EUR "—" |
| Project with no time in month | 0.00 h |
| Year without invoices | "No invoices in {year}" |
| Click a TimesheetSummary | The full timesheet modal opens for that project and month |

## 6. Timing (SC-003)

Time a cache-miss generation with the default declaration: `time curl -sN …/api/ai-dashboard > /dev/null`. It must stay below 30 s; the expectation is about 6–7 s for 4 projects.
