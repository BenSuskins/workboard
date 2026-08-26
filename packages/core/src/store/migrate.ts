/**
 * Converts a pre-markdown SQLite board into the file tree, using Node's built-in
 * `node:sqlite` so no dependency is needed to read the old format.
 *
 * `openStore` calls `migrateLegacyIfNeeded` on every open, which is why the
 * guard is a single `existsSync`: once the tree exists, this costs one stat.
 * A deployment upgrades by starting; nobody runs a migration by hand.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createExclusive } from "./atomic.js";
import * as p from "./paths.js";
// store.ts imports this module in turn; the cycle is safe because both sides
// only reach across at call time, and function declarations are hoisted.
import { writeJson, writeLink, writePost, writeProject, writeSummary, writeTask, writeWarning, type Store } from "./store.js";

/** The database the markdown tree replaced, alongside it: data/workboard.db next to data/workboard/. */
export function legacyDbPath(root: string): string {
  return join(dirname(root), "workboard.db");
}

interface LegacyRow {
  [column: string]: string | number | null;
}

function openLegacy(dbPath: string): { all: (table: string) => LegacyRow[]; close: () => void } {
  let DatabaseSync: new (path: string, opts?: { readOnly?: boolean }) => {
    prepare: (sql: string) => { all: () => LegacyRow[] };
    close: () => void;
  };
  try {
    // Lazily resolved: a Node without node:sqlite must still run a board that
    // has no legacy database to convert.
    ({ DatabaseSync } = createRequire(import.meta.url)("node:sqlite"));
  } catch {
    throw new Error(
      `Found a legacy board at ${dbPath} but this Node build has no node:sqlite to read it. ` +
        `Upgrade to Node 22.13+ or convert it elsewhere with 'npm run migrate:files'.`,
    );
  }
  const db = new DatabaseSync(dbPath, { readOnly: true });
  return {
    all: (table) => db.prepare(`SELECT * FROM ${table}`).all(),
    close: () => db.close(),
  };
}

const num = (value: unknown): number => Number(value ?? 0);
const str = (value: unknown): string => String(value ?? "");
const nullableStr = (value: unknown): string | null => (value === null || value === undefined ? null : String(value));
const nullableNum = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

/**
 * Convert `dbPath` into a fresh tree at `root`. Assumes `root` is empty —
 * callers decide whether that is true.
 */
