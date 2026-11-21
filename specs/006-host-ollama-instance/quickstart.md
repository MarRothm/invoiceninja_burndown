# Quickstart: Host Ollama for the AI Dashboard

**Feature**: 006-host-ollama-instance | **Target host**: `macmini.local` (macOS, Docker host + Ollama)

## 1. Host prerequisites (one-time, on macmini, BEFORE redeploying)

```bash
ollama --version                 # installed and running (v0.40.17 verified)
ollama pull qwen2.5:7b           # ~4.7 GB; the only model the dashboard uses
ollama list | grep 'qwen2.5:7b'  # exact tag present
```

You don't need to change the network binding: `host.docker.internal` reaches the Mac's Ollama whether it listens on loopback or on the LAN. Optional hardening (see `SECURITY.md`): bind Ollama to loopback only. The stack keeps working, but LAN clients lose access.

## 2. Deploy

**Portainer (production)**: after the merge to `master`, use **Pull and redeploy** on the stack manually. CI doesn't trigger it.

**Local development**:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose ps        # no burndown_ollama service listed
```

Override example, to reach Ollama by its LAN name instead (stack env / `.env`):

```dotenv
OLLAMA_URL=http://macmini.local:11434
```

> Verified 2026-11-21 on an OrbStack workstation: `macmini.local` did **not** resolve inside the container (`EAI_AGAIN`), and the macmini LAN IP timed out from the container while it worked from the Mac itself. Use the default `host.docker.internal` on macmini. If you override with a LAN address, prefer the IP, and check the runtime's macOS *Local Network* permission.

## 3. Verify

```bash
docker exec burndown_api wget -qO- http://host.docker.internal:11434/api/version   # {"version":"0.40.17"}
curl -s http://macmini.local:6088/api/ai-dashboard/status                          # {"ollama":"ready","model":"qwen2.5:7b",...}
curl -s http://macmini.local:6088/api/ai-dashboard/debug | grep -o '"ollamaUrl":"[^"]*"'
```

In the UI, switch to the AI Dashboard. A layout streams in within the 30 s timeout.

## 4. Negative checks (US2)

| Action on macmini | Expected `ollama` status | UI |
|-------------------|--------------------------|----|
| Quit Ollama | `unavailable` | Toggle disabled; "host Ollama not reachable" hint; legacy dashboard works |
| `ollama rm qwen2.5:7b` (or skip step 1) | `model_missing` | Toggle disabled; hint `ollama pull qwen2.5:7b` |
| Only `qwen3-vl:8b` present | `model_missing` | Same as above (exact-tag match) |
| Restore (start / pull) | `ready` within ≤ 15 s | Toggle enabled, no stack restart |

## 5. Upgrade cleanup (on macmini)

```bash
docker ps -a --filter name=burndown_ollama        # should be gone after redeploy
docker rm -f burndown_ollama 2>/dev/null
docker volume ls | grep ollama_data
docker volume rm <stack>_ollama_data              # frees ~5 GB (old bundled qwen2.5:7b copy)
```

## 6. Tests

```bash
cd api && npm test
```
