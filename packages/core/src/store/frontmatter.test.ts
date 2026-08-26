import { describe, expect, it } from "vitest";
import { parse, serialize } from "./frontmatter.js";

describe("frontmatter", () => {
  it("round-trips scalars, nulls, arrays, and nested objects", () => {
    const doc = {
      fields: {
        id: 42,
        title: 'He said "wave 1" — done',
        priority: null,
        agentReady: 1,
        scope: { labels: ["pay"], pathPrefixes: ["services/pay/"] },
      },
      body: "# Heading\n\nBody with --- a fence-like line and a `code` span.",
    };
    expect(parse(serialize(doc))).toEqual(doc);
  });

  it("round-trips a body containing its own frontmatter fences", () => {
    const doc = { fields: { id: 1 }, body: "---\nnot: frontmatter\n---\n\ntrailing" };
    expect(parse(serialize(doc))).toEqual(doc);
  });

  it("keeps an empty body empty", () => {
    expect(parse(serialize({ fields: { id: 1 }, body: "" }))).toEqual({ fields: { id: 1 }, body: "" });
  });

  it("omits undefined fields rather than writing them", () => {
    expect(serialize({ fields: { a: 1, b: undefined }, body: "" })).not.toContain("b:");
  });

  it("fails loudly on a corrupt document", () => {
    expect(() => parse("no fence here", "task.md")).toThrow(/missing opening frontmatter fence/);
    expect(() => parse("---\nid: 1\n", "task.md")).toThrow(/unterminated frontmatter/);
    expect(() => parse("---\nid: nope\n---\n\nx", "task.md")).toThrow(/not valid JSON/);
    expect(() => parse("---\nbroken\n---\n\nx", "task.md")).toThrow(/malformed frontmatter line/);
  });
});
