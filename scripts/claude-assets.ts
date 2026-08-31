/**
 * Discovery and validation for the Claude Code assets this repo ships:
 * `skills/<name>/SKILL.md` and `agents/<name>.md`.
 *
 * The installer validates with this before copying anything, and the tests
 * assert against it, so a broken profile fails CI rather than landing in
 * `~/.claude/agents/` where the failure is silent.
 *
 * Note this deliberately does NOT reuse `packages/core/src/store/frontmatter.ts`:
 * that parser JSON-decodes every value, which is right for the board's markdown
 * store and wrong for YAML frontmatter (`name: workboard-status` would throw).
 * Domain code also has no business knowing about `~/.claude`.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";

export type AssetKind = "skill" | "agent";

export interface Asset {
  kind: AssetKind;
  /** Expected frontmatter name: the directory for a skill, the basename for an agent. */
  name: string;
  /** The markdown file to read. */
  file: string;
  /** What the installer copies: the skill's directory, or the agent's file. */
  source: string;
}

export interface Document {
  fields: Record<string, string>;
  body: string;
}

const FENCE = "---";

/** Frontmatter as Claude Code reads it: `key: value` lines, values are plain strings. */
export function parseFrontmatter(raw: string, source = "<memory>"): Document {
  // A file saved with CRLF is still a valid asset; without this it fails on the
  // opening fence, which reads as "you have no frontmatter" rather than the truth.
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.startsWith(`${FENCE}\n`)) throw new Error(`${source}: missing opening frontmatter fence`);
  const end = closingFence(text);
  if (end === -1) throw new Error(`${source}: unterminated frontmatter`);

  const fields: Record<string, string> = {};
  for (const line of text.slice(FENCE.length + 1, end + 1).split("\n")) {
    if (!line.trim()) continue;
    const split = line.indexOf(":");
    if (split === -1) throw new Error(`${source}: malformed frontmatter line: ${line}`);
    const key = line.slice(0, split).trim();
    if (!key) throw new Error(`${source}: malformed frontmatter line: ${line}`);
    fields[key] = unquote(line.slice(split + 1).trim());
  }
  return { fields, body: text.slice(end + 1 + FENCE.length).trim() };
}

/** The next line that is exactly `---`. Matching a prefix would let `----` truncate the frontmatter. */
function closingFence(text: string): number {
  for (let at = text.indexOf(`\n${FENCE}`, FENCE.length); at !== -1; at = text.indexOf(`\n${FENCE}`, at + 1)) {
    const after = text.charAt(at + 1 + FENCE.length);
    if (after === "" || after === "\n") return at;
  }
  return -1;
}

function unquote(value: string): string {
  const quoted = /^(["'])(.*)\1$/s.exec(value);
  return quoted ? quoted[2] : value;
}

export function skillsDir(repoRoot: string): string {
  return join(repoRoot, "skills");
}

export function agentsDir(repoRoot: string): string {
  return join(repoRoot, "agents");
}

export function discoverSkills(repoRoot: string): Asset[] {
  const dir = skillsDir(repoRoot);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => ({ kind: "skill" as const, name, file: join(dir, name, "SKILL.md"), source: join(dir, name) }))
    .filter((asset) => existsSync(asset.file))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function discoverAgents(repoRoot: string): Asset[] {
  const dir = agentsDir(repoRoot);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({
      kind: "agent" as const,
      name: basename(file, ".md"),
      file: join(dir, file),
      source: join(dir, file),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Frontmatter keys a shipped profile may use — the subset stable across Claude Code versions. */
export const AGENT_FIELDS = ["name", "description", "tools", "model", "color"] as const;

const MODEL_ALIASES = ["sonnet", "opus", "haiku", "fable", "inherit"];

/** Every tool the MCP server registers, read from the source rather than duplicated here. */
export function mcpToolNames(repoRoot: string): string[] {
  const source = readFileSync(join(repoRoot, "packages/mcp/src/tools.ts"), "utf8");
  const names = [...source.matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map((match) => match[1]);
  if (names.length === 0) throw new Error("no MCP tools found in packages/mcp/src/tools.ts — has registerTool been renamed?");
  return names;
}

export function splitTools(tools: string): string[] {
  return tools.split(",").map((tool) => tool.trim());
}

/** Returns every problem with one asset. Empty means it is fit to install. */
export function validateAsset(asset: Asset, mcpTools?: string[]): string[] {
  const problems: string[] = [];
  const label = asset.file;

  let doc: Document;
  try {
    doc = parseFrontmatter(readFileSync(asset.file, "utf8"), label);
  } catch (error) {
    return [(error as Error).message];
  }

  const { fields, body } = doc;
  for (const required of ["name", "description"]) {
    if (!fields[required]?.trim()) problems.push(`${label}: frontmatter "${required}" is missing or empty`);
  }
  if (fields.name && fields.name !== asset.name) {
    problems.push(`${label}: frontmatter name "${fields.name}" does not match "${asset.name}"`);
  }
  if (!body) problems.push(`${label}: body is empty`);

  if (asset.kind === "agent") {
    for (const key of Object.keys(fields)) {
      if (!(AGENT_FIELDS as readonly string[]).includes(key)) {
        problems.push(`${label}: unsupported frontmatter key "${key}" (allowed: ${AGENT_FIELDS.join(", ")})`);
      }
    }
    if (fields.model && !MODEL_ALIASES.includes(fields.model) && !fields.model.startsWith("claude-")) {
      problems.push(`${label}: model "${fields.model}" is not an alias (${MODEL_ALIASES.join("|")}) or a claude-* id`);
    }
    if (fields.tools !== undefined) problems.push(...validateTools(label, fields.tools, mcpTools));
  }

  return problems;
}

function validateTools(label: string, tools: string, mcpTools?: string[]): string[] {
  const problems: string[] = [];
  if (tools.includes("\n") || tools.trimStart().startsWith("- ")) {
    problems.push(`${label}: tools must be a comma-separated list on one line, not a YAML list`);
    return problems;
  }
  const names = splitTools(tools);
  if (names.some((name) => !name)) problems.push(`${label}: tools has an empty entry`);
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) problems.push(`${label}: tools lists "${name}" twice`);
    seen.add(name);
    if (!name.startsWith("mcp__")) continue;
    const match = /^mcp__workboard__([a-z_]+)$/.exec(name);
    if (!match) {
      problems.push(`${label}: "${name}" is not a mcp__workboard__<tool> reference`);
    } else if (mcpTools && !mcpTools.includes(match[1])) {
      problems.push(`${label}: "${name}" names an MCP tool the server does not register`);
    }
  }
  return problems;
}

export function repoRoot(): string {
  return resolve(import.meta.dirname, "..");
}
