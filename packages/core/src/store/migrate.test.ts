import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { addPost, addTask, claimTask, getProjectDetail, listProjects, listQueuedTasks } from "../services.js";
import { legacyDbPath } from "./migrate.js";
import { openStore } from "./store.js";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DatabaseSync } = require("node:sqlite") as any;

let dataDir: string;
beforeEach(() => {
  dataDir = join(mkdtempSync(join(tmpdir(), "wb-migrate-")), "workboard");
});

/** A board in the shape the SQLite build left behind. */
function writeLegacyDb(path: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE projects (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, description TEXT, category TEXT,
      status TEXT, priority TEXT, health TEXT, pinned INTEGER, created_at INTEGER, updated_at INTEGER, last_activity_at INTEGER);
    CREATE TABLE tasks (id INTEGER PRIMARY KEY, project_id INTEGER, title TEXT, description TEXT, status TEXT,
      priority TEXT, agent_ready INTEGER, claimed_by TEXT, claimed_at INTEGER, due_date TEXT, author TEXT,
      created_at INTEGER, updated_at INTEGER, deleted_at INTEGER);
    CREATE TABLE updates (id INTEGER PRIMARY KEY, project_id INTEGER, type TEXT, body TEXT, author TEXT, created_at INTEGER);
    CREATE TABLE summaries (id INTEGER PRIMARY KEY, project_id INTEGER, kind TEXT, body TEXT, generated_by TEXT, created_at INTEGER);
    CREATE TABLE links (id INTEGER PRIMARY KEY, project_id INTEGER, provider TEXT, kind TEXT, url TEXT,
      external_id TEXT, title TEXT, scope TEXT, created_at INTEGER, deleted_at INTEGER);
    CREATE TABLE warnings (id INTEGER PRIMARY KEY, project_id INTEGER, severity TEXT, message TEXT,
      suggested_action TEXT, status TEXT, raised_by TEXT, created_at INTEGER, resolved_at INTEGER);
    CREATE TABLE snapshots (id INTEGER PRIMARY KEY, link_id INTEGER, data TEXT, fetched_at INTEGER);
    CREATE TABLE sync_state (id INTEGER PRIMARY KEY, link_id INTEGER, last_attempt_at INTEGER, last_success_at INTEGER, last_error TEXT);

    INSERT INTO projects VALUES (1,'alpha','Alpha','Ship it','coding','active','high','green',1,100,100,100);
    INSERT INTO projects VALUES (2,'beta','Beta','','coding','archived','medium','amber',0,100,100,100);
    INSERT INTO tasks VALUES (1,1,'Open work','the spec','todo',NULL,1,NULL,NULL,NULL,'user',100,100,NULL);
    INSERT INTO tasks VALUES (2,1,'Taken','','in_progress','high',1,'agent:one',150,NULL,'user',100,150,NULL);
    INSERT INTO tasks VALUES (3,1,'Gone','','todo',NULL,0,NULL,NULL,NULL,'user',100,100,900);
    INSERT INTO updates VALUES (1,1,'agent_update','Shipped the thing.','agent:one',120);
    INSERT INTO updates VALUES (2,2,'note','Beta note','user',130);
    INSERT INTO summaries VALUES (1,1,'project_summary','Alpha is moving.','agent:one',140);
    INSERT INTO summaries VALUES (2,NULL,'digest','Everything is fine.','agent:one',145);
    INSERT INTO links VALUES (1,1,'github','repo','https://github.com/a/b','a/b','','{"labels":["pay"]}',100,NULL);
    INSERT INTO warnings VALUES (1,1,'critical','CI is red','Fix the build','open','agent:one',160,NULL);
    INSERT INTO snapshots VALUES (1,1,'{"type":"repo","prs":[]}',170);
    INSERT INTO sync_state VALUES (1,1,170,170,NULL);
  `);
  db.close();
}

describe("legacy migration", () => {
  it("converts an old database the first time the store is opened", () => {
    writeLegacyDb(legacyDbPath(dataDir));
    const store = openStore(dataDir);

    expect(listProjects(store, { includeArchived: true }).map((p) => p.slug)).toEqual(["alpha", "beta"]);
    const alpha = getProjectDetail(store, "alpha")!;
    expect(alpha.project.pinned).toBe(1);
    expect(alpha.project.description).toBe("Ship it");
    expect(alpha.posts.map((p) => p.body)).toEqual(["Shipped the thing."]);
    expect(alpha.latestSummary!.body).toBe("Alpha is moving.");
    expect(alpha.openWarnings[0].suggestedAction).toBe("Fix the build");
    expect(alpha.links[0].scope).toEqual({ labels: ["pay"] });
    expect(alpha.links[0].snapshot!.data).toEqual({ type: "repo", prs: [] });
    // The soft-deleted task stays out of the live list.
    expect(alpha.tasks.map((t) => t.title)).toEqual(["Taken", "Open work"]);
  });

  it("keeps a claimed task claimed, so the queue cannot hand it out twice", () => {
    writeLegacyDb(legacyDbPath(dataDir));
    const store = openStore(dataDir);

    expect(listQueuedTasks(store).map((t) => t.id)).toEqual([1]);
    expect(() => claimTask(store, 2, "agent:two")).toThrow(/already claimed by agent:one/);
  });

  it("continues ids past the migrated ones instead of colliding", () => {
    writeLegacyDb(legacyDbPath(dataDir));
    const store = openStore(dataDir);
    const alpha = listProjects(store)[0];

    expect(addTask(store, alpha.id, "New").id).toBe(4);
    expect(addPost(store, alpha.id, "New post").id).toBe(3);
  });

  it("does not run again once the tree exists", () => {
    writeLegacyDb(legacyDbPath(dataDir));
    const first = openStore(dataDir);
    const alpha = listProjects(first)[0];
    addPost(first, alpha.id, "written after the migration");

    const second = openStore(dataDir);
    expect(getProjectDetail(second, "alpha")!.posts.map((p) => p.body)).toContain("written after the migration");
  });

  it("does nothing when there is no legacy database", () => {
    const store = openStore(dataDir);
    expect(listProjects(store)).toEqual([]);
    expect(existsSync(join(dataDir, ".migrating"))).toBe(false);
  });

  it("migrates exactly once when several processes cold-boot together", () => {
    writeLegacyDb(legacyDbPath(dataDir));
    const worker = join(dataDir, "..", "worker.ts");
    const storeModule = new URL("./store.ts", import.meta.url).pathname;
    writeFileSync(
      worker,
      `import { openStore } from "${storeModule}";\n` +
        `import { listProjects } from "${new URL("../services.ts", import.meta.url).pathname}";\n` +
        `const s = openStore("${dataDir}");\n` +
        `console.log(JSON.stringify(listProjects(s, { includeArchived: true }).map((p) => p.slug)));\n`,
    );
    const out = execFileSync(
      "bash",
      ["-c", `for i in $(seq 1 6); do node --import tsx ${worker} & done; wait`],
      { encoding: "utf8", cwd: new URL("../../../..", import.meta.url).pathname },
    );
    const lines = out.trim().split("\n").filter((line) => line.startsWith("[\""));
    expect(lines).toHaveLength(6);
    // Every process must see the same board: no partial or doubled migration.
    for (const line of lines) expect(JSON.parse(line)).toEqual(["alpha", "beta"]);
    expect(readFileSync(join(dataDir, "projects", "alpha", "project.md"), "utf8")).toContain('name: "Alpha"');
  });
});
