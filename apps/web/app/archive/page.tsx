import Link from "next/link";
import { listShelvedProjects } from "@workboard/core";
import { restoreProjectAction } from "@/lib/actions";
import { db } from "@/lib/db";
import { StatusBadge } from "@/components/badges";
import { pageContainerCls } from "@/components/form";
import { TimeAgo } from "@/components/time-ago";

export const dynamic = "force-dynamic";

export default function Archive() {
  const shelved = listShelvedProjects(db());
  return (
    <div className={`${pageContainerCls} flex flex-col gap-6`}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-heading font-semibold tracking-tight text-ink">Archive</h1>
        <Link href="/" className="text-meta text-muted transition-colors hover:text-accent">
          ← Board
        </Link>
      </div>
      <p className="-mt-3 text-body text-muted">
        Finished and archived projects rest here, off the main board.
      </p>
      {shelved.length === 0 ? (
        <div className="rounded-card border border-dashed border-grid px-6 py-16 text-center text-body text-muted">
          Nothing archived. Mark a project done or archived on its page to shelve it.
        </div>
      ) : (
        <ul className="grid gap-2">
          {shelved.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-card border border-hairline bg-surface px-4 py-3">
              <Link href={`/projects/${p.slug}`} className="truncate text-body font-medium text-ink hover:text-accent hover:underline">
                {p.name}
              </Link>
              <StatusBadge status={p.status} />
              <span className="hidden truncate text-meta text-muted sm:inline">{p.description}</span>
              <span className="ml-auto shrink-0 text-meta text-muted">
                active <TimeAgo at={p.lastActivityAt} />
              </span>
              <form action={restoreProjectAction} className="shrink-0">
                <input type="hidden" name="projectId" value={p.id} />
                <button
                  type="submit"
                  className="rounded-chip border border-hairline px-2.5 py-1 text-meta font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent"
                >
                  Reactivate
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
