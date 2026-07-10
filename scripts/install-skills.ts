/** Copies the bundled skills into ~/.claude/skills so any Claude Code session can use them. */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const src = resolve(import.meta.dirname, "../skills");
const dest = join(homedir(), ".claude", "skills");
mkdirSync(dest, { recursive: true });

for (const skill of readdirSync(src)) {
  const from = join(src, skill);
  if (!existsSync(join(from, "SKILL.md"))) continue;
  cpSync(from, join(dest, skill), { recursive: true });
  console.log(`installed ${skill} → ${join(dest, skill)}`);
}
console.log("\nDone. Skills are available in Claude Code as /workboard-status, /workboard-digest, /workboard-triage.");
