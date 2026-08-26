import { notFound } from "next/navigation";
import { getProjectDetail, integrationStatus, type Task, type TaskStatus } from "@workboard/core";
import { Mermaid } from "@/components/mermaid";
import { ProjectHeader } from "@/components/project-header";
import { SectionHeading } from "@/components/section";
import { StatCells } from "@/components/stat-strip";
import { TaskComposer, TaskList } from "@/components/task-list";
import { TASK_STATUS_LABEL, UP_FOR_GRABS } from "@/components/labels";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const GROUPS: { status: TaskStatus; title: string }[] = [
  { status: "in_progress", title: TASK_STATUS_LABEL.in_progress },
  { status: "todo", title: TASK_STATUS_LABEL.todo },
  { status: "done", title: TASK_STATUS_LABEL.done },
];

export default async function ProjectTasksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = getProjectDetail(db(), slug, { postsLimit: 0 });
  if (!detail) notFound();
  const { project, tasks } = detail;
  const integrations = integrationStatus();
  const anyConfigured = integrations.github || integrations.jira || integrations.google;

  const byStatus = (status: TaskStatus): Task[] => tasks.filter((task) => task.status === status);
  const upForGrabs = tasks.filter((t) => t.agentReady && t.status === "todo" && !t.claimedAt);
  const claimed = tasks.filter((t) => t.claimedBy && t.status !== "done");

  return (
    <div className="flex flex-col gap-6">
      <Mermaid />
      <ProjectHeader project={project} active="/tasks" configured={anyConfigured} />

      <StatCells
        items={[
          { label: TASK_STATUS_LABEL.in_progress, value: byStatus("in_progress").length },
          { label: TASK_STATUS_LABEL.todo, value: byStatus("todo").length },
          { label: UP_FOR_GRABS, value: upForGrabs.length },
          { label: "Claimed", value: claimed.length },
          { label: TASK_STATUS_LABEL.done, value: byStatus("done").length },
        ]}
      />

      <TaskComposer project={project} />

      {tasks.length === 0 ? (
        <div className="rounded-card border border-dashed border-grid px-6 py-16 text-center text-body text-muted">
          No tasks yet. Add one above, or let an agent file them through the MCP server.
        </div>
      ) : (
        GROUPS.map(({ status, title }) => {
          const group = byStatus(status);
          if (group.length === 0) return null;
          return (
            <section key={status} className="flex flex-col gap-3">
              <SectionHeading title={title} count={group.length} />
              <TaskList tasks={group} project={project} />
            </section>
          );
        })
      )}
    </div>
  );
}
