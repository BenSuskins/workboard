import { notFound } from "next/navigation";
import { getProject } from "@workboard/core";
import { TaskComposer } from "@/components/task-list";
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
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-6 px-10 py-7">
      {/* The top bar already says which project and which view; the composer's
          own Column select says which lane. */}
      <TaskComposer project={project} lane={lane} />
    </div>
  );
}
