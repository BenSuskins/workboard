import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Resolved from this module's location (not cwd) so every workspace process finds
// packages/core/drizzle regardless of where it was started. Built via join() rather
// than new URL("...", import.meta.url) so bundlers don't treat it as an asset import.
const migrationsFolder = join(fileURLToPath(import.meta.url), "../../../drizzle");

/**
 * Workspace processes run with different cwds (repo root, apps/web, packages/mcp),
 * so walk up to the monorepo root (package.json with "workspaces") and share one
 * data/workboard.db. WORKBOARD_DB_PATH overrides.
 */
export function defaultDbPath(): string {
  if (process.env.WORKBOARD_DB_PATH) return process.env.WORKBOARD_DB_PATH;
  let dir = process.cwd();
  while (true) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, "utf8")).workspaces) return join(dir, "data/workboard.db");
      } catch {
        // unreadable package.json — keep walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), "data/workboard.db");
}

/**
 * Columns added after the original raw-DDL bootstrap shipped. Migration 0000 uses
 * CREATE TABLE IF NOT EXISTS, so it cannot retrofit columns onto pre-existing
 * tables — backfill them here before the migrator runs (no-op on fresh DBs).
 */
function backfillLegacyColumns(sqlite: Database.Database): void {
  const ensureColumn = (table: string, column: string, ddl: string) => {
    const cols = sqlite.pragma(`table_info(${table})`) as { name: string }[];
    if (!cols.some((c) => c.name === column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  ensureColumn("tasks", "deleted_at", "deleted_at INTEGER");
  ensureColumn("links", "deleted_at", "deleted_at INTEGER");
}

export function openDb(path: string = defaultDbPath()): Db {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  // Only relevant when the database predates drizzle-kit migrations; cheap either way.
  const tasksTable = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'")
    .get();
  if (tasksTable) backfillLegacyColumns(sqlite);
  const db = drizzle(sqlite, { schema });
  // Web and MCP processes cold-boot together (compose), so two migrators can race:
  // the loser fails on an already-applied column. Retrying is safe — by then the
  // winner has journaled the migrations and they are skipped.
  for (let attempt = 1; ; attempt++) {
    try {
      migrate(db, { migrationsFolder });
      break;
    } catch (error) {
      if (attempt >= 3) throw error;
      sleepSync(250 * attempt);
    }
  }
  return db;
}

let shared: Db | undefined;

/** Process-wide shared connection (web app and MCP server each get their own; WAL makes that safe). */
export function getDb(): Db {
  shared ??= openDb();
  return shared;
}
