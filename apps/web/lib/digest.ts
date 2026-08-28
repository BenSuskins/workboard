/**
 * The board's opening paragraph, in words. Everything here is derived from the
 * same counts the stat strip shows, so the sentence can never disagree with the
 * numbers under it — and it is plain text with no classes, so it stays testable.
 *
 * The strip counts tasks, so this does too, and names the unit every time. A
 * bare "four moving" beside a strip reading 12 would be read as a contradiction.
 */

import { STALE_MS } from "./format.js";

export type DigestState = "blocked" | "quiet" | "moving" | "waiting";

/** The state word is read off real activity, not decided in advance. */
export function digestState({
  blocked,
  movingProjects,
  week,
}: {
  blocked: number;
  movingProjects: number;
  /** Posts in the last seven days. */
  week: number;
}): DigestState {
  if (blocked > 0) return "blocked";
  if (week === 0) return "quiet";
  if (movingProjects > 0) return "moving";
  return "waiting";
}

export interface DigestCounts {
  projects: number;
  /** Tasks in progress. */
  moving: number;
  /** Projects holding at least one of them. */
  movingProjects: number;
  blocked: number;
  upForGrabs: number;
  questions: number;
  attention?: string | null;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** The verb has to agree with the count in front of it, every time. */
function verb(n: number): string {
  return n === 1 ? "is" : "are";
}

/** What is under way, and what is stuck. */
function movement({ moving, movingProjects, blocked }: DigestCounts): string {
  if (moving === 0) {
    return blocked === 0 ? "Nothing is moving." : `Nothing is moving, and ${count(blocked, "task")} are blocked.`;
  }
  const across = `${count(moving, "task")} moving across ${count(movingProjects, "project")}`;
  return blocked === 0 ? `${across}.` : `${across}, ${blocked} blocked.`;
}

/** What is waiting on somebody. An empty queue is said out loud — it is the good news. */
function queue({ upForGrabs, questions }: DigestCounts): string {
  const grabs =
    upForGrabs === 0 ? "Nothing is up for grabs" : `${count(upForGrabs, "task")} ${verb(upForGrabs)} up for grabs`;
  const asked =
    questions === 0 ? "no questions are open" : `${count(questions, "question")} ${verb(questions)} open`;
  return `${grabs} and ${asked}`;
}

export function digestLead(counts: DigestCounts): string {
  if (counts.projects === 0) {
    return "No projects yet. Connect a coding agent to the Workboard MCP server, or create one by hand.";
  }
  const tail = counts.attention ? ` — the only thing wanting attention is ${counts.attention}.` : ".";
  return `${movement(counts)} ${queue(counts)}${tail}`;
}

export interface AttentionCandidate {
  name: string;
  status: string;
  warnings: number;
  lastActivityAt: number;
}

/**
 * The one project to name. A block is louder than a warning, and a warning is
 * louder than silence; a project that is parked or finished is quiet on purpose
 * and never qualifies.
 */
export function projectWantingAttention(projects: AttentionCandidate[]): string | null {
  const blocked = projects.find((project) => project.status === "blocked");
  if (blocked) return blocked.name;

  const warned = projects.find((project) => project.warnings > 0 && project.status !== "done");
  if (warned) return warned.name;

  const stale = projects
    .filter((project) => project.status === "active" && Date.now() - project.lastActivityAt > STALE_MS)
    .sort((a, b) => a.lastActivityAt - b.lastActivityAt)[0];
  return stale?.name ?? null;
}
