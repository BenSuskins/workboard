import { MenuLink } from "./filter-controls";
import { topBarPrimaryCls } from "./page-top-bar";

/**
 * "New issue" has no cross-project route — a task always files against one
 * project — so the primary action in the Issues bar is a project picker
 * rather than a single link. A native `<details>` disclosure, like every other
 * menu in the app, so the choice costs no client JS.
 */
export function NewIssueMenu({ projects }: { projects: { slug: string; name: string }[] }) {
  return (
    <details className="group relative">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden ${topBarPrimaryCls}`}
      >
        New issue
        <span aria-hidden className="text-grid transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 flex max-h-72 min-w-40 flex-col overflow-y-auto rounded-control border border-hairline bg-surface p-1 shadow-lg">
        {projects.map((project) => (
          <MenuLink key={project.slug} href={`/projects/${project.slug}/tasks/new`} active={false}>
            {project.name}
          </MenuLink>
        ))}
      </div>
    </details>
  );
}
