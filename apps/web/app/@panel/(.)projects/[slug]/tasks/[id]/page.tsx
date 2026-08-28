import { notFound } from "next/navigation";
import { getTaskDetail } from "@workboard/core";
import { DetailLayout, ReadingColumn } from "@/components/detail-layout";
import { Mermaid } from "@/components/mermaid";
import { Panel } from "@/components/panel";
import { TaskRail, TaskView } from "@/components/task-view";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TaskPanel({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const detail = getTaskDetail(db(), Number(id));
  if (!detail || detail.project.slug !== slug) notFound();
  const { task, project, comments } = detail;

  return (
    <Panel
      title={task.title}
      href={`/projects/${project.slug}/tasks/${task.id}`}
      breadcrumb={<span className="truncate text-meta text-ink-2">{project.name}</span>}
    >
      <Mermaid />
      {/* The same column and rail the full page draws. At the panel's default
          width the rail stacks under the column instead of squeezing it. */}
      <DetailLayout rail={<TaskRail task={task} project={project} inPanel />}>
        <ReadingColumn padding="">
          <TaskView task={task} project={project} comments={comments} />
        </ReadingColumn>
      </DetailLayout>
    </Panel>
  );
}
