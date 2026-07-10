import type { ProjectHealth, ProjectPriority, ProjectStatus } from "@workboard/core";

const STATUS_STYLES: Record<ProjectStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "text-good border-good/40 bg-good/10" },
  blocked: { label: "Blocked", cls: "text-critical border-critical/40 bg-critical/10" },
  on_hold: { label: "On hold", cls: "text-warning border-warning/40 bg-warning/10" },
  done: { label: "Done", cls: "text-accent border-accent/40 bg-accent/10" },
  archived: { label: "Archived", cls: "text-muted border-hairline bg-surface-2" },
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

const HEALTH_STYLES: Record<ProjectHealth, { label: string; dot: string }> = {
  green: { label: "On track", dot: "bg-good" },
  amber: { label: "At risk", dot: "bg-warning" },
  red: { label: "Off track", dot: "bg-critical" },
};

export function HealthBadge({ health }: { health: ProjectHealth }) {
  const h = HEALTH_STYLES[health];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-2">
      <span className={`size-2 rounded-full ${h.dot}`} aria-hidden />
      {h.label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2 capitalize">
      {category}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: ProjectPriority }) {
  if (priority === "medium") return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        priority === "high" ? "bg-serious/10 text-serious border border-serious/40" : "text-muted border border-hairline"
      }`}
    >
      {priority === "high" ? "High priority" : "Low priority"}
    </span>
  );
}
