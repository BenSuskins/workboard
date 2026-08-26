import type { Comment, Post, Project } from "@workboard/core";
import { addCommentAction } from "@/lib/actions";
import { authorLabel, fullDate } from "@/lib/format";
import { Avatar } from "./avatar";
import { Markdown } from "./markdown";
import { RenderToggle } from "./render-toggle";
import { TimeAgo } from "./time-ago";

/**
 * A post and its replies. The full route and the slide-over both render this,
 * so the two never drift apart — only the chrome around it differs.
 */
export function PostView({ post, project, comments }: { post: Post; project: Project; comments: Comment[] }) {
  const isOpenQuestion = post.type === "question" && !post.answeredAt;

  return (
    <div className="flex flex-col gap-6">
      <article className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2 text-meta text-muted">
          <Avatar author={post.author} size="sm" />
          <span className="font-medium text-ink-2">{authorLabel(post.author)}</span>
          {post.type === "question" && (
            <span
              className={`rounded-chip px-1.5 py-0.5 font-medium ${
                post.answeredAt ? "bg-good/15 text-good" : "bg-serious/15 text-serious"
              }`}
            >
              {post.answeredAt ? "answered" : "open question"}
            </span>
          )}
          <span className="ml-auto" title={fullDate(post.createdAt)}>
            <TimeAgo at={post.createdAt} />
          </span>
        </div>

        {post.title && <h1 className="text-display font-semibold tracking-tight text-ink">{post.title}</h1>}
        {post.body ? <RenderToggle body={post.body} /> : <p className="text-body text-muted">No body.</p>}
      </article>

      <section className="flex flex-col gap-3">
        <h2 className="text-title font-semibold text-ink">
          {comments.length === 0 ? "No replies yet" : `${comments.length} repl${comments.length === 1 ? "y" : "ies"}`}
        </h2>

        {comments.map((comment) => (
          <div key={comment.id} className="rounded-card border border-hairline bg-surface p-4">
            <div className="mb-1.5 flex items-center gap-2 text-meta text-muted">
              <Avatar author={comment.author} size="sm" />
              <span className="font-medium text-ink-2">{authorLabel(comment.author)}</span>
              <span className="ml-auto" title={fullDate(comment.createdAt)}>
                <TimeAgo at={comment.createdAt} />
              </span>
            </div>
            <Markdown>{comment.body}</Markdown>
          </div>
        ))}

        <form
          action={addCommentAction}
          className="flex items-end gap-2 rounded-card border border-hairline bg-surface p-2 focus-within:border-accent/40"
        >
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <textarea
            name="body"
            rows={1}
            required
            aria-label={isOpenQuestion ? "Answer" : "Reply"}
            placeholder={isOpenQuestion ? "Answer the question…" : "Add a comment…"}
            className="min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-body text-ink outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            title={isOpenQuestion ? "Answer" : "Reply"}
            className="grid size-9 shrink-0 place-items-center rounded-control bg-accent text-white transition-opacity hover:opacity-90"
          >
            <span aria-hidden>➤</span>
            <span className="sr-only">{isOpenQuestion ? "Answer" : "Reply"}</span>
          </button>
        </form>
        {isOpenQuestion && <p className="text-meta text-muted">Your reply reaches the agent through list_answers.</p>}
      </section>
    </div>
  );
}
