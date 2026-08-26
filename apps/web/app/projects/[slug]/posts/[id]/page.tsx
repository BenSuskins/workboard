import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getProject, listComments } from "@workboard/core";
import { Markdown } from "@/components/markdown";
import { Mermaid } from "@/components/mermaid";
import { TimeAgo } from "@/components/time-ago";
import { addCommentAction } from "@/lib/actions";
import { db } from "@/lib/db";
import { authorLabel, fullDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-hairline bg-page px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const btnCls = "rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep";

export default async function PostPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const store = db();
  const post = getPost(store, Number(id));
  const project = post && getProject(store, post.projectId);
  if (!post || !project || project.slug !== slug) notFound();
  const comments = listComments(store, post.id);
  const isOpenQuestion = post.type === "question" && !post.answeredAt;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Mermaid />

      <div className="flex items-center gap-2 text-xs text-muted">
        <Link href="/" className="hover:text-ink">
          Board
        </Link>
        <span>/</span>
        <Link href={`/projects/${project.slug}`} className="hover:text-ink">
          {project.name}
        </Link>
        <span>/</span>
        <span className="text-ink-2">post #{post.id}</span>
      </div>

      <article className="flex flex-col gap-3 rounded-[10px] border border-hairline bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="font-medium text-ink-2">{authorLabel(post.author)}</span>
          {post.type === "question" && (
            <span
              className={`rounded-md px-1.5 py-0.5 font-medium ${
                post.answeredAt ? "bg-good/15 text-good" : "bg-serious/15 text-serious"
              }`}
            >
              {post.answeredAt ? "answered" : "open question"}
            </span>
          )}
          <span title={fullDate(post.createdAt)}>
            <TimeAgo at={post.createdAt} />
          </span>
        </div>

        {post.title && <h1 className="text-[22px] font-semibold tracking-tight text-ink">{post.title}</h1>}
        {post.body ? <Markdown>{post.body}</Markdown> : <p className="text-sm text-muted">No body.</p>}
      </article>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">
          {comments.length === 0 ? "No replies yet" : `${comments.length} repl${comments.length === 1 ? "y" : "ies"}`}
        </h2>

        {comments.map((comment) => (
          <div key={comment.id} className="rounded-[10px] border border-hairline bg-surface p-3.5">
            <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
              <span className="font-medium text-ink-2">{authorLabel(comment.author)}</span>
              <span title={fullDate(comment.createdAt)}>
                · <TimeAgo at={comment.createdAt} />
              </span>
            </div>
            <Markdown>{comment.body}</Markdown>
          </div>
        ))}

        <form action={addCommentAction} className="flex flex-col gap-2">
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <textarea
            name="body"
            rows={3}
            required
            placeholder={isOpenQuestion ? "Answer the question…" : "Reply (markdown)…"}
            className={inputCls}
          />
          <div className="flex items-center gap-3">
            <button type="submit" className={btnCls}>
              {isOpenQuestion ? "Answer" : "Reply"}
            </button>
            {isOpenQuestion && <span className="text-[11px] text-muted">Your reply reaches the agent through list_answers.</span>}
          </div>
        </form>
      </section>
    </div>
  );
}
