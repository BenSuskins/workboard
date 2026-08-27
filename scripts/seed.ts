/** Seeds the board with realistic sample data. Idempotent-ish: skips if projects exist. Pass --force to reseed from scratch. */
import { rmSync } from "node:fs";
import {
  addLink,
  addTask,
  addPost,
  createProject,
  defaultDataDir,
  listProjects,
  openStore,
  raiseWarning,
  saveReport,
  updateTask,
  upsertSummary,
} from "@workboard/core";

const dataDir = defaultDataDir();
if (process.argv.includes("--force")) rmSync(dataDir, { recursive: true, force: true });

const db = openStore(dataDir);

if (listProjects(db, { includeArchived: true }).length > 0) {
  console.log("Board already has projects — skipping seed. Use --force to reseed.");
  process.exit(0);
}

const days = (n: number) => n * 24 * 60 * 60 * 1000;

// --- Payments platform migration (coding, monorepo-scoped) ---
const payments = createProject(db, {
  name: "Payments v2 migration",
  description:
    "Migrate the payments service off the legacy charge pipeline onto the v2 ledger API. Goal: all traffic on v2 by end of Q3, legacy pipeline deleted.",
  category: "coding",
  priority: "high",
});
addLink(db, payments.id, {
  url: "https://github.com/acme/platform",
  title: "platform monorepo (payments slice)",
  scope: { pathPrefixes: ["services/payments/", "libs/ledger/"], branchPrefix: "payments-v2/" },
});
addLink(db, payments.id, { url: "https://github.com/acme/platform/pull/4821", title: "Ledger write-path cutover" });
addLink(db, payments.id, { url: "https://github.com/acme/platform/pull/4876", title: "Dual-write reconciliation job" });
addLink(db, payments.id, { url: "https://acme.atlassian.net/browse/PAY-312", title: "Epic: v2 migration" });
addTask(db, payments.id, "Cut over read path behind flag", {
  status: "in_progress",
  author: "user",
  assignee: "user",
  labels: ["migration", "risky"],
});
addTask(db, payments.id, "Delete legacy charge pipeline", { author: "user", labels: ["cleanup"] });
// One task sitting in the queue, so "Up for grabs" is not an empty column on a fresh board.
addTask(db, payments.id, "Backfill ledger ids for pre-cutover charges", {
  description: "## Problem\n\nRows written before the cutover have no v2 ledger id.\n\n**Accept:** every charge row resolves to a ledger entry.",
  author: "user",
  agentReady: true,
  priority: "medium",
  labels: ["migration"],
});
const doneTask = addTask(db, payments.id, "Ship dual-write mode", { author: "user", assignee: "user" });
updateTask(db, doneTask.id, { status: "done" });
addPost(db, payments.id, "Dual-write shipped to prod behind `payments_v2_dual_write`. Reconciliation job green for 48h.", {
  type: "agent_update",
  author: "agent:claude-code",
});
addPost(db, payments.id, "PAY-341 flagged a rounding mismatch on refunds — fix landed in #4876.", { type: "note", author: "user" });
upsertSummary(
  db,
  payments.id,
  "Dual-write is live and reconciliation has been clean for two days. Read-path cutover is in progress behind a flag (#4821 in review). Remaining risk is refund rounding, fixed in #4876 and awaiting merge. On track for Q3.",
  "agent:claude-code",
);
raiseWarning(db, payments.id, {
  severity: "critical",
  message: "CI on #4821 has been failing for 2 days (flaky ledger integration test) — the cutover can't merge until it's green.",
  suggestedAction: "Quarantine `ledger_replay_test` or bump its timeout, then re-run CI on #4821.",
  raisedBy: "agent:claude-code",
});

