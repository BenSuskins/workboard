import { describe, expect, it } from "vitest";
import { Sparkline } from "./sparkline.js";

/**
 * Sparkline takes no hooks and no context, so the cases where it draws *nothing*
 * can be called as the plain function they are. The drawing path returns JSX and
 * needs a renderer this repo has no harness for, so it is not asserted here.
 */
describe("Sparkline", () => {
  const flat = [0, 0, 0, 0, 0];

  it("draws nothing for a dormant project — a flat line reads as data when it is really absence", () => {
    expect(Sparkline({ counts: flat, hideWhenFlat: true })).toBeNull();
  });

  it("needs two points before there is a line to draw", () => {
    expect(Sparkline({ counts: [3] })).toBeNull();
  });
});
