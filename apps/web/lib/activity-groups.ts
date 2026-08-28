import type { Post } from "@workboard/core";

/**
 * The activity feed in day-sized pieces. Grouping is by calendar day rather
 * than by elapsed hours: a post at 23:30 last night is fourteen hours old and
 * still belongs under Yesterday, which is how people read a timeline.
 *
 * Only three groups, because a heading per day turns a busy month into a wall
 * of headings. "Earlier" is where the timestamp on each row takes over.
 */
export interface PostGroup {
  label: "Today" | "Yesterday" | "Earlier";
  items: Post[];
}

function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function groupPostsByDay(posts: Post[], now: number): PostGroup[] {
  const today = startOfDay(now);
  const yesterday = startOfDay(today - 1);

  const groups: PostGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Earlier", items: [] },
  ];

  for (const post of posts) {
    const day = startOfDay(post.createdAt);
    const index = day >= today ? 0 : day >= yesterday ? 1 : 2;
    groups[index].items.push(post);
  }

  return groups.filter((group) => group.items.length > 0);
}
