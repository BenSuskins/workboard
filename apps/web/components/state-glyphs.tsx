import type { PostType, ProjectStatus, TaskLane, TaskPriority } from "@workboard/core";
import type { PrBucket } from "../lib/pipeline";
import {
  ACCENT_TEXT,
  labelAccent,
  PR_BUCKET_LABEL,
  PR_BUCKET_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  TASK_LANE_LABEL,
  TASK_LANE_TONE,
} from "./labels";

/**
 * One icon language for state, shared by the board, the task rail, and the
 * activity feed. Hue identifies and the neutral ramp reads: none of these
 * glyphs carries a word's worth of meaning on colour alone — the label,
 * the title attribute, or the adjacent text always says it too.
 */

/**
 * Status is a ring, filled by how far the work has gone: hollow while a task is
 * only filed or queued, a dot once something is actually happening, a solid
 * centre when it is finished.
 */
export function StatusRing({ lane }: { lane: TaskLane }) {
  const tone = TASK_LANE_TONE[lane];
  const inner =
    lane === "moving"
      ? "size-[5px] bg-good"
      : lane === "blocked"
        ? "size-[5px] bg-critical"
        : lane === "done"
          ? "size-[7px] bg-ink-2"
          : "";
  return (
    <span
      title={TASK_LANE_LABEL[lane]}
      className={`grid size-[13px] flex-none place-items-center rounded-pill border-[1.5px] ${tone.border}`}
    >
      {inner && <span className={`rounded-pill ${inner}`} aria-hidden />}
      <span className="sr-only">{TASK_LANE_LABEL[lane]}</span>
    </span>
  );
}

/**
 * The same ring for a pull request. A PR has its own five buckets rather than
 * task lanes, but it is read on the same page furniture, so it keeps the ring
 * rather than inventing a second glyph for "state".
 */
export function PrRing({ bucket }: { bucket: PrBucket }) {
  const tone = PR_BUCKET_TONE[bucket];
  return (
    <span
      title={PR_BUCKET_LABEL[bucket]}
      className={`mt-0.5 grid size-[13px] flex-none place-items-center rounded-pill border-[1.5px] ${tone.border}`}
    >
      {tone.ring && <span className={`rounded-pill ${tone.ring}`} aria-hidden />}
      <span className="sr-only">{PR_BUCKET_LABEL[bucket]}</span>
    </span>
  );
}

/**
 * The same ring at project scale, on the board card. A project is filled once it
 * is actually going somewhere — moving or stuck — and hollow while it is parked
 * or shelved, so a quiet project reads as quiet without a second colour.
 */
export function ProjectStatusRing({ status }: { status: ProjectStatus }) {
  const tone = STATUS_TONE[status];
  const inner =
    status === "active" || status === "blocked" ? `size-[5px] ${tone.dot}` : status === "done" ? "size-[6px] bg-accent" : "";
  return (
    <span
      title={STATUS_LABEL[status]}
      className={`grid size-[11px] flex-none place-items-center rounded-pill border-[1.5px] ${tone.border}`}
    >
      {inner && <span className={`rounded-pill ${inner}`} aria-hidden />}
      <span className="sr-only">{STATUS_LABEL[status]}</span>
    </span>
  );
}

const PRIORITY_LIT: Record<TaskPriority, { bars: number; cls: string }> = {
  high: { bars: 3, cls: "bg-critical" },
  medium: { bars: 2, cls: "bg-serious" },
  low: { bars: 1, cls: "bg-muted" },
};

const BAR_HEIGHTS = ["h-[4px]", "h-[7.5px]", "h-[11px]"];

/** Priority is three ascending bars — a level you read at a glance, not a word. */
export function PriorityBars({ priority }: { priority: TaskPriority | null }) {
  if (!priority) return null;
  const { bars, cls } = PRIORITY_LIT[priority];
  return (
    <span title={`${priority} priority`} className="flex h-[11px] flex-none items-end gap-[2px]">
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={height}
          className={`w-[2.5px] rounded-[1px] ${height} ${index < bars ? cls : "bg-grid"}`}
          aria-hidden
        />
      ))}
      <span className="sr-only">{priority} priority</span>
    </span>
  );
}

/**
 * A label is an outlined square in the label's own hue, then the word in the
 * neutral ramp. Filling the square would put eight competing colours on one
 * card; outlining it keeps the hue as an index and the word as the content.
 */
export function LabelChip({ label }: { label: string }) {
  return (
    <span className="inline-flex flex-none items-center gap-1.5 text-caption text-muted">
      <span
        className={`size-[11px] flex-none rounded-[3px] border-[1.25px] ${ACCENT_TEXT[labelAccent(label)]}`}
        style={{ borderColor: "currentColor" }}
        aria-hidden
      />
      {label}
    </span>
  );
}

/** A task an agent has claimed. */
export function AgentMark() {
  return (
    <span
      title="Claimed by an agent"
      className="grid size-[14px] flex-none place-items-center rounded-[4px] bg-accent/15 text-[9px] font-bold text-accent"
    >
      A<span className="sr-only">Claimed by an agent</span>
    </span>
  );
}

export const POST_TYPE_TONE: Record<PostType, string> = {
  agent_update: "text-accent",
  question: "text-serious",
  status_change: "text-warning",
  note: "text-muted",
};

/** The label square again, at feed scale, for a post's kind. */
export function TypeMark({ type }: { type: PostType }) {
  return (
    <span
      className={`size-[9px] flex-none rounded-[3px] border-[1.25px] ${POST_TYPE_TONE[type]}`}
      style={{ borderColor: "currentColor" }}
      aria-hidden
    />
  );
}
