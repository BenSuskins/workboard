import { cookies } from "next/headers";
import Link from "next/link";
import { listProjects, listTasks, TASK_LANES, type TaskLane, type TaskPriority, type TaskRow } from "@workboard/core";
import { FilterMemory } from "@/components/filter-memory";
import { IssueFilterBar } from "@/components/issue-filter-bar";
import { IssueRow } from "@/components/issue-row";
import { listCls } from "@/components/list";
import { NewIssueMenu } from "@/components/new-issue-menu";
import { PageTopBar } from "@/components/page-top-bar";
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

  const allProjects = listProjects(database, { includeArchived: true });
  const activeProjects = listProjects(database, {});
  const project = filters.project ? allProjects.find((candidate) => candidate.slug === filters.project) : undefined;
  const rows = listTasks(database, {
    projectId: project?.id,
    lane: laneOf(filters.lane),
    assignee: assigneeQuery(filters.assignee),
    label: filters.label,
    priority: priorityOf(filters.priority),
    query: filters.q,
  });

  const projectCount = new Set(rows.map((row) => row.project.id)).size;
  const count =
    rows.length === 0
      ? "0 issues"
      : `${rows.length} issue${rows.length === 1 ? "" : "s"} across ${projectCount} project${projectCount === 1 ? "" : "s"}`;

  const grouped = TASK_LANE_ORDER.map((lane) => ({ lane, rows: rows.filter((row) => row.lane === lane) })).filter(
    (group) => group.rows.length > 0,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <FilterMemory serialized={serializeIssueFilters(filters)} cookie={ISSUE_FILTERS_COOKIE} />
      <PageTopBar name="Issues" count={count} action={<NewIssueMenu projects={activeProjects} />} />

      <div className="flex-1 px-5 pb-9 pt-[22px]">
        <div className="flex flex-col gap-[18px]">
          <IssueFilterBar
            filters={filters}
            projects={allProjects.map((candidate) => ({ slug: candidate.slug, name: candidate.name }))}
          />

          {rows.length === 0 ? (
            <p className="text-body text-muted">
              No issues match these filters.{" "}
              <Link href={issuesHref({})} className="text-accent hover:underline">
                Clear the filters
              </Link>
            </p>
          ) : (
            <div className="flex flex-col gap-[18px]">
              {grouped.map((group) => (
                <LaneGroup key={group.lane} lane={group.lane} rows={group.rows} filters={filters} />
              ))}
            </div>
          )}
        </div>
      </div>
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
    <ul className={listCls}>
      {rows.map((row) => (
        <IssueRow key={row.task.id} row={row} showProject returnTo="/issues" />
      ))}
    </ul>
  );

  const heading = (
    <span className="flex items-center gap-2 px-0.5">
      <span className={`size-1.5 rounded-pill ${tone.dot}`} aria-hidden />
      <span className={`text-label font-semibold ${tone.text}`}>{TASK_LANE_LABEL[lane]}</span>
      <span className="text-meta tabular-nums text-muted">{rows.length}</span>
    </span>
  );

  if (folded) {
    return (
      <details className="flex flex-col gap-[9px]">
        <summary className="cursor-pointer select-none list-none">{heading}</summary>
        <div className="mt-2">{list}</div>
      </details>
    );
  }

  return (
    <section className="flex flex-col gap-[9px]">
      {heading}
      {list}
    </section>
  );
}
