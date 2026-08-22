import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "./client.js";

/**
 * The raw-DDL bootstrap that shipped before drizzle-kit migrations, verbatim from
 * the original client.ts minus the columns that were added later via ensureColumn.
 * openDb must upgrade databases in this shape without losing data.
 */
const LEGACY_DDL = `
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
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
`;

function openRaw(path: string): Database.Database {
  return new Database(path);
}

function columnNames(path: string, table: string): string[] {
  const raw = openRaw(path);
  const cols = raw.pragma(`table_info(${table})`) as { name: string }[];
  raw.close();
  return cols.map((c) => c.name);
}

describe("openDb migration", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = join(mkdtempSync(join(tmpdir(), "workboard-migrate-")), "workboard.db");
  });

  it("upgrades a legacy database: backfills late columns, applies migrations, keeps data", () => {
    const legacy = openRaw(dbPath);
    legacy.exec(LEGACY_DDL);
    legacy
      .prepare(
        "INSERT INTO projects (slug, name, created_at, updated_at, last_activity_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run("legacy-proj", "Legacy", 1, 1, 1);
    legacy
      .prepare("INSERT INTO tasks (project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(1, "Legacy task", 1, 1);
    legacy.close();

    openDb(dbPath);

    expect(columnNames(dbPath, "tasks")).toContain("deleted_at");
    expect(columnNames(dbPath, "links")).toContain("deleted_at");

    const raw = openRaw(dbPath);
    const rows = raw
      .prepare("SELECT p.slug AS slug, t.title AS title FROM projects p JOIN tasks t ON t.project_id = p.id")
      .all();
    expect(rows).toEqual([{ slug: "legacy-proj", title: "Legacy task" }]);
    raw.close();

    openDb(dbPath);
    const reopened = openRaw(dbPath);
    const count = reopened.prepare("SELECT count(*) AS n FROM tasks").get() as { n: number };
    expect(count.n).toBe(1);
    reopened.close();
  });

  it("initializes a fresh database through the same path", () => {
    openDb(dbPath);
    const raw = openRaw(dbPath);
    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    for (const expected of [
      "projects",
      "tasks",
      "links",
      "updates",
      "summaries",
      "warnings",
      "snapshots",
      "sync_state",
    ]) {
      expect(names).toContain(expected);
    }
    raw.close();
  });
});
