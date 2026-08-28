// Types only: this module is imported by client components, and pulling a
// runtime value from @workboard/core drags the node-only store into the bundle.
import type { Project, ProjectAccent, ProjectHealth, ProjectStatus, PostType, TaskLane } from "@workboard/core";

/**
 * The words the board shows people. The domain speaks in enums — `active`,
 * `agent_ready` — and the MCP tool surface keeps speaking them, so agents and
 * skills are unaffected. This module is the one place that translates those
 * enums into the vocabulary a human reads.
 */

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Moving",
  blocked: "Blocked",
  on_hold: "Parked",
  done: "Done",
  archived: "Shelved",
};

/**
 * Tone classes travel with the label so a status looks the same everywhere.
 * `border` draws the board card's status ring, whose hue must be the one the dot
 * uses — hence one record, as with TASK_LANE_TONE below.
 */
export const STATUS_TONE: Record<ProjectStatus, { text: string; dot: string; border: string }> = {
  active: { text: "text-good", dot: "bg-good", border: "border-good" },
  blocked: { text: "text-critical", dot: "bg-critical", border: "border-critical" },
  on_hold: { text: "text-warning", dot: "bg-warning", border: "border-warning" },
  done: { text: "text-accent", dot: "bg-accent", border: "border-accent" },
  archived: { text: "text-muted", dot: "bg-muted", border: "border-muted" },
};

export const HEALTH_LABEL: Record<ProjectHealth, string> = {
  green: "On track",
  amber: "At risk",
  red: "Off track",
};

export const POST_TYPE_LABEL: Record<PostType, string> = {
  note: "Note",
  status_change: "Status change",
  agent_update: "Agent update",
  question: "Question",
};

/** `agentReady` tasks are the queue agents pull from. */
export const UP_FOR_GRABS = "Up for grabs";
export const OPEN_QUESTIONS = "Open questions";

/**
 * The board's columns, in the order work flows through them. Written out here
 * rather than imported from core's TASK_LANES because this module is pulled into
 * client bundles and a runtime import from the domain drags the store in with it.
 * The Record type still fails the build if a lane is added without a column.
 */
export const TASK_LANE_LABEL: Record<TaskLane, string> = {
  backlog: "Backlog",
  queued: UP_FOR_GRABS,
  moving: "Moving",
  blocked: "Blocked",
  done: "Done",
};

/**
 * Tone classes travel with the lane so a column reads the same on the board, in
 * the task rail, and in the overview list. `border` draws the status ring, whose
 * hue must be the same one the dot uses — hence one record, not three.
 */
export const TASK_LANE_TONE: Record<TaskLane, { text: string; dot: string; border: string }> = {
  backlog: { text: "text-muted", dot: "bg-muted", border: "border-muted" },
  queued: { text: "text-accent", dot: "bg-accent", border: "border-accent" },
  moving: { text: "text-good", dot: "bg-good", border: "border-good" },
  blocked: { text: "text-critical", dot: "bg-critical", border: "border-critical" },
  done: { text: "text-ink-2", dot: "bg-ink-2", border: "border-ink-2" },
};

/** Column order, taken from the map above so the two can never disagree. */
export const TASK_LANE_ORDER = Object.keys(TASK_LANE_LABEL) as TaskLane[];

/** Tailwind cannot see a class built at runtime, so the hue classes are spelled out. */
export const ACCENT_TEXT: Record<ProjectAccent, string> = {
  orange: "text-tile-orange",
  purple: "text-tile-purple",
  green: "text-tile-green",
  blue: "text-tile-blue",
  pink: "text-tile-pink",
  amber: "text-tile-amber",
  teal: "text-tile-teal",
  red: "text-tile-red",
};

/** The hue as a dot — for places where the hue must not carry text. */
export const ACCENT_DOT: Record<ProjectAccent, string> = {
  orange: "bg-tile-orange",
  purple: "bg-tile-purple",
  green: "bg-tile-green",
  blue: "bg-tile-blue",
  pink: "bg-tile-pink",
  amber: "bg-tile-amber",
  teal: "bg-tile-teal",
  red: "bg-tile-red",
};

export const ACCENT_BG: Record<ProjectAccent, string> = {
  orange: "bg-tile-orange/15",
  purple: "bg-tile-purple/15",
  green: "bg-tile-green/15",
  blue: "bg-tile-blue/15",
  pink: "bg-tile-pink/15",
  amber: "bg-tile-amber/15",
  teal: "bg-tile-teal/15",
  red: "bg-tile-red/15",
};

/**
 * The hue names, taken from the map above rather than imported, so this file
 * stays free of runtime imports. The Record types keep it honest: adding a hue
 * to the domain without a class here fails to compile.
 */
export const ACCENTS = Object.keys(ACCENT_TEXT) as ProjectAccent[];

/**
 * A project's tile identity. Both fields are optional in the store, so an
 * unset project still reads apart from its neighbours: the hue comes from a
 * stable hash of the slug, and the glyph falls back to the name's initial.
 */
export function tileAccent(project: Pick<Project, "slug" | "accent">): ProjectAccent {
  if (project.accent) return project.accent;
  let hash = 0;
  for (const char of project.slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

/**
 * A label's hue. Labels are free text with nothing stored beside them, so the
 * colour comes from the text itself — the same label reads the same on every
 * card, and a new one needs no setup.
 */
export function labelAccent(label: string): ProjectAccent {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

export function tileGlyph(project: Pick<Project, "name" | "icon">): string {
  return project.icon?.trim() || project.name.trim().charAt(0).toUpperCase() || "?";
}

/** Option lists for the pickers, built from the label maps so they cannot disagree. */
export const LANE_OPTIONS = TASK_LANE_ORDER.map((lane) => ({
  value: lane as string,
  label: TASK_LANE_LABEL[lane],
  dot: TASK_LANE_TONE[lane].dot,
}));

export const TASK_PRIORITY_OPTIONS = [
  { value: "", label: "No priority" },
  { value: "high", label: "High", dot: "bg-critical" },
  { value: "medium", label: "Medium", dot: "bg-serious" },
  { value: "low", label: "Low", dot: "bg-muted" },
];

/** The project form's priority is required, so it offers no empty entry. */
export const PROJECT_PRIORITY_OPTIONS = TASK_PRIORITY_OPTIONS.slice(1);

export const PROJECT_STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as ProjectStatus[]).map((status) => ({
  value: status as string,
  label: STATUS_LABEL[status],
  dot: STATUS_TONE[status].dot,
}));

export const PROJECT_HEALTH_OPTIONS = (Object.keys(HEALTH_LABEL) as ProjectHealth[]).map((health) => ({
  value: health as string,
  label: HEALTH_LABEL[health],
  dot: health === "green" ? "bg-good" : health === "amber" ? "bg-warning" : "bg-critical",
}));

export const ACCENT_OPTIONS = [
  { value: "", label: "Derived from the name" },
  ...ACCENTS.map((accent) => ({
    value: accent as string,
    label: accent[0].toUpperCase() + accent.slice(1),
    dot: ACCENT_DOT[accent],
  })),
];
