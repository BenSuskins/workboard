import { notFound } from "next/navigation";
import { getProject, listDeleted } from "@workboard/core";
import { ProjectSettings, RecentlyDeleted } from "@/components/project-settings";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Settings used to be two <details> panels at the foot of the overview, held
 * full-width because a 300px rail clips every select. Given their own route
 * they get the room the forms need, and the overview stops carrying a form it
 * only opens occasionally.
 */
export default async function ProjectSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const database = db();
  const project = getProject(database, slug);
  if (!project) notFound();
  const deleted = listDeleted(database, project.id);

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4 px-10 py-7">
      <ProjectSettings project={project} />
      <RecentlyDeleted project={project} tasks={deleted.tasks} links={deleted.links} />
    </div>
  );
}
