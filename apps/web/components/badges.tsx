import type { ProjectStatus, TaskPriority } from "@workboard/core";
import { STATUS_LABEL, STATUS_TONE } from "./labels";

/** Colored dot + label, no chrome — used wherever a project's lifecycle status is shown. */
export function StatusBadge({ status }: { status: ProjectStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span className={`inline-flex flex-none items-center gap-1.5 text-meta font-medium ${tone.text}`}>
      <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Dot-only task priority marker; unprioritized tasks render nothing. */
export function TaskPriorityDot({ priority }: { priority: TaskPriority | null }) {
  if (!priority) return null;
  const cls = priority === "high" ? "bg-critical" : priority === "medium" ? "bg-serious" : "bg-muted";
  return <span className={`size-2 shrink-0 rounded-full ${cls}`} title={`${priority} priority`} aria-label={`${priority} priority`} />;
}

/** Labeled badge for the task detail page. */
export function TaskPriorityBadge({ priority }: { priority: TaskPriority | null }) {
  if (!priority) return <span className="text-meta text-muted">no priority</span>;
  const text = priority === "high" ? "text-critical" : priority === "medium" ? "text-serious" : "text-muted";
  const dot = priority === "high" ? "bg-critical" : priority === "medium" ? "bg-serious" : "bg-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 text-meta font-medium capitalize ${text}`}>
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
      {priority} priority
    </span>
  );
}
