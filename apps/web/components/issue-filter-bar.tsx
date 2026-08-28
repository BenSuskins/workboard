import { OptionsDropdown, PillGroup, type FilterOption } from "./filter-controls";
import { TASK_LANE_LABEL, TASK_LANE_ORDER } from "./labels";
import { issuesHref, type IssueFilters } from "@/lib/issue-filters";

/**
 * What the issues view filters by: presets, project scope, search, and one
 * lane dropdown — no card, no dropdown-per-field. Every control but search is
 * a link, so the whole state stays in the URL and any view is one you can
 * send someone.
 *
 * Label and priority no longer have a control here: a label stays reachable by
 * clicking a chip on a row, and `priority=` still works from the URL.
 */
export function IssueFilterBar({
  filters,
  projects,
}: {
  filters: IssueFilters;
  projects: { slug: string; name: string }[];
}) {
  const clear = (key: keyof IssueFilters): string => issuesHref({ ...filters, [key]: undefined });

  const presets: FilterOption[] = [
    { key: "mine", href: issuesHref({ assignee: "me" }), label: "Mine", active: filters.assignee === "me" && !filters.lane },
    {
      key: "grabs",
      href: issuesHref({ lane: "queued" }),
      label: TASK_LANE_LABEL.queued,
      active: filters.lane === "queued" && !filters.assignee,
    },
    { key: "all", href: issuesHref({}), label: "Everything", active: !filters.assignee && !filters.lane },
  ];

  const scope: FilterOption[] = [
    { key: "any", href: clear("project"), label: "Any project", active: !filters.project },
    ...projects.map((project) => ({
      key: project.slug,
      href: issuesHref({ ...filters, project: project.slug }),
      label: project.name,
      active: filters.project === project.slug,
    })),
  ];

  const laneOptions: FilterOption[] = TASK_LANE_ORDER.map((lane) => ({
    key: lane,
    href: issuesHref({ ...filters, lane: filters.lane === lane ? undefined : lane }),
    label: TASK_LANE_LABEL[lane],
    active: filters.lane === lane,
  }));

  return (
    <div className="flex flex-wrap items-center gap-3.5">
      <PillGroup options={presets} />
      <span className="h-[18px] w-px flex-none bg-hairline" aria-hidden />
      <PillGroup options={scope} />

      <div className="ml-auto flex items-center gap-2">
        <form
          action="/issues"
          method="get"
          className="inline-flex items-center gap-[7px] rounded-control border border-hairline bg-surface px-2.5 py-[5px]"
        >
          {(["lane", "assignee", "label", "priority", "project"] as const).map((key) =>
            filters[key] ? <input key={key} type="hidden" name={key} value={filters[key]} /> : null,
          )}
          <SearchIcon />
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search issues…"
            aria-label="Search issues"
            className="min-w-[220px] border-none bg-transparent p-0 text-label text-ink outline-none placeholder:text-muted"
          />
        </form>

        <OptionsDropdown
          label="Lane"
          anyLabel="Lane"
          clearHref={clear("lane")}
          options={laneOptions}
          ghost
        />
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="flex-none text-muted"
      aria-hidden
    >
      <circle cx="7.25" cy="7.25" r="4.25" />
      <path d="m10.5 10.5 2.75 2.75" />
    </svg>
  );
}
