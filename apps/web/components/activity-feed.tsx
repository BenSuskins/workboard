import Link from "next/link";
import type { Comment, Post, Project } from "@workboard/core";
import { Avatar } from "./avatar";
import { RuledLabel } from "./detail-layout";
import { POST_TYPE_LABEL } from "./labels";
import { TypeMark } from "./state-glyphs";
import { TimeAgo } from "./time-ago";
import { addPostAction } from "@/lib/actions";
import { groupPostsByDay } from "@/lib/activity-groups";
import { authorLabel, toPlainText } from "@/lib/format";

/**
 * One line to start with, because most posts are one line. The body opens as
 * soon as there is a title to hang it under, and the hint says what the box
 * accepts without a toolbar of buttons that do it for you.
 */
export function PostComposer({ project }: { project: Project }) {
  return (
    <form
      id="compose"
      action={addPostAction}
      className="flex flex-col gap-2 rounded-card border border-hairline bg-surface px-3.5 py-3 transition-colors focus-within:border-accent"
    >
      <input type="hidden" name="projectId" value={project.id} />
      <input type="hidden" name="slug" value={project.slug} />
      <input
        name="title"
        placeholder="Write a post…"
        aria-label="Post title"
        className="w-full bg-transparent text-title font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted"
      />
      <textarea
        name="body"
        rows={2}
        placeholder="Detail, if it needs any."
        aria-label="Post body"
        className="w-full resize-none bg-transparent text-body text-ink outline-none placeholder:text-muted"
      />
      <div className="flex items-center gap-2">
        <span className="text-meta text-muted">Markdown and mermaid both render</span>
        <button
          type="submit"
          className="ml-auto rounded-control bg-accent px-3 py-1.5 text-label font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          Post
        </button>
      </div>
    </form>
  );
}

/**
 * The project timeline. Rows are borderless until you point at one — a feed of
 * forty bordered cards is forty boxes competing with each other, and the thing
 * being read is the text. Days are the only headings, because a timeline you
 * scan is answering "when", and the row's own timestamp answers the rest.
 *
 * `grouped` is off on the overview, where the feed is a six-post excerpt and
 * day headings would outnumber the posts under them.
 */
export function ActivityFeed({
  posts,
  comments,
  project,
  grouped = false,
}: {
  posts: Post[];
  comments: Comment[];
  project: Project;
  grouped?: boolean;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-grid px-6 py-10 text-center text-detail text-muted">
        No activity yet.
      </div>
    );
  }

  if (!grouped) {
    return (
      <ol className="-mx-3 flex flex-col">
        {posts.map((post) => (
          <li key={post.id}>
            <PostRow post={post} comments={comments} project={project} />
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="-mx-3 flex flex-col gap-4">
      {groupPostsByDay(posts, Date.now()).map((group) => (
        <section key={group.label} className="flex flex-col">
          <RuledLabel>{group.label}</RuledLabel>
          <ol className="flex flex-col">
            {group.items.map((post) => (
              <li key={post.id}>
                <PostRow post={post} comments={comments} project={project} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function PostRow({ post, comments, project }: { post: Post; comments: Comment[]; project: Project }) {
  const replies = comments.filter((comment) => comment.postId === post.id).length;
  const openQuestion = post.type === "question" && !post.answeredAt;
  return (
    <Link
      href={`/projects/${project.slug}/posts/${post.id}`}
      className="flex gap-2.5 rounded-card border border-transparent px-3 py-2.5 transition-colors duration-[130ms] hover:border-hairline hover:bg-surface"
    >
      <Avatar author={post.author} size="md" />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex flex-wrap items-center gap-2 text-meta">
          <span className="font-medium text-ink">{authorLabel(post.author)}</span>
          <span className="inline-flex items-center gap-1.5 text-muted">
            <TypeMark type={post.type} />
            {openQuestion ? "open question" : post.answeredAt ? "answered" : POST_TYPE_LABEL[post.type].toLowerCase()}
          </span>
          <span className="ml-auto text-muted">
            <TimeAgo at={post.createdAt} />
          </span>
        </span>
        {post.title && (
          <span className="text-pretty text-prose font-medium tracking-[-0.005em] text-ink">{post.title}</span>
        )}
        {post.body && <span className="line-clamp-2 text-pretty text-detail text-muted">{toPlainText(post.body)}</span>}
        {replies > 0 && (
          <span className="pt-0.5 text-meta text-muted">
            {replies} repl{replies === 1 ? "y" : "ies"}
          </span>
        )}
      </span>
    </Link>
  );
}
