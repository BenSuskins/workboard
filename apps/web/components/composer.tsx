import { addPostAction } from "@/lib/actions";
import { Avatar } from "./avatar";

/**
 * Post to a project timeline without leaving the board. Workboard posts always
 * belong to a project, so the picker is part of the control rather than a
 * hidden default — you should see where a note is about to land.
 */
export function Composer({ projects }: { projects: { id: number; slug: string; name: string }[] }) {
  if (projects.length === 0) return null;
  return (
    <form
      action={addPostAction}
      className="flex items-start gap-3 rounded-card border border-hairline bg-surface p-3 focus-within:border-accent/40"
    >
      <span className="pt-1">
        <Avatar author="user" size="lg" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <textarea
          name="body"
          rows={1}
          placeholder="What do you want to share?"
          aria-label="Post body"
          className="w-full resize-none bg-transparent py-1.5 text-body text-ink outline-none placeholder:text-muted"
        />
        <div className="flex items-center justify-between gap-2">
          <select
            name="projectId"
            aria-label="Project"
            defaultValue={projects[0].id}
            className="rounded-control border border-hairline bg-surface-2 px-2.5 py-1.5 text-meta text-ink-2 outline-none focus:border-accent/50"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-control bg-accent px-4 py-1.5 text-meta font-medium text-white transition-opacity hover:opacity-90"
          >
            Post
          </button>
        </div>
      </div>
    </form>
  );
}
