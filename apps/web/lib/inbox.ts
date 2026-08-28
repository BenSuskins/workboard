/**
 * What is waiting on a person. The sidebar badge and the Inbox page both need
 * the same count, so one function builds the list and both call it — a badge
 * that disagreed with the page it links to would be worse than none.
 */

import { getActivity, listOpenQuestions, type Post, type Store } from "@workboard/core";
import { toPlainText } from "./format";

export type InboxKind = "question" | "critical" | "warning" | "info" | "update";

export interface InboxItem {
  key: string;
  kind: InboxKind;
  title: string;
  blurb: string;
  project: { slug: string; name: string };
  href: string;
  /** null for a warning — nobody raised it in the sense a post has an author. */
  author: string | null;
  at: number;
}

/** How far back an agent update still counts as "just happened". */
export const UPDATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** A post's headline, falling back to the first line of its body when it has none. */
function postTitle(post: Post): string {
  if (post.title) return post.title;
  return toPlainText(post.body).split(/(?<=[.!?])\s|\n/)[0] ?? "";
}

export function collectInbox(database: Store, now: number): InboxItem[] {
  const activity = getActivity(database, now - UPDATE_WINDOW_MS);
  const items: InboxItem[] = [];

  // Open questions carry no age limit — an unanswered question blocks an agent
  // however old it is, so it stays in the inbox until it is answered.
  for (const post of listOpenQuestions(database)) {
    const project = activity.projects.find((entry) => entry.project.id === post.projectId)?.project;
    if (!project) continue;
    items.push({
      key: `question-${post.id}`,
      kind: "question",
      title: postTitle(post),
      blurb: toPlainText(post.body),
      project: { slug: project.slug, name: project.name },
      href: `/projects/${project.slug}/posts/${post.id}`,
      author: post.author,
      at: post.createdAt,
    });
  }

  for (const { project, openWarnings } of activity.projects) {
    for (const warning of openWarnings) {
      items.push({
        key: `warning-${warning.id}`,
        kind: warning.severity,
        title: warning.message,
        blurb: warning.suggestedAction ?? warning.message,
        project: { slug: project.slug, name: project.name },
        href: `/projects/${project.slug}`,
        author: null,
        at: warning.createdAt,
      });
    }
  }

  for (const { project, posts } of activity.projects) {
    for (const post of posts) {
      if (post.type !== "agent_update") continue;
      items.push({
        key: `update-${post.id}`,
        kind: "update",
        title: postTitle(post),
        blurb: toPlainText(post.body),
        project: { slug: project.slug, name: project.name },
        href: `/projects/${project.slug}/posts/${post.id}`,
        author: post.author,
        at: post.createdAt,
      });
    }
  }

  return items.sort((a, b) => b.at - a.at);
}
