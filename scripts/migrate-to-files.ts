/**
 * One-time migration from the SQLite database to the markdown store.
 * Reads data/workboard.db and writes data/workboard/. Run once:
 *   npx tsx scripts/migrate-to-files.ts [--db <path>] [--out <dir>] [--force]
 */
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { defaultDataDir, openStore, writeJson, writeLink, writePost, writeProject, writeSummary, writeTask, writeWarning } from "@workboard/core";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const out = resolve(arg("out", defaultDataDir()));
const dbPath = resolve(arg("db", join(dirname(out), "workboard.db")));

if (!existsSync(dbPath)) {
  console.error(`No database at ${dbPath}`);
  process.exit(1);
}
if (existsSync(out) && readdirSync(out).length > 0) {
  if (!process.argv.includes("--force")) {
    console.error(`${out} is not empty. Pass --force to replace it.`);
    process.exit(1);
  }
  rmSync(out, { recursive: true, force: true });
}

const sqlite = new Database(dbPath, { readonly: true });
const all = <T>(table: string): T[] => sqlite.prepare(`SELECT * FROM ${table}`).all() as T[];
const store = openStore(out);

/* eslint-disable @typescript-eslint/no-explicit-any */
const projects = all<any>("projects");
const slugById = new Map<number, string>(projects.map((p) => [p.id, p.slug]));

for (const row of projects) {
  writeProject(store, {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    status: row.status,
    priority: row.priority,
    health: row.health,
    pinned: row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActivityAt: row.last_activity_at,
  });
}

for (const row of all<any>("tasks")) {
  writeTask(store, slugById.get(row.project_id)!, {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    priority: row.priority ?? null,
    agentReady: row.agent_ready ?? 0,
    claimedBy: row.claimed_by ?? null,
    claimedAt: row.claimed_at ?? null,
    dueDate: row.due_date ?? null,
    author: row.author,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
  });
}

for (const row of all<any>("updates")) {
  writePost(store, slugById.get(row.project_id)!, {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    body: row.body,
    author: row.author,
    createdAt: row.created_at,
  });
}

for (const row of all<any>("summaries")) {
  writeSummary(store, row.project_id ? slugById.get(row.project_id)! : null, {
    id: row.id,
    projectId: row.project_id ?? null,
    kind: row.kind,
    body: row.body,
    generatedBy: row.generated_by,
    createdAt: row.created_at,
  });
}

for (const row of all<any>("links")) {
  writeLink(store, slugById.get(row.project_id)!, {
    id: row.id,
    projectId: row.project_id,
    provider: row.provider,
    kind: row.kind,
    url: row.url,
    externalId: row.external_id ?? null,
    title: row.title ?? "",
    scope: row.scope ? JSON.parse(row.scope) : null,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? null,
  });
}

for (const row of all<any>("warnings")) {
  writeWarning(store, slugById.get(row.project_id)!, {
    id: row.id,
    projectId: row.project_id,
    severity: row.severity,
    message: row.message,
    suggestedAction: row.suggested_action ?? null,
    status: row.status,
    raisedBy: row.raised_by,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? null,
  });
}

for (const row of all<any>("snapshots")) {
  writeJson(store, join(out, ".cache", "snapshots", `${row.link_id}.json`), {
    id: row.id,
    linkId: row.link_id,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
    fetchedAt: row.fetched_at,
  });
}

for (const row of all<any>("sync_state")) {
  writeJson(store, join(out, ".cache", "sync-state", `${row.link_id}.json`), {
    id: row.id,
    linkId: row.link_id,
    lastAttemptAt: row.last_attempt_at,
    lastSuccessAt: row.last_success_at ?? null,
    lastError: row.last_error ?? null,
  });
}

// Seed the id ledgers past every migrated id so new entities never collide.
const ledgers: Record<string, number[]> = {
  projects: projects.map((r) => r.id),
  tasks: all<any>("tasks").map((r) => r.id),
  posts: all<any>("updates").map((r) => r.id),
  summaries: all<any>("summaries").map((r) => r.id),
  links: all<any>("links").map((r) => r.id),
  warnings: all<any>("warnings").map((r) => r.id),
  comments: [] as number[],
  snapshots: all<any>("snapshots").map((r) => r.id),
  syncState: all<any>("sync_state").map((r) => r.id),
};
function mark(path: string, contents = ""): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

for (const [entity, ids] of Object.entries(ledgers)) {
  for (const id of ids) mark(join(out, ".seq", entity, String(id)));
}

// Claimed tasks keep their claim marker, or a re-run of the queue would double-claim them.
for (const row of all<any>("tasks")) {
  if (row.claimed_by) {
    mark(join(out, "projects", slugById.get(row.project_id)!, "tasks", ".claims", String(row.id).padStart(4, "0")), row.claimed_by);
  }
}

console.log(`Migrated ${projects.length} projects into ${out}`);
for (const [entity, ids] of Object.entries(ledgers)) console.log(`  ${entity}: ${ids.length}`);
