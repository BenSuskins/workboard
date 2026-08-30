import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AGENT_FIELDS,
  discoverAgents,
  discoverSkills,
  mcpToolNames,
  parseFrontmatter,
  repoRoot,
  splitTools,
  validateAsset,
} from "./claude-assets.js";

const root = repoRoot();
const skills = discoverSkills(root);
const agents = discoverAgents(root);
const tools = mcpToolNames(root);

const fieldsOf = (file: string) => parseFrontmatter(readFileSync(file, "utf8"), file).fields;
const toolsOf = (file: string) => splitTools(fieldsOf(file).tools ?? "");

describe("frontmatter", () => {
  it("parses fields and body", () => {
    const doc = parseFrontmatter("---\nname: a\ndescription: b\n---\n\nbody text\n");
    expect(doc.fields).toEqual({ name: "a", description: "b" });
    expect(doc.body).toBe("body text");
  });

  it("keeps colons inside a value", () => {
    expect(parseFrontmatter("---\ndescription: Use when: always\n---\n\nx\n").fields.description).toBe("Use when: always");
  });

  it("strips one layer of matching quotes", () => {
    expect(parseFrontmatter('---\nname: "a"\n---\n\nx\n').fields.name).toBe("a");
  });

  it("throws on a missing opening fence", () => {
    expect(() => parseFrontmatter("name: a\n", "f.md")).toThrow(/missing opening frontmatter fence/);
  });

  it("throws on an unterminated fence", () => {
    expect(() => parseFrontmatter("---\nname: a\n", "f.md")).toThrow(/unterminated frontmatter/);
  });

  it("throws on a line that is not key: value", () => {
    expect(() => parseFrontmatter("---\nnonsense\n---\n\nx\n", "f.md")).toThrow(/malformed frontmatter line/);
  });
});

describe("shipped skills", () => {
  it("finds them all", () => {
    // Guards against a broken glob quietly shipping nothing.
    expect(skills.length).toBeGreaterThanOrEqual(5);
  });

  it.each(skills)("$name is installable", (skill) => {
    expect(validateAsset(skill, tools)).toEqual([]);
  });
});

describe("shipped agent profiles", () => {
  it("finds them all", () => {
    expect(agents.length).toBeGreaterThanOrEqual(6);
  });

  it.each(agents)("$name is installable", (agent) => {
    expect(validateAsset(agent, tools)).toEqual([]);
  });

  it.each(agents)("$name names its tools explicitly", (agent) => {
    // Omitting `tools` inherits every tool available to subagents, so omission
    // is the maximal grant rather than a safe default.
    expect(fieldsOf(agent.file).tools).toBeTruthy();
  });

  it.each(agents)("$name uses only the stable frontmatter fields", (agent) => {
    // The docs list more (isolation, initialPrompt); not every installed CLI
    // has them, and an ignored key is a guardrail that silently does nothing.
    for (const key of Object.keys(fieldsOf(agent.file))) {
      expect(AGENT_FIELDS).toContain(key);
    }
  });

  it("references only MCP tools the server registers", () => {
    // The assertion that earns this file: a renamed MCP tool fails CI instead
    // of silently disarming a profile months later.
    const referenced = agents.flatMap((agent) => toolsOf(agent.file)).filter((tool) => tool.startsWith("mcp__"));
    expect(referenced.length).toBeGreaterThan(0);
    for (const tool of referenced) {
      expect(tools).toContain(tool.replace("mcp__workboard__", ""));
    }
  });
});

describe("role boundaries", () => {
  const write = ["Edit", "Write", "NotebookEdit"];

  it.each(["workboard-planner", "workboard-reviewer", "workboard-verifier"])("%s cannot edit files", (name) => {
    const agent = agents.find((candidate) => candidate.name === name);
    expect(agent, `${name} is missing`).toBeDefined();
    expect(toolsOf(agent!.file)).toEqual(expect.not.arrayContaining(write));
  });

  it("workboard-reporter stays off the filesystem", () => {
    const reporter = agents.find((agent) => agent.name === "workboard-reporter");
    expect(reporter).toBeDefined();
    const granted = toolsOf(reporter!.file);
    expect(granted).toEqual(expect.not.arrayContaining([...write, "Bash", "Read", "Grep", "Glob"]));
    // A report must never mutate the state it describes. The exceptions are the
    // report itself, triage's warnings, and refreshing a stale snapshot — which
    // re-reads an external system rather than changing the board's own state.
    const writes = ["save_report", "raise_warning", "resolve_warning", "refresh_project"];
    for (const tool of granted.filter((name) => name.startsWith("mcp__"))) {
      const bare = tool.replace("mcp__workboard__", "");
      if (bare.startsWith("list_") || bare.startsWith("get_") || writes.includes(bare)) continue;
      expect.unreachable(`workboard-reporter should not hold ${tool}`);
    }
  });

  it("workboard-implementer holds no board tools", () => {
    // Bookkeeping belongs to the dispatcher, which knows the pipeline's real outcome.
    const implementer = agents.find((agent) => agent.name === "workboard-implementer");
    expect(implementer).toBeDefined();
    expect(toolsOf(implementer!.file).filter((tool) => tool.startsWith("mcp__"))).toEqual([]);
  });
});

describe("skills and profiles agree", () => {
  it("every workboard name a skill mentions resolves to a skill or a profile", () => {
    // Skills and profiles live in separate files, so only the runtime notices a
    // rename. This catches it at CI time, in both directions.
    const known = [...skills, ...agents].map((asset) => asset.name);
    const mentioned = new Set<string>();
    for (const skill of skills) {
      const text = readFileSync(skill.file, "utf8");
      for (const match of text.matchAll(/`(workboard-[a-z0-9-]+)`/g)) mentioned.add(match[1]);
      for (const match of text.matchAll(/subagent_type:\s*([a-z0-9-]+)/g)) mentioned.add(match[1]);
    }
    expect(mentioned.size).toBeGreaterThan(0);
    for (const name of mentioned) {
      expect(known, `${name} is named by a skill but no such skill or profile exists`).toContain(name);
    }
  });
});
