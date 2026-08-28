import { describe, expect, it } from "vitest";
import type { Post } from "@workboard/core";
import { groupPostsByDay } from "./activity-groups";

const DAY = 86_400_000;
// Local time throughout: grouping is by the reader's calendar day, so a
// UTC literal would pass or fail depending on the machine's timezone.
const NOW = new Date(2026, 7, 28, 14, 0, 0).getTime();

const post = (id: number, createdAt: number): Post => ({
  id,
  projectId: 1,
  type: "note",
  title: "",
  body: "",
  author: "user",
  createdAt,
  answeredAt: null,
});

describe("groupPostsByDay", () => {
  it("returns nothing for an empty feed", () => {
    expect(groupPostsByDay([], NOW)).toEqual([]);
  });

  it("splits today, yesterday, and everything older", () => {
    const groups = groupPostsByDay(
      [post(1, NOW - 3600_000), post(2, NOW - DAY), post(3, NOW - DAY * 9)],
      NOW,
    );
    expect(groups.map((group) => group.label)).toEqual(["Today", "Yesterday", "Earlier"]);
    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([[1], [2], [3]]);
  });

  it("drops a group with no posts rather than showing an empty heading", () => {
    const groups = groupPostsByDay([post(1, NOW - DAY * 4)], NOW);
    expect(groups.map((group) => group.label)).toEqual(["Earlier"]);
  });

  it("groups by calendar day, not by elapsed hours", () => {
    // 23:30 yesterday is 14.5 hours ago but is still yesterday.
    const lateYesterday = new Date(2026, 7, 27, 23, 30, 0).getTime();
    const groups = groupPostsByDay([post(1, lateYesterday)], NOW);
    expect(groups[0].label).toBe("Yesterday");
  });

  it("keeps the feed's order inside a group", () => {
    const groups = groupPostsByDay([post(1, NOW - 100), post(2, NOW - 200)], NOW);
    expect(groups[0].items.map((item) => item.id)).toEqual([1, 2]);
  });
});
