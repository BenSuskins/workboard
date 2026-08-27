import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@workboard/core";
import { TaskComposer } from "@/components/task-list";
import { TASK_LANE_LABEL } from "@/components/labels";
import { db } from "@/lib/db";
import { laneParam } from "@/lib/lanes";

export const dynamic = "force-dynamic";

export default async function NewTaskPage({
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
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-2 text-meta text-muted">
        <Link href={`/projects/${project.slug}`} className="hover:text-ink">
          {project.name}
        </Link>
        <span>/</span>
        <Link href={`/projects/${project.slug}/tasks`} className="hover:text-ink">
          Tasks
        </Link>
        <span>/</span>
        <span className="text-ink-2">New task in {TASK_LANE_LABEL[lane]}</span>
      </div>

      <TaskComposer project={project} lane={lane} />
    </div>
  );
}
