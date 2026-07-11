# Workboard

An AI-native dashboard for all your work — coding projects and everything else
(hiring, process, docs work) on one board. Workboard is the source of truth for
*projects*; GitHub, Jira, and Google Docs stay the source of truth for their own
items, which Workboard reads and displays live.

**The AI content is written by agents, not by the app.** Workboard holds no LLM
API key. Coding agents (Claude Code) connect through Workboard's MCP server to
read project context, post progress updates, and write the summaries, digests,
and triage reports the dashboard displays — guided by the skills shipped in this
repo.

```
┌────────────┐   MCP (HTTP :8787 / stdio)   ┌───────────────┐
│ Claude Code │ ───────────────────────────▶ │   Workboard   │◀── you (:3000)
│  (any repo) │   updates · summaries        │ SQLite + Next │
└────────────┘                               └───────┬───────┘
                                        read-only sync│
                                     GitHub · Jira · Google Docs
```

## Quick start

```bash
npm install
npm run seed        # optional: sample data
npm run dev         # web on :3000, MCP server on :8787
```

### Or with Docker

```bash
cp .env.example .env          # fill in integration credentials (all optional)
docker compose up -d --build  # web on :3000, MCP on :8787
docker compose run --rm web npm run seed   # optional: sample data
```

One image, two services (`web` and `mcp`), sharing the SQLite database on the
named `data` volume — that volume is the only state worth backing up. The
`.env` file next to the compose file is loaded automatically when present.

Notes for Docker deployments:

- **MCP from other machines**: agents connect to `http://<host>:8787/mcp`. If
  that port is reachable beyond localhost, set `WORKBOARD_MCP_TOKEN` in `.env`
  so a bearer token is required.
- **Google Docs auth**: the one-time OAuth flow needs a browser on localhost,
  so run `npm run google:auth` on the host, then copy the token into the
  volume: `docker compose cp data/google-token.json web:/data/google-token.json`.
- **Backups**: `docker compose cp web:/data/workboard.db ./backup.db` (WAL
  checkpoints on open, so a copied file is usable as-is).

Copy `.env.example` to `.env` and fill in what you use — every integration is
optional and the UI degrades to plain links without credentials:

| Integration | Env vars | What you get |
|---|---|---|
| GitHub | `GITHUB_TOKEN` | Live PR state, review status, CI checks on in-flight PRs (closed/merged PRs are ignored for status), monorepo-scoped PR discovery |
| Jira Cloud | `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | Issue status, per-epic/project counts |
| Google Docs | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` + `npm run google:auth` (once) | Doc titles + last-edited times |

## Connecting a coding agent

From any repo where an agent works:

```bash
claude mcp add --transport http workboard http://localhost:8787/mcp
```

(Or stdio: `claude mcp add workboard -- npx --prefix /path/to/workboard workboard-mcp`.
Set `WORKBOARD_MCP_TOKEN` in `.env` to require a bearer token on the HTTP transport.)

Then install the skills so agents know *how* to use it:

```bash
npm run skills:install    # copies skills/ → ~/.claude/skills/
```

| Skill | What it does |
|---|---|
| `/workboard-status` | End-of-session: resolve which project the work belongs to, post what was done, link new PRs, refresh the AI summary |
| `/workboard-digest` | Cross-project "where everything stands" briefing, saved to the Reports page |
| `/workboard-triage` | Find stale projects, blockers, rotting PRs, overdue tasks; save a prioritized action list |

Schedule digests however you run Claude: a cron entry like
`0 8 * * 1-5 claude -p "/workboard-digest"`, or a Claude Code Routine/scheduled
session that fires the same prompt.

## Monorepos: projects ≠ repos

One platform repo hosts many concurrent projects, so a repo link never
identifies a project. Instead:

- Link **individual PRs/issues** to a project (`owner/repo#123` — inferred from the URL).
- Give a repo link a **scope** — PR labels, path prefixes, and/or a branch
  prefix — and Workboard auto-discovers the PRs matching that slice, no
  hand-linking each one.
- Agents call the `find_project` MCP tool with their PR number / branch /
  changed paths; it ranks candidates (exact PR link → scope match → bare repo
  link) and asks for confirmation when ambiguous.

## Warnings: agents flagging things for you

When an agent hits something it can't fix — failing CI it can't repair, a
decision needed, a blocked dependency — it calls `raise_warning` with a severity
(`info`/`warning`/`critical`) and a concrete suggested action. Warnings appear
on the project's dashboard card and page until you (or an agent, once the
condition clears) resolve them; resolutions are logged to the project's
activity timeline.

## Trustworthy data

- **Sync health is visible.** Every sync attempt is recorded per link. A banner
  appears on the dashboard when any sync is failing (with the error and how old
  the last good data is) or when live data has gone stale; each linked resource
  shows its last-synced time or current error. GitHub rate limiting triggers a
  cooldown until the advertised reset instead of hammering the API.
- **Soft deletes.** Deleting a task or link hides it and stops its syncs, but
  keeps the row — restore from the project page's "Recently deleted" panel.
- **Summary history.** Every `upsert_summary` is kept; the project page shows
  previous versions under the current AI summary, and `get_project` returns the
  last few so agents can see how the story has evolved.

## MCP tool surface

`list_projects` · `get_project` · `find_project` · `create_project` ·
`update_project` · `add_update` · `add_task` · `update_task` · `add_link` ·
`upsert_summary` · `raise_warning` · `resolve_warning` · `get_activity` ·
`save_report` · `list_reports` · `refresh_project`

## Layout

```
packages/core   schema (SQLite/Drizzle), services, integration clients, sync engine
packages/mcp    MCP server — streamable HTTP (:8787/mcp) + stdio
apps/web        Next.js dashboard (server components + server actions)
skills/         Claude Code skills (see above)
scripts/        seed, google-auth, install-skills, mcp-smoke
data/           workboard.db (created on first run; gitignored)
Dockerfile      multi-stage image used by both compose services
docker-compose.yml  web + mcp services sharing the `data` volume
```

## Development

```bash
npm test            # core unit tests (vitest)
npm run mcp:smoke   # full agent flow against the real MCP server (stdio)
npm run build       # typecheck + Next production build
```