// --- Search relevance (coding, same monorepo, different slice) ---
const search = createProject(db, {
  name: "Search relevance rework",
  description: "Replace the hand-tuned ranking with the learned re-ranker. Target: +5% search CTR without latency regression.",
  category: "coding",
  priority: "medium",
});
addLink(db, search.id, {
  url: "https://github.com/acme/platform",
  title: "platform monorepo (search slice)",
  scope: { pathPrefixes: ["services/search/"], labels: ["search"] },
});
addLink(db, search.id, { url: "https://github.com/acme/platform/pull/4903", title: "Re-ranker shadow mode" });
addLink(db, search.id, { url: "https://acme.atlassian.net/browse/SRCH-88", title: "Epic: learned re-ranking" });
addTask(db, search.id, "Run shadow-mode A/B for a week", {
  status: "in_progress",
  author: "agent:claude-code",
  assignee: "agent:claude-code",
  labels: ["experiment"],
});
addPost(db, search.id, "Shadow mode deployed; collecting CTR deltas. Early numbers show +3.8% on head queries.", {
  type: "agent_update",
  author: "agent:claude-code",
});
upsertSummary(
  db,
  search.id,
  "Re-ranker is running in shadow mode (#4903). Early CTR delta is +3.8% on head queries, below the +5% target — tail-query performance is the open question this week.",
  "agent:claude-code",
);

// --- Hiring (non-coding) ---
const hiring = createProject(db, {
  name: "Backend engineer hiring",
  description: "Fill two senior backend roles on the platform team. Pipeline health, interview loops, and offer decisions.",
  category: "hiring",
  priority: "high",
  health: "amber",
});
addLink(db, hiring.id, {
  url: "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit",
  title: "Interview loop rubric",
});
addTask(db, hiring.id, "Debrief for candidate #2", {
  dueDate: "2026-07-11",
  status: "in_progress",
  author: "user",
  assignee: "user",
  labels: ["interviews"],
});
addTask(db, hiring.id, "Source 10 new candidates", { author: "user", labels: ["sourcing"] });
addPost(db, hiring.id, "Candidate #1 declined — comp gap. Candidate #2 onsite completed, debrief Friday.", { author: "user" });
upsertSummary(
  db,
  hiring.id,
  "Two senior backend roles open. One offer declined on comp; second candidate finished onsite with debrief scheduled Friday. Pipeline is thin — sourcing needs another push this week.",
  "agent:claude-code",
);

// --- Platform on-call process (non-coding, blocked) ---
const oncall = createProject(db, {
  name: "On-call rotation revamp",
  description: "Restructure the platform on-call: smaller rotations, follow-the-sun handoff, and a runbook quality bar.",
  category: "process",
  priority: "low",
  status: "blocked",
  health: "red",
});
addLink(db, oncall.id, {
  url: "https://docs.google.com/document/d/1ZyXwVuTsRqPoNmLkJiHgFeDcBa0987654321/edit",
  title: "On-call proposal draft",
});
addTask(db, oncall.id, "Get sign-off from infra leads", { author: "user", assignee: "user", labels: ["process"] });
addPost(db, oncall.id, "Blocked on infra leads sign-off — meeting pushed twice.", { type: "status_change", author: "user" });
upsertSummary(
  db,
  oncall.id,
  "Proposal drafted and socialized, but blocked on infra leads sign-off; the review meeting has slipped twice. Needs an escalation or async approval to unblock.",
  "agent:claude-code",
);

// --- Reports ---
saveReport(
  db,
  "digest",
  [
    "## Weekly digest — w/c 6 Jul 2026",
    "",
    "**Payments v2 migration** is the healthiest big rock: dual-write live, reconciliation clean, read-path cutover in review. ",
    "**Search relevance** is mid-experiment — shadow mode shows +3.8% CTR on head queries, short of the +5% target.",
    "",
    "**Hiring** needs attention: one declined offer and a thin pipeline. **On-call revamp** remains blocked on infra sign-off for the second week.",
    "",
    "### Suggested focus",
    "1. Land #4821 (read-path cutover) early in the week.",
    "2. Unblock on-call sign-off asynchronously rather than waiting for the meeting.",
    "3. Push sourcing before the hiring pipeline dries up.",
  ].join("\n"),
  "agent:claude-code",
);
saveReport(
  db,
  "triage",
  [
    "## Triage — 9 Jul 2026",
    "",
    "- 🔴 **On-call rotation revamp** — blocked 2 weeks, meeting slipped twice. *Suggest: async sign-off request to infra leads today.*",
    "- 🟡 **Backend engineer hiring** — pipeline below 5 active candidates. *Suggest: 30 min sourcing block + recruiter sync.*",
    "- 🟢 Payments and Search are on track; no action needed.",
  ].join("\n"),
  "agent:claude-code",
);

console.log(`Seeded ${listProjects(db, { includeArchived: true }).length} projects into ${dataDir}`);
