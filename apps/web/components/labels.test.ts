import { describe, expect, it } from "vitest";
import { PROJECT_ACCENTS } from "@workboard/core";
import { STATUS_LABEL, tileAccent, tileGlyph } from "./labels.js";

describe("vocabulary", () => {
  it("reads domain enums as the words the board shows", () => {
    expect(STATUS_LABEL.active).toBe("Moving");
    expect(STATUS_LABEL.on_hold).toBe("Parked");
    expect(STATUS_LABEL.archived).toBe("Shelved");
  });
});

describe("tileAccent", () => {
  it("uses the project's own accent when it has one", () => {
    expect(tileAccent({ slug: "anything", accent: "teal" })).toBe("teal");
  });

  it("derives a known accent from the slug when unset", () => {
    const derived = tileAccent({ slug: "search-relevance-rework", accent: null });
    expect(PROJECT_ACCENTS).toContain(derived);
  });

  it("gives the same slug the same accent every time", () => {
    const first = tileAccent({ slug: "payments-v2-migration", accent: null });
    const second = tileAccent({ slug: "payments-v2-migration", accent: null });
    expect(first).toBe(second);
  });

  it("spreads different slugs across more than one hue", () => {
    const slugs = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
    const hues = new Set(slugs.map((slug) => tileAccent({ slug, accent: null })));
    expect(hues.size).toBeGreaterThan(1);
  });
});

describe("tileGlyph", () => {
  it("prefers the project's icon", () => {
    expect(tileGlyph({ name: "Workboard", icon: "🚀" })).toBe("🚀");
  });

  it("falls back to the name's initial", () => {
    expect(tileGlyph({ name: "workboard", icon: null })).toBe("W");
    expect(tileGlyph({ name: "workboard", icon: "  " })).toBe("W");
  });

  it("survives a project with no usable name", () => {
    expect(tileGlyph({ name: "", icon: null })).toBe("?");
  });
});
