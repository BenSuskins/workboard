import Link from "next/link";
import { getProject, getProjectDetail, listOpenQuestions, listProjects, type ProjectDetail, type Warning } from "@workboard/core";
import { Avatar } from "@/components/avatar";
import { pageContainerCls } from "@/components/form";
import { SectionHeading } from "@/components/section";
import { TimeAgo } from "@/components/time-ago";
import { resolveWarningAction } from "@/lib/actions";
import { db } from "@/lib/db";
import { authorLabel, toPlainText } from "@/lib/format";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<Warning["severity"], string> = {
  critical: "text-critical",
  warning: "text-warning",
  info: "text-ink-2",
};

/**
 * What is waiting on a person. Workboard has no read state, so this is not a
 * feed of everything — it lists the two things that actually block an agent: a
 * question nobody has answered, and a warning nobody has resolved.
 */
export default async function InboxPage() {
  const database = db();
  const questions = listOpenQuestions(database);
  const details = listProjects(database, {})
    .map((project) => getProjectDetail(database, project.id, { postsLimit: 0 }))
    .filter((detail): detail is ProjectDetail => detail !== undefined);

  const warnings = details.flatMap((detail) =>
    detail.openWarnings.map((warning) => ({ warning, project: detail.project })),
  );
  const total = questions.length + warnings.length;

  return (
    <div className={`${pageContainerCls} flex flex-col gap-6`}>
      <div className="flex flex-col gap-1">
        <h1 className="text-heading font-semibold tracking-tight text-ink">Inbox</h1>
        <p className="text-meta text-muted">
          {total === 0 ? "Nothing is waiting on you." : `${total} thing${total === 1 ? "" : "s"} need you.`}
        </p>
      </div>

      {total === 0 && (
        <div className="rounded-card border border-dashed border-grid px-6 py-16 text-center text-body text-muted">
          No open questions and no open warnings. Agents are unblocked.
        </div>
      )}

      {questions.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeading title="Open questions" count={questions.length} />
          <ul className="flex flex-col gap-2">
            {questions.map((post) => {
              const project = getProject(database, post.projectId);
              if (!project) return null;
              return (
                <li key={post.id}>
                  <Link
                    href={`/projects/${project.slug}/posts/${post.id}`}
                    className="flex flex-col gap-1.5 rounded-card border border-hairline bg-surface p-4 transition-colors hover:border-accent/40"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-meta font-medium text-muted">
                      <Avatar author={post.author} size="sm" />
                      <span className="font-medium text-ink-2">{authorLabel(post.author)}</span>
                      <span className="rounded-chip bg-serious/15 px-1.5 py-0.5 font-medium text-serious">asked</span>
                      <span>in {project.name}</span>
                      <span className="ml-auto">
                        <TimeAgo at={post.createdAt} />
                      </span>
                    </div>
                    {post.title && <span className="text-title font-medium text-ink">{post.title}</span>}
                    <p className="line-clamp-2 text-body text-ink-2">{toPlainText(post.body)}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {warnings.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeading title="Open warnings" count={warnings.length} />
          <ul className="flex flex-col gap-2">
            {warnings.map(({ warning, project }) => (
              <li
                key={warning.id}
                className="flex items-start gap-3 rounded-card border border-hairline bg-surface p-4"
              >
                <span className={`mt-0.5 shrink-0 ${SEVERITY_TONE[warning.severity]}`} aria-hidden>
                  ⚠
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-meta font-medium text-muted">
                    <span className={`font-medium capitalize ${SEVERITY_TONE[warning.severity]}`}>{warning.severity}</span>
                    <Link href={`/projects/${project.slug}`} className="hover:text-ink">
                      {project.name}
                    </Link>
                    <span className="ml-auto">
                      <TimeAgo at={warning.createdAt} />
                    </span>
                  </div>
                  <p className="mt-1 text-body text-ink-2">{warning.message}</p>
                </div>
                <form action={resolveWarningAction} className="shrink-0">
                  <input type="hidden" name="warningId" value={warning.id} />
                  <input type="hidden" name="slug" value={project.slug} />
                  <button
                    type="submit"
                    className="rounded-control border border-hairline px-2.5 py-1 text-meta text-ink-2 transition-colors hover:border-muted hover:text-ink"
                  >
                    Resolve
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
