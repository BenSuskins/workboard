import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { openStore, type Store } from "@workboard/core";
import { registerTools } from "./tools.js";

export function createServer(db: Store = openStore()): McpServer {
  const server = new McpServer(
    { name: "workboard", version: "0.1.0" },
    {
      instructions: [
        "Workboard is the user's dashboard of work projects (coding and otherwise).",
        "Work happens in platform monorepos: one repo hosts many projects, so never assume repo = project —",
        "use find_project with the PR number / branch / changed paths to resolve where your work belongs.",
        "Tasks queued for agents (agent_ready) are pulled via list_queued_tasks and claimed atomically with",
        "claim_task — usually driven by the workboard-queue skill rather than ad hoc.",
        "When you finish a work session: post what you did with add_update, link new PRs with add_link,",
        "and refresh the project's summary with upsert_summary.",
        "If something needs the user's attention and you cannot fix it yourself, raise_warning with a",
        "concrete suggested_action; resolve_warning when the condition clears.",
      ].join(" "),
    },
  );
  registerTools(server, db);
  return server;
}
