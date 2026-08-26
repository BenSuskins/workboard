import { notFound } from "next/navigation";
import { getTaskDetail } from "@workboard/core";
import { ContextCard } from "@/components/context-card";
import { Mermaid } from "@/components/mermaid";
import { Panel } from "@/components/panel";
import { TaskView } from "@/components/task-view";
import { TASK_STATUS_LABEL, UP_FOR_GRABS } from "@/components/labels";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TaskPanel({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const detail = getTaskDetail(db(), Number(id));
  if (!detail || detail.project.slug !== slug) notFound();
  const { task, project } = detail;

  return (
    <Panel
      title={task.title}
      href={`/projects/${project.slug}/tasks/${task.id}`}
      breadcrumb={<span className="truncate text-meta text-ink-2">{project.name}</span>}
    >
      <Mermaid />
      <div className="flex flex-col gap-6">
        <TaskView task={task} project={project} />
        <ContextCard
          project={project}
          author={task.author}
          createdAt={task.createdAt}
          extra={[
            { label: "Task state", value: TASK_STATUS_LABEL[task.status] },
            { label: "Queue", value: task.agentReady ? UP_FOR_GRABS : "Not queued" },
            ...(task.claimedBy ? [{ label: "Claimed by", value: task.claimedBy }] : []),
          ]}
        />
      </div>
    </Panel>
  );
}
