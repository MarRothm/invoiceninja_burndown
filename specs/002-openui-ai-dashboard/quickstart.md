# Quickstart: OpenUI AI-Generated Dashboard

**Feature**: 002-openui-ai-dashboard

---

## First-Time Setup

```bash
# 1. Start the full stack (Ollama will auto-pull qwen2.5:7b on first run — ~5 GB download)
docker compose up -d --build

# 2. Monitor model pull progress
docker logs -f burndown_ollama

# 3. When you see "model pulled successfully", the AI dashboard is ready
# Open the app and click the "AI Dashboard" toggle in the nav bar
```

---

## Editing the Dashboard Declaration

The declaration file controls what the AI generates. Edit it with any text editor:

```bash
# Edit the declaration
nano dashboard.declaration.md   # or your preferred editor
```

**Example declarations**:

```
# Simple — show all projects
Show all active projects as project cards with their burndown charts.
Mark any project over budget with an over-budget status badge.
```

```
# Priority-focused — worst first
Show projects ordered by budget consumption, highest first.
For the top three most consumed projects, show the burndown chart prominently.
Add an at-risk badge to any project within 20% of exhausting its budget.
Everything else gets a compact project card with an on-budget badge.
```

After saving, reload the AI dashboard in your browser — the change is picked up
automatically on the next load (no rebuild, no restart required).

---

## Adding a New openUI Component

1. Create the React component in `frontend/src/components/ai/MyComponent.ai.jsx`
2. Register it in `frontend/src/components/ai/components.js`:
   ```js
   import MyComponent from './MyComponent.ai.jsx';
   export const registry = {
     // existing...
     MyComponent,
   };
   ```
3. Rebuild the frontend: `docker compose up -d --build frontend`
4. Update `dashboard.declaration.md` to reference the new component by name.

---

## Checking AI Service Status

```bash
# Check Ollama availability
curl http://localhost:6088/api/ai-dashboard/status

# Expected when ready:
# {"ollama":"ready","model":"qwen2.5:7b","cached":false}

# Force cache invalidation (touch the declaration file)
touch dashboard.declaration.md
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Toggle shows "AI unavailable" | Ollama not running or still pulling | `docker logs burndown_ollama` |
| AI dashboard loads slowly every time | Cache not working | Check `GET /api/ai-dashboard/status` for `"cached": true` |
| Components not rendering | Unknown component name in declaration | Only `ProjectCard`, `BurndownChart`, `StatusBadge` are valid |
| First-time pull hangs | No internet access on host | Pull manually: `docker exec burndown_ollama ollama pull qwen2.5:7b` |
| Dock/browser shows wrong icon | Browser cache | Hard refresh (`Cmd+Shift+R`) or clear site data |

---

## Sharing Ollama with Monatsabschluss

If the Monatsabschluss project also runs an Ollama container on the same host,
configure both stacks to use a **shared external Ollama container** to avoid
duplicate model downloads and memory usage:

1. Run a single Ollama container on the host (outside both Compose stacks).
2. In both `docker-compose.yml` files, set `OLLAMA_URL` to point to the shared
   Ollama container's address (e.g., `http://host-gateway:11434`).
3. Remove the `ollama` service from both Compose files.
