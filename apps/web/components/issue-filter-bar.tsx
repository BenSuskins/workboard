import Link from "next/link";
import { OptionsDropdown, Segmented, type FilterOption } from "./filter-controls";
import { TASK_LANE_LABEL, TASK_LANE_ORDER } from "./labels";
import { fieldCls } from "./form";
import { authorLabel } from "@/lib/format";
import { issuesHref, type IssueFilters } from "@/lib/issue-filters";

/**
 * What the issues view filters by, in the board's control language — the same
 * segmented group and dropdowns, from `filter-controls`, so a filter reads the
 * same on either page. Every control is a link, so the whole state stays in the
 * URL and any view you are looking at is one you can send someone. Search is the
 * exception: typing is not a link, so it is a GET form that lands in the URL.
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
  /** Clicking the active value clears it, which is how the board's chips behave. */
  const toggle = (key: keyof IssueFilters, value: string): string =>
    issuesHref({ ...filters, [key]: filters[key] === value ? undefined : value });
  const clear = (key: keyof IssueFilters): string => issuesHref({ ...filters, [key]: undefined });

  const options = (key: keyof IssueFilters, values: { key: string; label: string }[]): FilterOption[] =>
    values.map((value) => ({
      key: value.key,
      href: toggle(key, value.key),
      label: value.label,
      active: filters[key] === value.key,
    }));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-surface p-2">
      <Segmented
        capitalize={false}
        options={[
          { key: "all", href: clear("lane"), label: "All", active: !filters.lane },
          ...options(
            "lane",
            TASK_LANE_ORDER.map((lane) => ({ key: lane, label: TASK_LANE_LABEL[lane] })),
          ),
        ]}
      />

      {/* The dropdowns follow the lanes inline rather than being pushed right:
          there are four of them plus search, and a right-aligned group drops to
          its own line the moment the sidebar is dragged wider. */}
      <div className="flex flex-wrap items-center gap-2">
        <OptionsDropdown
          label="Assignee"
          anyLabel="anyone"
          clearHref={clear("assignee")}
          options={options("assignee", [
            { key: "me", label: "mine" },
            { key: "none", label: "unassigned" },
            ...agents.map((agent) => ({ key: agent, label: authorLabel(agent) })),
          ])}
        />

        {labels.length > 0 && (
          <OptionsDropdown
            label="Label"
            anyLabel="any"
            clearHref={clear("label")}
            options={options(
              "label",
              labels.map(({ label, count }) => ({ key: label, label: `${label} · ${count}` })),
            )}
          />
        )}

        <OptionsDropdown
          label="Priority"
          anyLabel="any"
          clearHref={clear("priority")}
          options={options("priority", [
            { key: "high", label: "high" },
            { key: "medium", label: "medium" },
            { key: "low", label: "low" },
          ])}
        />

        <OptionsDropdown
          label="Project"
          anyLabel="all"
          clearHref={clear("project")}
          options={options(
            "project",
            projects.map((project) => ({ key: project.slug, label: project.name })),
          )}
        />

        {/* The rest of the set rides along as hidden fields rather than being dropped. */}
        <form action="/issues" method="get" className="flex items-center">
          {(["lane", "assignee", "label", "priority", "project"] as const).map((key) =>
            filters[key] ? <input key={key} type="hidden" name={key} value={filters[key]} /> : null,
          )}
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search issues…"
            aria-label="Search issues"
            className={`${fieldCls} w-44 py-1 text-meta`}
          />
        </form>

        {Object.values(filters).some(Boolean) && (
          <Link href={issuesHref({})} className="text-meta text-muted hover:text-ink-2">
            clear
          </Link>
        )}
      </div>
    </div>
  );
}
