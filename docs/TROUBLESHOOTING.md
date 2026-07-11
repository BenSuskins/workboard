# Troubleshooting

> Common issues and fixes for Workboard. Organised by symptom.

## How to use this doc

- Search by symptom (the bold question line) first
- If you fix something not listed here, add it — the bar is "would future-me
  have wanted this written down?"
- Keep entries short: symptom → cause → fix

---

## Setup

**Port `3000` or `8787` already in use**

Cause: a previous `npm run dev` (or another app) is still bound to the port.
Fix: `lsof -ti:3000 | xargs kill` (swap `8787` for the MCP port).

**`npm run dev` starts but the dashboard is empty**

Cause: no data yet — the database is created empty on first run.
Fix: `npm run seed` to load sample projects.

## Integrations

**Linked GitHub/Jira/Google items show as plain links only**

Cause: no credentials for that integration, so sync is skipped and the UI
degrades gracefully.
Fix: copy `.env.example` to `.env` and set the relevant vars (`GITHUB_TOKEN`;
`JIRA_BASE_URL`/`JIRA_EMAIL`/`JIRA_API_TOKEN`; `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`).

**Dashboard banner reports a failing or stale sync**

Cause: an integration call failed (bad/expired token, network) or GitHub rate
limiting triggered a cooldown. Each linked resource shows its last error.
Fix: check the shown error; refresh the token or wait for the rate-limit reset,
then use the project's refresh button.

**Google Docs titles never populate**

Cause: the one-time OAuth flow hasn't been completed (it needs a browser on
localhost).
Fix: run `npm run google:auth` on the host once.

## Agent / MCP

**`claude mcp add` connects but tools 401 / are rejected**

Cause: `WORKBOARD_MCP_TOKEN` is set, so the HTTP transport requires a bearer
token the client isn't sending.
Fix: pass the matching token from the client, or unset `WORKBOARD_MCP_TOKEN` for
local-only use.

**`find_project` can't resolve which project the work belongs to**

Cause: the PR/branch/paths don't match any link or repo scope (projects ≠ repos
in a monorepo).
Fix: link the individual PR/issue to the project, or give the repo link a scope
(labels / path prefixes / branch prefix) so discovery can match it.

**`npm run mcp:smoke` fails**

Cause: a regression in the MCP server or core services surfaced by the full
stdio agent flow.
Fix: read the failing step's output; run `npm test` to isolate the core services
from the transport.

## Docker

**Agents on other machines can't reach the MCP server**

Cause: `http://<host>:8787/mcp` isn't reachable, or is exposed without a token.
Fix: ensure the port is published and reachable; if it's reachable beyond
localhost, set `WORKBOARD_MCP_TOKEN` in `.env` to require a bearer token.

**Google Docs auth doesn't work in the container**

Cause: the OAuth flow needs a browser on localhost, which the container lacks.
Fix: run `npm run google:auth` on the host, then copy the token into the volume:
`docker compose cp data/google-token.json web:/data/google-token.json`.

**Need to back up the database**

Cause: all state lives in the SQLite file on the `data` volume.
Fix: `docker compose cp web:/data/workboard.db ./backup.db` — WAL checkpoints on
open, so the copied file is usable as-is.

---

_If your fix doesn't fit a section above, add a new H2 section. Keep symptoms
in **bold** so they're scannable._
