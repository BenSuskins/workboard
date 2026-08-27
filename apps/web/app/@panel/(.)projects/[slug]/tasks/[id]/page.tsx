import { notFound } from "next/navigation";
import { getTaskDetail, taskLane } from "@workboard/core";
import { ContextCard } from "@/components/context-card";
import { Mermaid } from "@/components/mermaid";
import { Panel } from "@/components/panel";
import { TaskView } from "@/components/task-view";
import { TASK_LANE_LABEL, UP_FOR_GRABS } from "@/components/labels";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TaskPanel({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const detail = getTaskDetail(db(), Number(id));
  if (!detail || detail.project.slug !== slug) notFound();
  const { task, project, comments } = detail;
  const lane = taskLane(task);

  return (
    <Panel
      title={task.title}
      href={`/projects/${project.slug}/tasks/${task.id}`}
      breadcrumb={<span className="truncate text-meta text-ink-2">{project.name}</span>}
    >
      <Mermaid />
      <div className="flex flex-col gap-6">
        <TaskView task={task} project={project} comments={comments} />
        <ContextCard
          project={project}
          author={task.author}
          createdAt={task.createdAt}
          extra={[
            { label: "Column", value: TASK_LANE_LABEL[lane] },
            // Queued is the only lane an agent can claim from, whatever the flag says.
            { label: "Queue", value: lane === "queued" ? UP_FOR_GRABS : "Not claimable" },
            ...(task.claimedBy ? [{ label: "Claimed by", value: task.claimedBy }] : []),
          ]}
        />
      </div>
    </Panel>
  );
}
