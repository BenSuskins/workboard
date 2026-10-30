#!/usr/bin/env node
// stdio entrypoint — set WORKBOARD_DATA_DIR if the board isn't at <cwd>/data/workboard
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(here, "../../..");
const entry = join(here, "..", "src", "stdio.ts");
const tsx = join(repositoryRoot, "node_modules", "tsx", "dist", "cli.mjs");
const result = spawnSync("bun", [tsx, entry], {
  cwd: repositoryRoot,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
