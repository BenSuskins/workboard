import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaskDetail, taskLane } from "@workboard/core";
import { ContextCard } from "@/components/context-card";
import { Mermaid } from "@/components/mermaid";
import { TaskView } from "@/components/task-view";
import { TASK_LANE_LABEL, UP_FOR_GRABS } from "@/components/labels";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const detail = getTaskDetail(db(), Number(id));
  if (!detail || detail.project.slug !== slug) notFound();
  const { task, project, comments } = detail;
  const lane = taskLane(task);

  return (
    <div className="flex flex-col gap-5">
      <Mermaid />
      <div className="flex items-center gap-2 text-meta text-muted">
        <Link href="/" className="hover:text-ink">
          Board
        </Link>
        <span>/</span>
        <Link href={`/projects/${project.slug}`} className="hover:text-ink">
          {project.name}
        </Link>
        <span>/</span>
        <span className="text-ink-2">task #{task.id}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
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
    </div>
  );
}
