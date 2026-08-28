import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getActivityCounts,
  getProjectDetail,
  listDeleted,
  listSummaryHistory,
  taskIdentifier,
  taskLane,
  type TaskLane,
} from "@workboard/core";
import { ActivityFeed } from "@/components/activity-feed";
import { DetailLayout, MicroLabel, ReadingColumn } from "@/components/detail-layout";
import { ACCENT_BG, ACCENT_TEXT, HEALTH_LABEL, STATUS_LABEL, STATUS_TONE, tileAccent, tileGlyph } from "@/components/labels";
import { LinksPanel } from "@/components/links-panel";
import { Markdown } from "@/components/markdown";
import { Mermaid } from "@/components/mermaid";
import { ProgressBlock } from "@/components/progress-block";
import { RailRow, RailValue } from "@/components/property-rail";
import { Sparkline } from "@/components/sparkline";
import { OverviewTaskRows } from "@/components/task-list";
import { TimeAgo } from "@/components/time-ago";
import { WarningsPanel } from "@/components/warnings";
import { db } from "@/lib/db";
import { authorLabel, fullDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** A section in the reading column: a micro-label, optional meta, and a link out. */
function Section({
  label,
  meta,
  action,
  children,
}: {
  label: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2">
        <MicroLabel>{label}</MicroLabel>
        {meta && <span className="text-meta text-muted">{meta}</span>}
        {action && <span className="ml-auto text-meta">{action}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Everything about a project, reorganised rather than trimmed. The reading
 * column answers "what is this and how is it going"; the rail answers "what is
 * it made of". Nothing was cut in the move — the five-cell stat strip became
 * the rail's progress bar, which says the same thing in less furniture.
 */
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const database = db();
  const detail = getProjectDetail(database, slug, { postsLimit: 6 });
  if (!detail) notFound();
  const { project, tasks, posts, comments, links, latestSummary, openWarnings } = detail;
  const summaryHistory = listSummaryHistory(database, project.id, 11).slice(1);
  const deleted = listDeleted(database, project.id);
  const activity = getActivityCounts(database, project.id, 30);
  const accent = tileAccent(project);

  // The row component wants an issue, not a task: its identifier and column come
  // from the same helpers the board and the MCP tools use.
  const taskRows = tasks.map((task) => ({
    task,
    project,
    identifier: taskIdentifier(project, task),
    lane: taskLane(task),
  }));
  const laneCounts = taskRows.reduce(
    (counts, row) => ({ ...counts, [row.lane]: counts[row.lane] + 1 }),
    { backlog: 0, queued: 0, moving: 0, blocked: 0, done: 0 } as Record<TaskLane, number>,
  );
  const open = tasks.filter((task) => task.status !== "done").length;
  const deletedCount = deleted.tasks.length + deleted.links.length;

  const rail = (
    <>
      <div className="flex flex-col gap-0.5">
        <RailRow label="Status" wide>
          <RailValue dot={STATUS_TONE[project.status].dot}>{STATUS_LABEL[project.status]}</RailValue>
        </RailRow>
        <RailRow label="Health" wide>
          <RailValue>{HEALTH_LABEL[project.health]}</RailValue>
        </RailRow>
        <RailRow label="Priority" wide>
          <RailValue>{project.priority}</RailValue>
        </RailRow>
        <RailRow label="Category" wide>
          <RailValue>{project.category}</RailValue>
        </RailRow>
        <RailRow label="Issue key" wide>
          <span className="truncate font-mono text-meta tabular-nums text-muted">{project.key}</span>
        </RailRow>
        <RailRow label="Last active" wide>
          <span className="truncate" title={fullDate(project.lastActivityAt)}>
            <TimeAgo at={project.lastActivityAt} />
          </span>
        </RailRow>
      </div>

      <ProgressBlock counts={laneCounts} />

      <div className="flex flex-col gap-2">
        <MicroLabel>Pulse · 30 days</MicroLabel>
        <Sparkline counts={activity} width={256} height={40} fill className="w-full" />
      </div>

      <div className="flex flex-col gap-2">
        <MicroLabel className="px-2">Linked · {links.length}</MicroLabel>
        <LinksPanel links={links} project={project} />
      </div>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-hairline pt-3">
        <Link
          href={`/projects/${project.slug}/settings`}
          className="rounded-control px-2 py-1.5 text-label text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Project settings
        </Link>
        {deletedCount > 0 && (
          <Link
            href={`/projects/${project.slug}/settings`}
            className="rounded-control px-2 py-1.5 text-label text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Recently deleted ({deletedCount})
          </Link>
        )}
      </div>
    </>
  );

  return (
    <DetailLayout rail={rail} wide>
      <Mermaid />
      <ReadingColumn>
        <div className="flex flex-col gap-7">
          {/* The identity block the top bar no longer carries — read once, here,
              rather than repeated above every view of this project. */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <span
                className={`grid size-9 flex-none place-items-center rounded-[9px] text-heading font-semibold ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}
                aria-hidden
              >
                {tileGlyph(project)}
              </span>
              <h1 className="min-w-0 truncate text-page-title font-semibold tracking-[-0.02em] text-ink">{project.name}</h1>
            </div>
            {project.description && (
              <div className="text-prose text-ink-2">
                <Markdown>{project.description}</Markdown>
              </div>
            )}
          </div>

          <WarningsPanel warnings={openWarnings} slug={project.slug} />

          <Section
            label="Summary"
            meta={
              latestSummary && (
                <>
                  {authorLabel(latestSummary.generatedBy)} · <TimeAgo at={latestSummary.createdAt} />
                </>
              )
            }
            action={
              summaryHistory.length > 0 && (
                <details className="inline">
                  <summary className="cursor-pointer select-none list-none text-accent hover:underline">history</summary>
                </details>
              )
            }
          >
            <div className="rounded-card border border-hairline bg-surface p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
              {latestSummary ? (
                <Markdown>{latestSummary.body}</Markdown>
              ) : (
                <p className="text-prose text-muted">
                  No summary yet. A coding agent connected to the Workboard MCP can write one with{" "}
                  <code>upsert_summary</code>.
                </p>
              )}
            </div>
            {summaryHistory.length > 0 && (
              <details>
                <summary className="cursor-pointer select-none text-meta text-muted hover:text-ink">
                  {summaryHistory.length} earlier summar{summaryHistory.length === 1 ? "y" : "ies"}
                </summary>
                <ol className="mt-2.5 flex flex-col gap-3">
                  {summaryHistory.map((summary) => (
                    <li key={summary.id} className="border-l border-grid pl-3">
                      <div className="mb-1 text-meta text-muted">
                        {authorLabel(summary.generatedBy)} · {fullDate(summary.createdAt)}
                      </div>
                      <Markdown>{summary.body}</Markdown>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </Section>

          <Section
            label="Tasks"
            meta={`${open} open`}
            action={
              <Link href={`/projects/${project.slug}/tasks`} className="text-accent hover:underline">
                board
              </Link>
            }
          >
            <OverviewTaskRows rows={taskRows.slice(0, 6)} />
          </Section>

          <Section
            label="Activity"
            action={
              <Link href={`/projects/${project.slug}/activity`} className="text-accent hover:underline">
                all activity
              </Link>
            }
          >
            <ActivityFeed posts={posts} comments={comments} project={project} />
          </Section>
        </div>
      </ReadingColumn>
    </DetailLayout>
  );
}
