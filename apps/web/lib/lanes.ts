import { TASK_LANES, type TaskLane } from "@workboard/core";

/**
 * A lane arriving from a URL, a form, or a drop target is untrusted text.
 * Returns null rather than guessing, so each caller decides what an
 * unrecognised lane means — a default for creating, a no-op for moving.
 */
export function laneParam(value: string | undefined | null): TaskLane | null {
  const raw = String(value ?? "").trim();
  return (TASK_LANES as readonly string[]).includes(raw) ? (raw as TaskLane) : null;
}
