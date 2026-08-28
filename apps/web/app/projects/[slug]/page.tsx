import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getActivityCounts,
  getProjectDetail,
  integrationStatus,
  listDeleted,
  listSummaryHistory,
  taskIdentifier,
  taskLane,
} from "@workboard/core";
import { ActivityFeed } from "@/components/activity-feed";
import { LinksPanel } from "@/components/links-panel";
import { Markdown } from "@/components/markdown";
import { Mermaid } from "@/components/mermaid";
import { ProjectSettings, RecentlyDeleted } from "@/components/project-settings";
import { SectionHeading } from "@/components/section";
import { Sparkline } from "@/components/sparkline";
import { StatCells } from "@/components/stat-strip";
import { TaskList } from "@/components/task-list";
import { TimeAgo } from "@/components/time-ago";
import { WarningsPanel } from "@/components/warnings";
import { db } from "@/lib/db";
import { authorLabel, fullDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const database = db();
  const detail = getProjectDetail(database, slug, { postsLimit: 6 });
  if (!detail) notFound();
  const { project, tasks, posts, comments, links, latestSummary, openWarnings } = detail;
  const integrations = integrationStatus();
  const anyConfigured = integrations.github || integrations.jira || integrations.google;
  const summaryHistory = listSummaryHistory(database, project.id, 11).slice(1);
  const deleted = listDeleted(database, project.id);
  const activity = getActivityCounts(database, project.id, 30);

  const upForGrabs = tasks.filter((t) => t.agentReady && t.status === "todo" && !t.claimedAt).length;
  // The row component wants an issue, not a task: its identifier and column come
  // from the same helpers the board and the MCP tools use.
  const taskRows = tasks.map((task) => ({
    task,
    project,
    identifier: taskIdentifier(project, task),
    lane: taskLane(task),
  }));
  const openQuestions = posts.filter((p) => p.type === "question" && !p.answeredAt).length;

  return (
    <div className="flex flex-col gap-6">
      <Mermaid />

      <StatCells
        items={[
          { label: "Moving", value: tasks.filter((t) => t.status === "in_progress").length },
          { label: "Up for grabs", value: upForGrabs },
          { label: "Done", value: tasks.filter((t) => t.status === "done").length },
          { label: "Questions", value: openQuestions, tone: openQuestions > 0 ? "text-serious" : undefined },
          { label: "Links", value: links.length },
        ]}
      />

      <WarningsPanel warnings={openWarnings} slug={project.slug} />

      {project.description && (
        <section className="rounded-card border border-hairline bg-surface p-5">
          <Markdown>{project.description}</Markdown>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <SectionHeading
              title="AI summary"
              action={
                latestSummary && (
                  <span className="text-meta text-muted">
                    {authorLabel(latestSummary.generatedBy)} · <TimeAgo at={latestSummary.createdAt} />
                  </span>
                )
              }
            />
            <div className="rounded-card border border-hairline bg-surface p-5">
              {latestSummary ? (
                <Markdown>{latestSummary.body}</Markdown>
              ) : (
                <p className="text-body text-muted">
                  No summary yet. A coding agent connected to the Workboard MCP can write one with <code>upsert_summary</code>.
                </p>
              )}
              {summaryHistory.length > 0 && (
                <details className="mt-4 border-t border-hairline pt-3">
                  <summary className="cursor-pointer select-none text-meta text-muted hover:text-ink">
                    History ({summaryHistory.length} previous)
                  </summary>
                  <ol className="mt-2 flex flex-col gap-3">
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
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeading
              title="Recent activity"
              action={
                <Link href={`/projects/${project.slug}/activity`} className="text-meta text-accent hover:underline">
                  all activity
                </Link>
              }
            />
            <ActivityFeed posts={posts} comments={comments} project={project} />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <SectionHeading title="Pulse" />
            <div className="rounded-card border border-hairline bg-surface p-4">
              <Sparkline counts={activity} width={280} height={44} fill />
              <p className="mt-2 text-meta text-muted">posts · 30 days</p>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeading
              title="Tasks"
              count={tasks.filter((t) => t.status !== "done").length}
              action={
                <Link href={`/projects/${project.slug}/tasks`} className="text-meta text-accent hover:underline">
                  manage
                </Link>
              }
            />
            <TaskList rows={taskRows.slice(0, 6)} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeading title="Linked resources" count={links.length} />
            <div className="rounded-card border border-hairline bg-surface p-4">
              <LinksPanel links={links} project={project} />
            </div>
          </section>
        </div>
      </div>

      {/* Full width: these forms need room, and a 300px rail clips every select. */}
      <div className="flex flex-col gap-3">
        <ProjectSettings project={project} />
        <RecentlyDeleted project={project} tasks={deleted.tasks} links={deleted.links} />
      </div>
    </div>
  );
}
