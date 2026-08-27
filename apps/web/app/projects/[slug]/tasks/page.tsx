import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectDetail, integrationStatus, taskIdentifier, taskLane, taskReplyCounts } from "@workboard/core";
import { Mermaid } from "@/components/mermaid";
import { ProjectHeader } from "@/components/project-header";
import { TaskBoard, type BoardCard } from "@/components/task-board";
import { primaryButtonCls } from "@/components/form";
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
    identifier: taskIdentifier(project, task),
    title: task.title,
    lane: taskLane(task),
    priority: task.priority,
    assignee: task.assignee,
    labels: task.labels,
    claimedBy: task.claimedBy,
    dueDate: task.dueDate,
    replies: replies.get(task.id) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Mermaid />
      <ProjectHeader project={project} active="/tasks" configured={anyConfigured} />

      <div className="flex justify-end">
        <Link href={`/projects/${project.slug}/tasks/new`} className={primaryButtonCls}>
          New task
        </Link>
      </div>

      <TaskBoard cards={cards} slug={project.slug} />
    </div>
  );
}
