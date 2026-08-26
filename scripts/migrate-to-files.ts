/**
 * Converts a pre-markdown SQLite board into the file tree.
 *
 * You should not normally need this: the servers migrate themselves on first
 * start. Use it to convert a database that is not sitting next to the data
 * directory, or to redo a conversion with --force.
 *
 *   npx tsx scripts/migrate-to-files.ts [--db <path>] [--out <dir>] [--force]
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { convertLegacyDb, defaultDataDir } from "@workboard/core";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
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

const counts = convertLegacyDb(dbPath, out);
console.log(`Migrated ${dbPath} into ${out}`);
for (const [entity, count] of Object.entries(counts)) console.log(`  ${entity}: ${count}`);
