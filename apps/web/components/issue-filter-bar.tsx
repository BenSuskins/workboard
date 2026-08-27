import Link from "next/link";
import { TASK_LANE_LABEL, TASK_LANE_ORDER } from "./labels";
import { fieldCls } from "./form";
import { issuesHref, type IssueFilters } from "@/lib/issue-filters";

/** The same segmented pill group the board's filter bar uses, so one control language runs through both. */
function Segmented({ options }: { options: { key: string; href: string; label: string; active: boolean }[] }) {
  return (
    <div className="flex items-center gap-0.5 rounded-pill bg-surface-2 p-0.5">
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          aria-current={option.active ? "true" : undefined}
          className={`rounded-pill px-2.5 py-1 text-meta font-medium transition-colors ${
            option.active ? "bg-surface text-ink" : "text-muted hover:text-ink-2"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

/** A dropdown that reads as its active choice — the board's pattern for the filters that would not fit as pills. */
function Dropdown({
  label,
  options,
}: {
  label: string;
  options: { key: string; href: string; label: string; active: boolean }[];
}) {
  const active = options.find((option) => option.active);
  return (
    <details className="group relative">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1.5 rounded-pill border px-2.5 py-1 text-meta transition-colors ${
          active ? "border-accent/40 text-ink" : "border-hairline text-muted hover:text-ink-2"
        }`}
      >
        {active ? active.label : label}
        <span aria-hidden className="text-[9px]">▾</span>
      </summary>
      <ul className="absolute left-0 top-full z-40 mt-1 min-w-40 rounded-card border border-hairline bg-surface p-1 shadow-lg">
        {options.map((option) => (
          <li key={option.key}>
            <Link
              href={option.href}
              className={`block truncate rounded-control px-2 py-1 text-meta ${
                option.active ? "bg-accent/15 text-ink" : "text-ink-2 hover:bg-surface-2"
              }`}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * What the issues view filters by. Every control is a link, so the whole state
 * stays in the URL and any view you are looking at is one you can send someone.
 * Search is the exception — it is a form, because typing is not a link.
 */
export function IssueFilterBar({
  filters,
  labels,
  projects,
  agents,
}: {
  filters: IssueFilters;
  labels: { label: string; count: number }[];
  projects: { slug: string; name: string }[];
  agents: string[];
}) {
  const toggle = (key: keyof IssueFilters, value: string) =>
    issuesHref({ ...filters, [key]: filters[key] === value ? undefined : value });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-surface p-2">
      <Segmented
        options={[
          { key: "all", href: issuesHref({ ...filters, lane: undefined }), label: "All", active: !filters.lane },
          ...TASK_LANE_ORDER.map((lane) => ({
            key: lane,
            href: toggle("lane", lane),
            label: TASK_LANE_LABEL[lane],
            active: filters.lane === lane,
          })),
        ]}
      />

      <Dropdown
        label="Anyone"
        options={[
          { key: "any", href: issuesHref({ ...filters, assignee: undefined }), label: "Anyone", active: !filters.assignee },
          { key: "me", href: toggle("assignee", "me"), label: "Mine", active: filters.assignee === "me" },
          { key: "none", href: toggle("assignee", "none"), label: "Unassigned", active: filters.assignee === "none" },
          ...agents.map((agent) => ({
            key: agent,
            href: toggle("assignee", agent),
            label: agent.replace(/^agent:/, "🤖 "),
            active: filters.assignee === agent,
          })),
        ]}
      />

      {labels.length > 0 && (
        <Dropdown
          label="Label"
          options={[
            { key: "any", href: issuesHref({ ...filters, label: undefined }), label: "Any label", active: !filters.label },
            ...labels.map(({ label, count }) => ({
              key: label,
              href: toggle("label", label),
              label: `${label} · ${count}`,
              active: filters.label === label,
            })),
          ]}
        />
      )}

      <Dropdown
        label="Priority"
        options={[
          { key: "any", href: issuesHref({ ...filters, priority: undefined }), label: "Any priority", active: !filters.priority },
          ...(["high", "medium", "low"] as const).map((priority) => ({
            key: priority,
            href: toggle("priority", priority),
            label: priority,
            active: filters.priority === priority,
          })),
        ]}
      />

      <Dropdown
        label="Project"
        options={[
          { key: "any", href: issuesHref({ ...filters, project: undefined }), label: "All projects", active: !filters.project },
          ...projects.map((project) => ({
            key: project.slug,
            href: toggle("project", project.slug),
            label: project.name,
            active: filters.project === project.slug,
          })),
        ]}
      />

      {/* GET, so a search lands in the URL like every other filter. The rest of
          the set rides along as hidden fields rather than being dropped. */}
      <form action="/issues" method="get" className="ml-auto flex items-center gap-1">
        {(["lane", "assignee", "label", "priority", "project"] as const).map((key) =>
          filters[key] ? <input key={key} type="hidden" name={key} value={filters[key]} /> : null,
        )}
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search issues…"
          aria-label="Search issues"
          className={`${fieldCls} w-48 py-1 text-meta`}
        />
      </form>

      {Object.values(filters).some(Boolean) && (
        <Link href={issuesHref({})} className="text-meta text-muted hover:text-ink-2">
          clear
        </Link>
      )}
    </div>
  );
}
