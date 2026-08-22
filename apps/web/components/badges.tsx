import type { ProjectHealth, ProjectPriority, ProjectStatus, TaskPriority } from "@workboard/core";

const STATUS_STYLES: Record<ProjectStatus, { label: string; text: string; dot: string }> = {
  active: { label: "Active", text: "text-good", dot: "bg-good" },
  blocked: { label: "Blocked", text: "text-critical", dot: "bg-critical" },
  on_hold: { label: "On hold", text: "text-warning", dot: "bg-warning" },
  done: { label: "Done", text: "text-accent", dot: "bg-accent" },
  archived: { label: "Archived", text: "text-muted", dot: "bg-muted" },
};

/** Dot-only status marker for dense contexts; label surfaces via tooltip. */
export function StatusDot({ status }: { status: ProjectStatus }) {
  const s = STATUS_STYLES[status];
  return <span className={`size-2 shrink-0 rounded-full ${s.dot}`} title={s.label} aria-label={s.label} />;
}

/** Colored dot + label, no chrome — used wherever a project's lifecycle status is shown. */
export function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex flex-none items-center gap-1.5 text-[11px] font-medium ${s.text}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

const HEALTH_LABEL: Record<ProjectHealth, string> = {
  green: "On track",
  amber: "At risk",
  red: "Off track",
};

/** Dot-only task priority marker; unprioritized tasks render nothing. */
export function TaskPriorityDot({ priority }: { priority: TaskPriority | null }) {
  if (!priority) return null;
  const cls = priority === "high" ? "bg-critical" : priority === "medium" ? "bg-serious" : "bg-muted";
  return <span className={`size-2 shrink-0 rounded-full ${cls}`} title={`${priority} priority`} aria-label={`${priority} priority`} />;
}

/** Labeled badge for the task detail page. */
export function TaskPriorityBadge({ priority }: { priority: TaskPriority | null }) {
  if (!priority) return <span className="text-[11px] text-muted">no priority</span>;
  const text = priority === "high" ? "text-critical" : priority === "medium" ? "text-serious" : "text-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium capitalize ${text}`}>
      <span className={`size-1.5 rounded-full ${priority === "high" ? "bg-critical" : priority === "medium" ? "bg-serious" : "bg-muted"}`} aria-hidden />
      {priority} priority
    </span>
  );
}

/** Plain-text "category · health · priority" meta line shared by the board card and project page. */
export function ProjectMeta({
  category,
  health,
  priority,
  className = "",
}: {
  category: string;
  health: ProjectHealth;
  priority: ProjectPriority;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted ${className}`}>
      <span className="capitalize">{category}</span>
      <span>·</span>
      <span>{HEALTH_LABEL[health]}</span>
      {priority !== "medium" && (
        <>
          <span>·</span>
          <span className={priority === "high" ? "font-semibold text-serious" : "text-muted"}>
            {priority === "high" ? "High priority" : "Low priority"}
          </span>
        </>
      )}
    </div>
  );
}
