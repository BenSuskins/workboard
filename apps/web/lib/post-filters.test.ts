import { describe, expect, it } from "vitest";
import type { Post } from "@workboard/core";
import { countByType, postsHref, postTypeParam } from "./post-filters";

const post = (id: number, type: Post["type"], answeredAt: number | null = null): Post => ({
  id,
  projectId: 1,
  type,
  title: "",
  body: "",
  author: "user",
  createdAt: 0,
  answeredAt,
});

describe("postTypeParam", () => {
  it("accepts the four post types", () => {
    expect(postTypeParam("question")).toBe("question");
    expect(postTypeParam("agent_update")).toBe("agent_update");
    expect(postTypeParam("status_change")).toBe("status_change");
    expect(postTypeParam("note")).toBe("note");
  });

  it("returns null for anything else, rather than guessing a type", () => {
    expect(postTypeParam("questions")).toBeNull();
    expect(postTypeParam("")).toBeNull();
    expect(postTypeParam(undefined)).toBeNull();
  });
});

describe("postsHref", () => {
  it("omits the query for the unfiltered feed, so the plain URL stays canonical", () => {
    expect(postsHref("payments", null)).toBe("/projects/payments/activity");
  });

  it("carries the type when one is set", () => {
    expect(postsHref("payments", "question")).toBe("/projects/payments/activity?type=question");
  });
});

describe("countByType", () => {
  it("counts every type, including the ones with no posts", () => {
    const counts = countByType([post(1, "question"), post(2, "question"), post(3, "note")]);
    expect(counts.question).toBe(2);
    expect(counts.note).toBe(1);
    expect(counts.agent_update).toBe(0);
    expect(counts.status_change).toBe(0);
    expect(counts.all).toBe(3);
  });

  it("counts open questions apart from answered ones", () => {
    const counts = countByType([post(1, "question"), post(2, "question", 500)]);
    expect(counts.question).toBe(2);
    expect(counts.openQuestions).toBe(1);
  });
});
