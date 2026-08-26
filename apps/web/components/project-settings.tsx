import { CATEGORY_PRESETS, PROJECT_ACCENTS, type Link as ProjectLink, type Project, type Task } from "@workboard/core";
import { STATUS_LABEL } from "./labels";
import { TimeAgo } from "./time-ago";
import { restoreLinkAction, restoreTaskAction, updateProjectAction } from "@/lib/actions";

import { Field, fieldCls as inputCls, primaryButtonCls as btnCls, selectCls } from "./form";

export function ProjectSettings({ project }: { project: Project }) {
  return (
    <details className="group rounded-card border border-hairline bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-body text-ink-2 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
          &#8250;
        </span>
        Project settings
      </summary>

      <form action={updateProjectAction} className="flex flex-col gap-5 border-t border-hairline p-4">
        <input type="hidden" name="id" value={project.id} />
        <input type="hidden" name="slug" value={project.slug} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input name="name" defaultValue={project.name} className={inputCls} />
          </Field>
          <Field label="Category">
            <input name="category" defaultValue={project.category} list="category-presets" className={inputCls} />
            <datalist id="category-presets">
              {CATEGORY_PRESETS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field label="Description / goal" hint="Markdown renders on the project page.">
          <textarea name="description" defaultValue={project.description} rows={4} className={inputCls} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status">
            <select name="status" defaultValue={project.status} className={selectCls}>
              {(["active", "blocked", "on_hold", "done", "archived"] as const).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select name="priority" defaultValue={project.priority} className={selectCls}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </Field>
          <Field label="Health">
            <select name="health" defaultValue={project.health} className={selectCls}>
              <option value="green">On track</option>
              <option value="amber">At risk</option>
              <option value="red">Off track</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[6rem_1fr]">
          <Field label="Icon">
            <input name="icon" defaultValue={project.icon ?? ""} maxLength={4} placeholder="🚀" className={`${inputCls} text-center`} />
          </Field>
          <Field label="Tile colour" hint="Leave it derived and the colour follows the name.">
            <select name="accent" defaultValue={project.accent ?? ""} className={selectCls}>
              <option value="">Derived from the name</option>
              {PROJECT_ACCENTS.map((a) => (
                <option key={a} value={a} className="capitalize">
                  {a}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <button type="submit" className={btnCls}>
            Save changes
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
