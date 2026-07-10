#!/usr/bin/env node
// stdio entrypoint — set WORKBOARD_DB_PATH if the db isn't at <cwd>/data/workboard.db
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "..", "src", "stdio.ts");
const result = spawnSync("npx", ["tsx", entry], { stdio: "inherit" });
process.exit(result.status ?? 1);
