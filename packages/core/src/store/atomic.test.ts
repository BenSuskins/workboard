import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { allocateId, createExclusive, mkdirExclusive, readFileSyncSafe, withFileLock, writeFileAtomic } from "./atomic.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wb-atomic-"));
});

describe("writeFileAtomic", () => {
  it("creates parent directories and overwrites in place", () => {
    const path = join(dir, "nested", "deep", "file.md");
    writeFileAtomic(path, "first");
    writeFileAtomic(path, "second");
    expect(readFileSync(path, "utf8")).toBe("second");
  });

  it("leaves no temp files behind", () => {
    writeFileAtomic(join(dir, "file.md"), "x");
    expect(readdirSync(dir)).toEqual(["file.md"]);
  });
});

describe("createExclusive", () => {
  it("succeeds once and reports false afterwards", () => {
    const path = join(dir, "claim");
    expect(createExclusive(path, "agent-a")).toBe(true);
    expect(createExclusive(path, "agent-b")).toBe(false);
    expect(readFileSyncSafe(path)).toBe("agent-a");
  });
});

describe("mkdirExclusive", () => {
  it("reports which caller created the directory", () => {
    const path = join(dir, "projects", "alpha");
    expect(mkdirExclusive(path)).toBe(true);
    expect(mkdirExclusive(path)).toBe(false);
  });
});

describe("allocateId", () => {
  it("issues consecutive ids from an empty ledger", () => {
    const ledger = join(dir, "seq");
    expect([allocateId(ledger), allocateId(ledger), allocateId(ledger)]).toEqual([1, 2, 3]);
  });

  it("resumes above the highest existing id", () => {
    const ledger = join(dir, "seq");
    createExclusive(join(ledger, "7"));
    expect(allocateId(ledger)).toBe(8);
  });
});

describe("withFileLock", () => {
  it("releases the lock even when the body throws", () => {
    const path = join(dir, "project.md");
    expect(() => withFileLock(path, () => { throw new Error("boom"); })).toThrow("boom");
    expect(withFileLock(path, () => "ran")).toBe("ran");
  });

  it("breaks a lock abandoned by a dead writer", () => {
    const path = join(dir, "project.md");
    const lock = `${path}.lock`;
    writeFileSync(lock, "99999");
    execFileSync("touch", ["-t", "202001010000", lock]);
    expect(withFileLock(path, () => "recovered")).toBe("recovered");
  });
});

/**
 * The property the whole agent queue rests on. Separate OS processes, not
 * threads, because that is how the web and MCP servers actually race.
 */
describe("cross-process exclusivity", () => {
  const WORKERS = 12;

  const repoRoot = new URL("../../../..", import.meta.url).pathname;

  /** cwd is the repo root so a worker can resolve tsx and the workspace packages. */
  function runWorkers(script: string, ext = "mjs"): string[] {
    const workerPath = join(dir, `worker.${ext}`);
    writeFileSync(workerPath, script);
    const runner = ext === "ts" ? `node --import tsx ${workerPath}` : `node ${workerPath}`;
    const out = execFileSync("bash", ["-c", `for i in $(seq 1 ${WORKERS}); do ${runner} $i & done; wait`], {
      encoding: "utf8",
      cwd: repoRoot,
    });
    return out.trim().split("\n").filter(Boolean);
  }

  it("lets exactly one process win a claim", () => {
    const results = runWorkers(`
      import { openSync, closeSync } from "node:fs";
      try {
        closeSync(openSync("${join(dir, "task-1.claim")}", "wx"));
        console.log("won:" + process.argv[2]);
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
        console.log("lost:" + process.argv[2]);
      }
    `);
    expect(results.filter((r) => r.startsWith("won:"))).toHaveLength(1);
    expect(results.filter((r) => r.startsWith("lost:"))).toHaveLength(WORKERS - 1);
  });

  it("never issues the same id twice", () => {
    const ledger = join(dir, "seq");
    const atomicModule = new URL("./atomic.ts", import.meta.url).pathname;
    const results = runWorkers(
      `import { allocateId } from "${atomicModule}";\nconsole.log(String(allocateId("${ledger}")));\n`,
      "ts",
    );
    const ids = results.map(Number).sort((a, b) => a - b);
    expect(new Set(ids).size).toBe(WORKERS);
    expect(ids).toEqual(Array.from({ length: WORKERS }, (_, i) => i + 1));
  });
});
