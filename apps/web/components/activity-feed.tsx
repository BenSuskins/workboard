import Link from "next/link";
import type { Comment, Post, Project } from "@workboard/core";
import { Avatar } from "./avatar";
import { POST_TYPE_LABEL } from "./labels";
import { TimeAgo } from "./time-ago";
import { addPostAction } from "@/lib/actions";
import { authorLabel, toPlainText } from "@/lib/format";

const TYPE_TONE: Record<Post["type"], string> = {
  question: "bg-serious/15 text-serious",
  agent_update: "bg-accent/15 text-accent",
  status_change: "bg-warning/15 text-warning",
  note: "bg-surface-2 text-ink-2",
};

export function PostComposer({ project }: { project: Project }) {
  return (
    <form
      action={addPostAction}
      className="flex flex-col gap-2 rounded-card border border-hairline bg-surface p-3 focus-within:border-accent/40"
    >
      <input type="hidden" name="projectId" value={project.id} />
      <input type="hidden" name="slug" value={project.slug} />
      <input
        name="title"
        placeholder="Title (optional)"
        aria-label="Post title"
        className="w-full bg-transparent px-1 text-title font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted"
      />
      <textarea
        name="body"
        rows={2}
        placeholder="Write a post — markdown and mermaid both render…"
        aria-label="Post body"
        className="w-full resize-none bg-transparent px-1 text-body text-ink outline-none placeholder:text-muted"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-control bg-accent px-4 py-1.5 text-meta font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          Post
        </button>
      </div>
    </form>
  );
}

/**
 * The project timeline as cards rather than a bulleted list, so a post here
 * reads the same as it does in the slide-over that opens from it.
 */
export function ActivityFeed({ posts, comments, project }: { posts: Post[]; comments: Comment[]; project: Project }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-grid px-6 py-10 text-center text-body text-muted">
        No activity yet.
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {posts.map((post) => {
        const replies = comments.filter((comment) => comment.postId === post.id).length;
        const openQuestion = post.type === "question" && !post.answeredAt;
        return (
          <li key={post.id}>
            <Link
              href={`/projects/${project.slug}/posts/${post.id}`}
              className="flex flex-col gap-1.5 rounded-card border border-hairline bg-surface p-4 transition-colors hover:border-accent/40"
            >
              <div className="flex flex-wrap items-center gap-2 text-meta text-muted">
                <Avatar author={post.author} size="sm" />
                <span className="font-medium text-ink-2">{authorLabel(post.author)}</span>
                <span className={`rounded-chip px-1.5 py-0.5 font-medium ${TYPE_TONE[post.type]}`}>
                  {openQuestion ? "open question" : post.answeredAt ? "answered" : POST_TYPE_LABEL[post.type]}
                </span>
                {replies > 0 && (
                  <span>
                    {replies} repl{replies === 1 ? "y" : "ies"}
                  </span>
                )}
                <span className="ml-auto">
                  <TimeAgo at={post.createdAt} />
                </span>
              </div>
              {post.title && <span className="text-title font-medium text-ink">{post.title}</span>}
              {post.body && <p className="line-clamp-2 text-body text-ink-2">{toPlainText(post.body)}</p>}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
