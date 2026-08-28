import { notFound } from "next/navigation";
import { getProjectDetail, taskIdentifier, taskLane, taskReplyCounts } from "@workboard/core";
import { Mermaid } from "@/components/mermaid";
import { TaskBoard, type BoardCard } from "@/components/task-board";
import { db } from "@/lib/db";
import { toPlainText } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectTasksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const database = db();
  const detail = getProjectDetail(database, slug, { postsLimit: 0 });
  if (!detail) notFound();
  const { project, tasks } = detail;

  // The lane is decided here, by the same function the queue and the MCP tools
  // use, so the board's columns are a view of the domain rather than a guess.
  const replies = taskReplyCounts(database, project.id);
  const cards: BoardCard[] = tasks.map((task) => ({
    id: task.id,
    identifier: taskIdentifier(project, task),
    title: task.title,
    // Two lines of blurb is all the card shows, so the markdown is flattened
    // here rather than shipped whole to a client that would only clamp it.
    blurb: toPlainText(task.description).slice(0, 220),
    lane: taskLane(task),
    priority: task.priority,
    assignee: task.assignee,
    labels: task.labels,
    claimedBy: task.claimedBy,
    dueDate: task.dueDate,
    replies: replies.get(task.id) ?? 0,
  }));

  return (
    <>
      <Mermaid />
      <TaskBoard cards={cards} slug={project.slug} />
    </>
  );
}
