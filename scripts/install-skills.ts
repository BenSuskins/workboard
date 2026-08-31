/**
 * Copies the bundled skills and agent profiles into the user's Claude Code
 * config directory, so any session can use them from any repo.
 *
 * Every asset is validated before anything is copied — a profile with a broken
 * frontmatter line fails loudly here rather than silently doing nothing once it
 * is sitting in ~/.claude/agents.
 */
import { cpSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { discoverAgents, discoverSkills, mcpToolNames, repoRoot, validateAsset, type Asset } from "./claude-assets.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const at = args.indexOf(`--${name}`);
  if (at === -1) return undefined;
  const value = args[at + 1];
  // Without this, `--dest --agents-only` installs into a directory named
  // "--agents-only", and a trailing `--dest` silently falls back to ~/.claude.
  if (!value || value.startsWith("--")) fail(`--${name} needs a value`);
  return value;
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const dest = option("dest") ?? process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
const wantSkills = !flag("agents-only");
const wantAgents = !flag("skills-only");
if (!wantSkills && !wantAgents) fail("--skills-only and --agents-only together install nothing");

const root = repoRoot();
const skills = wantSkills ? discoverSkills(root) : [];
const agents = wantAgents ? discoverAgents(root) : [];

const tools = mcpToolNames(root);
const problems = [...skills, ...agents].flatMap((asset) => validateAsset(asset, tools));
if (problems.length > 0) {
  console.error("Refusing to install — fix these first:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

function install(assets: Asset[], into: string) {
  if (assets.length === 0) return;
  mkdirSync(into, { recursive: true });
  for (const asset of assets) {
    const target = join(into, asset.kind === "skill" ? asset.name : `${asset.name}.md`);
    cpSync(asset.source, target, { recursive: true });
    console.log(`installed ${asset.kind} ${asset.name} → ${target}`);
  }
}

install(skills, join(dest, "skills"));
install(agents, join(dest, "agents"));

console.log("\nDone.");
if (skills.length > 0) console.log(`Skills: ${skills.map((skill) => `/${skill.name}`).join(", ")}`);
if (agents.length > 0) console.log(`Agents: ${agents.map((agent) => agent.name).join(", ")}`);
console.log("\nRestart Claude Code to pick them up. Both are inert without the workboard MCP");
console.log("server connected: claude mcp add --transport http workboard http://localhost:8787/mcp");
