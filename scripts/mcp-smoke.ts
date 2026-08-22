/**
 * End-to-end smoke test of the MCP server over stdio: spawns the real server
 * against a throwaway database and walks the full agent flow.
 * Run: npm run mcp:smoke
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const dbPath = join(mkdtempSync(join(tmpdir(), "workboard-smoke-")), "smoke.db");

// Strip integration credentials so the no-credentials paths are exercised deterministically.
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k, v]) => v !== undefined && !/^(GITHUB_TOKEN|JIRA_|GOOGLE_)/.test(k),
  ),
) as Record<string, string>;

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", resolve(import.meta.dirname, "../packages/mcp/src/stdio.ts")],
  env: { ...cleanEnv, WORKBOARD_DB_PATH: dbPath },
});
const client = new Client({ name: "smoke", version: "0.0.1" });
await client.connect(transport);

let failures = 0;
async function step(name: string, fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    console.log(`✅ ${name}`);
    return result;
  } catch (err) {
    failures++;
    console.error(`❌ ${name}:`, err instanceof Error ? err.message : err);
    return undefined;
  }
}

function parse(result: unknown): any {
  const content = (result as { content: { type: string; text: string }[] }).content;
  return JSON.parse(content[0].text);
}

async function call(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  if ((result as { isError?: boolean }).isError) {
    throw new Error(`${name} errored: ${JSON.stringify((result as any).content)}`);
  }
  return parse(result);
}

const expected = [
  "list_projects", "get_project", "find_project", "create_project", "update_project",
  "add_update", "add_task", "update_task", "add_link", "upsert_summary",
  "raise_warning", "resolve_warning",
  "get_activity", "save_report", "list_reports", "refresh_project",
  "list_queued_tasks", "claim_task",
];

await step("tools/list exposes all tools", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  const missing = expected.filter((t) => !names.includes(t));
  if (missing.length) throw new Error(`missing tools: ${missing.join(", ")}`);
});

await step("create_project with initial links", async () => {
  const res = await call("create_project", {
    name: "Smoke Project",
    description: "Created by the smoke test",
    category: "coding",
    links: [{ url: "https://github.com/acme/platform/pull/999", title: "Test PR" }],
  });
  if (res.created.slug !== "smoke-project") throw new Error(JSON.stringify(res));
});

await step("find_project resolves by PR number", async () => {
  const res = await call("find_project", { repo: "acme/platform", pr_number: 999 });
  if (res.matches[0]?.slug !== "smoke-project" || res.matches[0]?.confidence !== "exact") throw new Error(JSON.stringify(res));
});

await step("add_link with monorepo scope", async () => {
  const res = await call("add_link", {
    project: "smoke-project",
    url: "https://github.com/acme/platform",
    scope: { path_prefixes: ["services/smoke/"], branch_prefix: "smoke/" },
  });
  if (res.linked.kind !== "repo") throw new Error(JSON.stringify(res));
});

await step("find_project resolves by branch prefix", async () => {
  const res = await call("find_project", { repo: "acme/platform", branch: "smoke/new-feature" });
  if (res.matches[0]?.confidence !== "scoped") throw new Error(JSON.stringify(res));
});

await step("add_update + add_task + update_task", async () => {
  await call("add_update", { project: "smoke-project", body: "Shipped the thing.", agent_name: "smoke-agent" });
  const task = await call("add_task", { project: "smoke-project", title: "Follow-up", agent_name: "smoke-agent" });
  const updated = await call("update_task", { task_id: task.created.id, status: "done" });
  if (updated.updated.status !== "done") throw new Error(JSON.stringify(updated));
});

await step("agent task queue: queue, list, claim, double-claim rejection", async () => {
  const queued = await call("add_task", { project: "smoke-project", title: "Queued work", agent_ready: true });
  if (queued.created.agent_ready !== true) throw new Error(JSON.stringify(queued));

  const listed = await call("list_queued_tasks", { project: "smoke-project" });
  if (!listed.queued.some((t: any) => t.id === queued.created.id)) throw new Error(JSON.stringify(listed));

  const claimed = await call("claim_task", { task_id: queued.created.id, agent_name: "smoke-agent" });
  if (claimed.claimed.status !== "in_progress") throw new Error(JSON.stringify(claimed));

  // claimed tasks leave the queue
  const after = await call("list_queued_tasks", {});
  if (after.queued.some((t: any) => t.id === queued.created.id)) throw new Error(JSON.stringify(after));

  const double = await client.callTool({ name: "claim_task", arguments: { task_id: queued.created.id, agent_name: "other-agent" } });
  if (!(double as { isError?: boolean }).isError) throw new Error("double claim should error");

  await call("update_task", { task_id: queued.created.id, status: "done" });
});

await step("upsert_summary + update_project status", async () => {
  await call("upsert_summary", { project: "smoke-project", body: "All smoke, no fire.", agent_name: "smoke-agent" });
  const res = await call("update_project", { project: "smoke-project", status: "blocked", agent_name: "smoke-agent" });
  if (res.updated.status !== "blocked") throw new Error(JSON.stringify(res));
});

await step("get_project reflects everything", async () => {
  const res = await call("get_project", { project: "smoke-project" });
  if (res.latestSummary?.body !== "All smoke, no fire.") throw new Error("missing summary");
  if (!res.updates.some((u: any) => u.type === "status_change")) throw new Error("missing status_change update");
  if (res.links.length !== 2) throw new Error(`expected 2 links, got ${res.links.length}`);
});

await step("raise_warning appears in get_project, resolve clears it", async () => {
  const raised = await call("raise_warning", {
    project: "smoke-project",
    message: "CI deploy is red and I can't fix the credentials",
    severity: "critical",
    suggested_action: "Rotate the deploy token",
    agent_name: "smoke-agent",
  });
  if (raised.raised.severity !== "critical") throw new Error(JSON.stringify(raised));
  let proj = await call("get_project", { project: "smoke-project" });
  if (proj.openWarnings?.length !== 1) throw new Error("warning missing from get_project");
  const feed = await call("get_activity", {});
  if (feed.projects[0].openWarnings?.length !== 1) throw new Error("warning missing from get_activity");
  await call("resolve_warning", { warning_id: raised.raised.id, note: "token rotated", agent_name: "smoke-agent" });
  proj = await call("get_project", { project: "smoke-project" });
  if (proj.openWarnings?.length !== 0) throw new Error("warning not cleared after resolve");
  if (!proj.updates.some((u: any) => u.body.includes("Resolved warning"))) throw new Error("resolution not logged");
});

await step("get_activity + save_report + list_reports", async () => {
  const feed = await call("get_activity", {});
  if (feed.projects.length !== 1) throw new Error("expected 1 project in feed");
  await call("save_report", { kind: "digest", body: "# Digest\nEverything is smoke.", agent_name: "smoke-agent" });
  await call("save_report", { kind: "accomplishments", body: "# Accomplishments\nShipped smoke.", agent_name: "smoke-agent" });
  const reports = await call("list_reports", {});
  if (reports.length !== 2) throw new Error(JSON.stringify(reports));
  const acc = await call("list_reports", { kind: "accomplishments" });
  if (acc[0]?.kind !== "accomplishments") throw new Error(JSON.stringify(acc));
});

await step("refresh_project skips gracefully without credentials", async () => {
  const res = await call("refresh_project", { project: "smoke-project" });
  const bad = res.results.filter((r: any) => !r.ok);
  if (bad.length) throw new Error(JSON.stringify(bad));
});

await client.close();
console.log(failures === 0 ? "\nAll MCP smoke steps passed." : `\n${failures} step(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
