import { cookies } from "next/headers";
import Link from "next/link";
import { listLabels, listProjects, listTasks, TASK_LANES, type TaskLane, type TaskPriority, type TaskRow } from "@workboard/core";
import { FilterMemory } from "@/components/filter-memory";
import { IssueFilterBar } from "@/components/issue-filter-bar";
import { IssueRow } from "@/components/issue-row";
import { TASK_LANE_LABEL, TASK_LANE_ORDER, TASK_LANE_TONE } from "@/components/labels";
import { db } from "@/lib/db";
import {
  assigneeQuery,
  issuesHref,
  ISSUE_FILTERS_COOKIE,
  resolveIssueFilters,
  serializeIssueFilters,
  type IssueParams,
} from "@/lib/issue-filters";

export const dynamic = "force-dynamic";

const laneOf = (value: string | undefined): TaskLane | undefined =>
  (TASK_LANES as readonly string[]).includes(value ?? "") ? (value as TaskLane) : undefined;

const priorityOf = (value: string | undefined): TaskPriority | undefined =>
  value === "high" || value === "medium" || value === "low" ? value : undefined;

/**
 * Every issue on the board, in one place. The project pages own the kanban; this
 * is the flat list you filter and search — the view you live in when the question
 * is "what is on my plate", not "how is this project doing".
 */
export default async function IssuesPage({ searchParams }: { searchParams: Promise<IssueParams> }) {
  const cookieStore = await cookies();
  const filters = resolveIssueFilters(await searchParams, cookieStore.get(ISSUE_FILTERS_COOKIE)?.value);
  const database = db();

  const projects = listProjects(database, { includeArchived: true });
  const project = filters.project ? projects.find((candidate) => candidate.slug === filters.project) : undefined;
  const rows = listTasks(database, {
    projectId: project?.id,
    lane: laneOf(filters.lane),
    assignee: assigneeQuery(filters.assignee),
    label: filters.label,
    priority: priorityOf(filters.priority),
    query: filters.q,
  });

  // Whoever is actually holding work, so the assignee filter offers real names
  // rather than a list of agents that have never touched this board.
  const agents = [
    ...new Set(
      listTasks(database)
        .map((row) => row.task.assignee)
        .filter((assignee): assignee is string => Boolean(assignee) && assignee !== "user"),
    ),
  ].sort();

  const grouped = TASK_LANE_ORDER.map((lane) => ({ lane, rows: rows.filter((row) => row.lane === lane) })).filter(
    (group) => group.rows.length > 0,
  );

  return (
    <div className="flex flex-col gap-5">
      <FilterMemory serialized={serializeIssueFilters(filters)} cookie={ISSUE_FILTERS_COOKIE} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-heading font-semibold tracking-tight text-ink">Issues</h1>
          <p className="text-meta text-muted">
            {rows.length === 0
              ? "Nothing matches these filters."
              : `${rows.length} issue${rows.length === 1 ? "" : "s"} across ${
                  new Set(rows.map((row) => row.project.id)).size
                } project${new Set(rows.map((row) => row.project.id)).size === 1 ? "" : "s"}`}
          </p>
        </div>
        <Presets filters={filters} />
      </div>

      <IssueFilterBar
        filters={filters}
        labels={listLabels(database, { projectId: project?.id })}
        projects={projects.map((candidate) => ({ slug: candidate.slug, name: candidate.name }))}
        agents={agents}
      />

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-grid px-6 py-16 text-center text-body text-muted">
          No issues here. <Link href={issuesHref({})} className="text-accent hover:underline">Clear the filters</Link> to
          see the whole board.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map((group) => (
            <LaneGroup key={group.lane} lane={group.lane} rows={group.rows} filters={filters} />
          ))}
        </div>
      )}
    </div>
  );
}

/** The three questions this page is opened to answer, one click each. */
function Presets({ filters }: { filters: IssueParams }) {
  const presets = [
    { key: "mine", label: "Mine", href: issuesHref({ assignee: "me" }), active: filters.assignee === "me" && !filters.lane },
    {
      key: "grabs",
      label: TASK_LANE_LABEL.queued,
      href: issuesHref({ lane: "queued" }),
      active: filters.lane === "queued" && !filters.assignee,
    },
    { key: "all", label: "Everything", href: issuesHref({}), active: !filters.assignee && !filters.lane },
  ];
  return (
    <div className="flex items-center gap-0.5 rounded-pill bg-surface-2 p-0.5">
      {presets.map((preset) => (
        <Link
          key={preset.key}
          href={preset.href}
          aria-current={preset.active ? "true" : undefined}
          className={`rounded-pill px-2.5 py-1 text-meta font-medium transition-colors ${
            preset.active ? "bg-surface text-ink" : "text-muted hover:text-ink-2"
          }`}
        >
          {preset.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * One column's worth of issues. Finished work is folded away unless you asked
 * for it by name — it is still on the page, just not in front of the work that
 * has not happened yet.
 */
function LaneGroup({ lane, rows, filters }: { lane: TaskLane; rows: TaskRow[]; filters: IssueParams }) {
  const tone = TASK_LANE_TONE[lane];
  const folded = lane === "done" && filters.lane !== "done";

  const list = (
    <ul className="overflow-hidden rounded-card border border-hairline bg-surface">
      {rows.map((row) => (
        <IssueRow key={row.task.id} row={row} showProject returnTo="/issues" />
      ))}
    </ul>
  );

  const heading = (
    <span className="flex items-center gap-2">
      <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden />
      <span className={`text-title font-semibold ${tone.text}`}>{TASK_LANE_LABEL[lane]}</span>
      <span className="text-meta tabular-nums text-muted">{rows.length}</span>
    </span>
  );

  if (folded) {
    return (
      <details className="flex flex-col gap-2">
        <summary className="cursor-pointer select-none list-none">{heading}</summary>
        <div className="mt-2">{list}</div>
      </details>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      {heading}
      {list}
    </section>
  );
}
