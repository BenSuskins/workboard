import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

const DDL = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'coding',
  status TEXT NOT NULL DEFAULT 'active',
  priority TEXT NOT NULL DEFAULT 'medium',
  health TEXT NOT NULL DEFAULT 'green',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  due_date TEXT,
  author TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);

CREATE TABLE IF NOT EXISTS updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
  body TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS updates_project_idx ON updates(project_id);
CREATE INDEX IF NOT EXISTS updates_created_idx ON updates(created_at);

CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'agent',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS summaries_project_idx ON summaries(project_id);
CREATE INDEX IF NOT EXISTS summaries_kind_idx ON summaries(kind);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  scope TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS links_project_idx ON links(project_id);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL UNIQUE REFERENCES links(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
`;

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

export function openDb(path: string = defaultDbPath()): Db {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  return drizzle(sqlite, { schema });
}

let shared: Db | undefined;

/** Process-wide shared connection (web app and MCP server each get their own; WAL makes that safe). */
export function getDb(): Db {
  shared ??= openDb();
  return shared;
}
