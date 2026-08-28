import { notFound } from "next/navigation";
import { getTaskDetail } from "@workboard/core";
import { DetailLayout, ReadingColumn } from "@/components/detail-layout";
import { Mermaid } from "@/components/mermaid";
import { TaskRail, TaskView } from "@/components/task-view";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const detail = getTaskDetail(db(), Number(id));
  if (!detail || detail.project.slug !== slug) notFound();
  const { task, project, comments } = detail;

  return (
    <DetailLayout rail={<TaskRail task={task} project={project} />}>
      <Mermaid />
      <ReadingColumn>
        <TaskView task={task} project={project} comments={comments} />
      </ReadingColumn>
    </DetailLayout>
  );
}
