import { CATEGORY_PRESETS, PROJECT_ACCENTS, type Link as ProjectLink, type Project, type Task } from "@workboard/core";
import { STATUS_LABEL } from "./labels";
import { TimeAgo } from "./time-ago";
import { restoreLinkAction, restoreTaskAction, updateProjectAction } from "@/lib/actions";

const inputCls =
  "w-full rounded-control border border-hairline bg-page px-2.5 py-1.5 text-body text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const btnCls = "rounded-control bg-accent px-3.5 py-1.5 text-meta font-medium text-white transition-colors hover:bg-accent-deep";

export function ProjectSettings({ project }: { project: Project }) {
  return (
    <details className="rounded-card border border-hairline bg-surface">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-meta text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        Project settings
      </summary>
      <form action={updateProjectAction} className="grid gap-3 border-t border-hairline p-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={project.id} />
        <input type="hidden" name="slug" value={project.slug} />
        <label className="flex flex-col gap-1 text-meta text-muted">
          Name
          <input name="name" defaultValue={project.name} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted">
          Category
          <input name="category" defaultValue={project.category} list="category-presets" className={inputCls} />
          <datalist id="category-presets">
            {CATEGORY_PRESETS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted sm:col-span-2">
          Description / goal (markdown)
          <textarea name="description" defaultValue={project.description} rows={3} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted">
          Status
          <select name="status" defaultValue={project.status} className={inputCls}>
            {(["active", "blocked", "on_hold", "done", "archived"] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-meta text-muted">
            Priority
            <select name="priority" defaultValue={project.priority} className={inputCls}>
              {["high", "medium", "low"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-meta text-muted">
            Health
            <select name="health" defaultValue={project.health} className={inputCls}>
              <option value="green">on track</option>
              <option value="amber">at risk</option>
              <option value="red">off track</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-meta text-muted">
            Icon (emoji)
            <input name="icon" defaultValue={project.icon ?? ""} maxLength={4} placeholder="🚀" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-meta text-muted">
            Tile colour
            <select name="accent" defaultValue={project.accent ?? ""} className={inputCls}>
              <option value="">from the name</option>
              {PROJECT_ACCENTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className={btnCls}>
            Save
          </button>
        </div>
      </form>
    </details>
  );
}

export function RecentlyDeleted({
  project,
  tasks,
  links,
}: {
  project: Project;
  tasks: Task[];
  links: ProjectLink[];
}) {
  const count = tasks.length + links.length;
  if (count === 0) return null;
  return (
    <details className="rounded-card border border-hairline bg-surface">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-meta text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        Recently deleted ({count})
      </summary>
      <div className="flex flex-col gap-1.5 border-t border-hairline p-4">
        {tasks.map((task) => (
          <div key={`task-${task.id}`} className="flex items-center gap-2 text-body">
            <span className="truncate text-muted line-through">{task.title}</span>
            <span className="text-meta text-muted">
              task · <TimeAgo at={task.deletedAt!} />
            </span>
            <form action={restoreTaskAction} className="ml-auto">
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="slug" value={project.slug} />
              <button type="submit" className="text-meta text-accent hover:underline">
                Restore
              </button>
            </form>
          </div>
        ))}
        {links.map((link) => (
          <div key={`link-${link.id}`} className="flex items-center gap-2 text-body">
            <span className="truncate text-muted line-through">{link.title || link.externalId || link.url}</span>
            <span className="text-meta text-muted">
              link · <TimeAgo at={link.deletedAt!} />
            </span>
            <form action={restoreLinkAction} className="ml-auto">
              <input type="hidden" name="linkId" value={link.id} />
              <input type="hidden" name="slug" value={project.slug} />
              <button type="submit" className="text-meta text-accent hover:underline">
                Restore
              </button>
            </form>
          </div>
        ))}
      </div>
    </details>
  );
}
