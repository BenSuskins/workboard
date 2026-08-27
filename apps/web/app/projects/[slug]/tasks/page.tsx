import { notFound } from "next/navigation";
import { getProjectDetail, integrationStatus, taskLane, taskReplyCounts } from "@workboard/core";
import { Mermaid } from "@/components/mermaid";
import { ProjectHeader } from "@/components/project-header";
import { TaskBoard, type BoardCard } from "@/components/task-board";
import { TaskComposer } from "@/components/task-list";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectTasksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const database = db();
  const detail = getProjectDetail(database, slug, { postsLimit: 0 });
  if (!detail) notFound();
  const { project, tasks } = detail;
  const integrations = integrationStatus();
  const anyConfigured = integrations.github || integrations.jira || integrations.google;

  // The lane is decided here, by the same function the queue and the MCP tools
  // use, so the board's columns are a view of the domain rather than a guess.
  const replies = taskReplyCounts(database, project.id);
  const cards: BoardCard[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    lane: taskLane(task),
    priority: task.priority,
    claimedBy: task.claimedBy,
    dueDate: task.dueDate,
    replies: replies.get(task.id) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Mermaid />
      <ProjectHeader project={project} active="/tasks" configured={anyConfigured} />

      {/* A column's quick-add takes a title; this one has room for the description
          an agent works from, so it stays, folded away until someone is writing one. */}
      <details className="group rounded-card border border-hairline bg-surface open:bg-transparent open:border-transparent">
        <summary className="cursor-pointer select-none px-4 py-2.5 text-body text-ink-2 transition-colors hover:text-ink group-open:hidden">
          + New task
        </summary>
        <TaskComposer project={project} />
      </details>

      <TaskBoard cards={cards} projectId={project.id} slug={project.slug} />
    </div>
  );
}
