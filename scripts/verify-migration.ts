/** Compares the migrated markdown tree against the SQLite source, row by row. */
import { createRequire } from "node:module";
import { openStore, getProjectDetail, listProjects, listReports, listDeleted, listSummaryHistory } from "@workboard/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as any;
const sqlite = new DatabaseSync(process.argv[2], { readOnly: true });
const store = openStore(process.argv[3]);
const all = <T>(t: string): T[] => sqlite.prepare(`SELECT * FROM ${t}`).all() as T[];
/* eslint-disable @typescript-eslint/no-explicit-any */

let failures = 0;
function check(label: string, expected: unknown, actual: unknown) {
  const e = JSON.stringify(expected), a = JSON.stringify(actual);
  if (e !== a) { failures++; console.error(`MISMATCH ${label}\n  db:    ${e}\n  store: ${a}`); }
}

const dbProjects = all<any>("projects");
check("project count", dbProjects.length, listProjects(store, { includeArchived: true }).length);

for (const row of dbProjects) {
  const detail = getProjectDetail(store, row.id, { postsLimit: 1000 });
  if (!detail) { failures++; console.error(`MISSING project ${row.slug}`); continue; }
  const p = detail.project;
  check(`${row.slug}.project`,
    [row.id, row.slug, row.name, row.description, row.category, row.status, row.priority, row.health, row.pinned, row.created_at, row.updated_at, row.last_activity_at],
    [p.id, p.slug, p.name, p.description, p.category, p.status, p.priority, p.health, p.pinned, p.createdAt, p.updatedAt, p.lastActivityAt]);

  const dbTasks = all<any>("tasks").filter((t) => t.project_id === row.id && !t.deleted_at);
  check(`${row.slug}.tasks`,
    dbTasks.map((t) => [t.id, t.title, t.description ?? "", t.status, t.priority ?? null, t.agent_ready, t.claimed_by ?? null, t.due_date ?? null, t.author]).sort(),
    detail.tasks.map((t) => [t.id, t.title, t.description, t.status, t.priority, t.agentReady, t.claimedBy, t.dueDate, t.author]).sort());

  const dbUpdates = all<any>("updates").filter((u) => u.project_id === row.id);
  check(`${row.slug}.posts`,
    dbUpdates.map((u) => [u.id, u.type, u.body, u.author, u.created_at]).sort(),
    detail.posts.map((post) => [post.id, post.type, post.body, post.author, post.createdAt]).sort());

  const dbLinks = all<any>("links").filter((l) => l.project_id === row.id && !l.deleted_at);
  check(`${row.slug}.links`,
    dbLinks.map((l) => [l.id, l.provider, l.kind, l.url, l.external_id ?? null, l.title ?? "", l.scope ? JSON.parse(l.scope) : null]).sort(),
    detail.links.map((l) => [l.id, l.provider, l.kind, l.url, l.externalId, l.title, l.scope]).sort());

  const dbWarnings = all<any>("warnings").filter((w) => w.project_id === row.id && w.status === "open");
  check(`${row.slug}.warnings`,
    dbWarnings.map((w) => [w.id, w.severity, w.message, w.suggested_action ?? null, w.raised_by]).sort(),
    detail.openWarnings.map((w) => [w.id, w.severity, w.message, w.suggestedAction, w.raisedBy]).sort());

  const dbSummaries = all<any>("summaries").filter((s) => s.project_id === row.id && s.kind === "project_summary");
  check(`${row.slug}.summaryHistory`,
    dbSummaries.map((s) => [s.id, s.body, s.generated_by]).sort(),
    listSummaryHistory(store, row.id, 1000).map((s) => [s.id, s.body, s.generatedBy]).sort());

  const dbDeleted = all<any>("tasks").filter((t) => t.project_id === row.id && t.deleted_at);
  check(`${row.slug}.deletedTasks`, dbDeleted.map((t) => t.id).sort(), listDeleted(store, row.id).tasks.map((t) => t.id).sort());
}

const dbReports = all<any>("summaries").filter((s) => s.project_id === null);
check("reports", dbReports.map((s) => [s.id, s.kind, s.body, s.generated_by]).sort(),
  listReports(store, undefined, 1000).map((s) => [s.id, s.kind, s.body, s.generatedBy]).sort());

console.log(failures === 0 ? "✅ migrated tree matches the database exactly" : `❌ ${failures} mismatches`);
process.exit(failures === 0 ? 0 : 1);