export function convertLegacyDb(dbPath: string, root: string): Record<string, number> {
  const legacy = openLegacy(dbPath);
  const handle: Store = { root };
  mkdirSync(root, { recursive: true });

  try {
    const projects = legacy.all("projects");
    const slugById = new Map<number, string>(projects.map((row) => [num(row.id), str(row.slug)]));
    const slugFor = (projectId: unknown): string => {
      const slug = slugById.get(num(projectId));
      if (!slug) throw new Error(`Legacy row references unknown project ${String(projectId)}`);
      return slug;
    };

    for (const row of projects) {
      writeProject(handle, {
        id: num(row.id),
        slug: str(row.slug),
        name: str(row.name),
        description: str(row.description),
        category: str(row.category),
        // The SQLite schema predates tile identity; both fall back at render time.
        icon: null,
        accent: null,
        status: str(row.status) as never,
        priority: str(row.priority) as never,
        health: str(row.health) as never,
        pinned: num(row.pinned),
        createdAt: num(row.created_at),
        updatedAt: num(row.updated_at),
        lastActivityAt: num(row.last_activity_at),
      });
    }

    const tasks = legacy.all("tasks");
    for (const row of tasks) {
      writeTask(handle, slugFor(row.project_id), {
        id: num(row.id),
        projectId: num(row.project_id),
        title: str(row.title),
        description: str(row.description),
        status: str(row.status) as never,
        priority: nullableStr(row.priority) as never,
        agentReady: num(row.agent_ready),
        claimedBy: nullableStr(row.claimed_by),
        claimedAt: nullableNum(row.claimed_at),
        dueDate: nullableStr(row.due_date),
        author: str(row.author),
        createdAt: num(row.created_at),
        updatedAt: num(row.updated_at),
        deletedAt: nullableNum(row.deleted_at),
      });
      // A claimed task keeps its marker, or the queue would hand it out twice.
      if (row.claimed_by) {
        createExclusive(p.claimFile(root, slugFor(row.project_id), num(row.id)), str(row.claimed_by));
      }
    }

    // Legacy `updates` become posts; they predate titles, so the title is empty.
    const posts = legacy.all("updates");
    for (const row of posts) {
      writePost(handle, slugFor(row.project_id), {
        id: num(row.id),
        projectId: num(row.project_id),
        type: str(row.type) as never,
        title: "",
        body: str(row.body),
        author: str(row.author),
        createdAt: num(row.created_at),
        answeredAt: null,
      });
    }

    const summaries = legacy.all("summaries");
    for (const row of summaries) {
      writeSummary(handle, row.project_id === null ? null : slugFor(row.project_id), {
        id: num(row.id),
        projectId: nullableNum(row.project_id),
        kind: str(row.kind) as never,
        body: str(row.body),
        generatedBy: str(row.generated_by),
        createdAt: num(row.created_at),
      });
    }

    const links = legacy.all("links");
    for (const row of links) {
      writeLink(handle, slugFor(row.project_id), {
        id: num(row.id),
        projectId: num(row.project_id),
        provider: str(row.provider) as never,
        kind: str(row.kind) as never,
        url: str(row.url),
        externalId: nullableStr(row.external_id),
        title: str(row.title),
        scope: row.scope ? JSON.parse(str(row.scope)) : null,
        createdAt: num(row.created_at),
        deletedAt: nullableNum(row.deleted_at),
      });
    }

    const warnings = legacy.all("warnings");
    for (const row of warnings) {
      writeWarning(handle, slugFor(row.project_id), {
        id: num(row.id),
        projectId: num(row.project_id),
        severity: str(row.severity) as never,
        message: str(row.message),
        suggestedAction: nullableStr(row.suggested_action),
        status: str(row.status) as never,
        raisedBy: str(row.raised_by),
        createdAt: num(row.created_at),
        resolvedAt: nullableNum(row.resolved_at),
      });
    }

    const snapshots = legacy.all("snapshots");
    for (const row of snapshots) {
      writeJson(handle, p.snapshotFile(root, num(row.link_id)), {
        id: num(row.id),
        linkId: num(row.link_id),
        data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
        fetchedAt: num(row.fetched_at),
      });
    }

    const syncState = legacy.all("sync_state");
    for (const row of syncState) {
      writeJson(handle, p.syncStateFile(root, num(row.link_id)), {
        id: num(row.id),
        linkId: num(row.link_id),
        lastAttemptAt: num(row.last_attempt_at),
        lastSuccessAt: nullableNum(row.last_success_at),
        lastError: nullableStr(row.last_error),
      });
    }

    // Seed each ledger past every migrated id, so new entities cannot collide.
    const counts: Record<string, number> = {};
    const ledgers: Record<string, LegacyRow[]> = { projects, tasks, posts, summaries, links, warnings, snapshots, syncState };
    for (const [entity, rows] of Object.entries(ledgers)) {
      counts[entity] = rows.length;
      for (const row of rows) {
        const marker = join(p.ledgerDir(root, entity), String(num(row.id)));
        mkdirSync(dirname(marker), { recursive: true });
        writeFileSync(marker, "");
      }
    }
    counts.comments = 0;
    mkdirSync(p.ledgerDir(root, "comments"), { recursive: true });
    return counts;
  } finally {
    legacy.close();
  }
}

const MIGRATION_WAIT_MS = 30_000;

/**
 * Upgrade a deployment in place: an empty data directory sitting next to a
 * legacy database is converted on first open. Two processes cold-booting
 * together race for a marker; the loser waits for the winner to finish rather
 * than migrating on top of it.
 */
export function migrateLegacyIfNeeded(root: string): void {
  const marker = join(root, ".migrating");

  // A migration in flight publishes `projects/` long before it finishes, so the
  // marker has to be checked first — otherwise a second process reads a
  // half-written tree and reports a board with pieces missing.
  if (existsSync(marker)) return waitForMigration(marker);
  if (existsSync(p.projectsDir(root))) return;
  const dbPath = legacyDbPath(root);
  if (!existsSync(dbPath)) return;

  mkdirSync(root, { recursive: true });
  if (!createExclusive(marker, String(process.pid))) return waitForMigration(marker);

  try {
    // Another process may have finished between our checks and winning the marker.
    if (existsSync(p.projectsDir(root))) return;
    // Anything else here predates the tree and would confuse the id ledgers.
    for (const name of readdirSyncSafeRoot(root)) {
      if (name !== ".migrating") rmSync(join(root, name), { recursive: true, force: true });
    }
    const counts = convertLegacyDb(dbPath, root);
    const total = Object.entries(counts)
      .map(([entity, n]) => `${n} ${entity}`)
      .join(", ");
    // stderr, never stdout: the MCP stdio transport owns stdout.
    console.error(`[workboard] migrated ${dbPath} to ${root} (${total})`);
  } finally {
    rmSync(marker, { force: true });
  }
}

function waitForMigration(marker: string): void {
  const deadline = Date.now() + MIGRATION_WAIT_MS;
  while (existsSync(marker) && Date.now() < deadline) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
  }
}

function readdirSyncSafeRoot(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
