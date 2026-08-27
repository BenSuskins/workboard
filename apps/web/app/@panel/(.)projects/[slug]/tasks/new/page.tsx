import { notFound } from "next/navigation";
import { getProject } from "@workboard/core";
import { Panel } from "@/components/panel";
import { TaskComposer } from "@/components/task-list";
import { TASK_LANE_LABEL } from "@/components/labels";
import { laneParam } from "@/lib/lanes";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewTaskPanel({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lane?: string }>;
}) {
  const { slug } = await params;
  const project = getProject(db(), slug);
  if (!project) notFound();
  const lane = laneParam((await searchParams).lane) ?? "backlog";

  return (
    <Panel
      title="New task"
      href={`/projects/${project.slug}/tasks/new?lane=${lane}`}
      breadcrumb={<span className="truncate text-meta text-ink-2">New task in {TASK_LANE_LABEL[lane]}</span>}
    >
      <TaskComposer project={project} lane={lane} />
    </Panel>
  );
}
