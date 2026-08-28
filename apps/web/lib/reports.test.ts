import { describe, expect, it } from "vitest";
import { groupByWeek, reportTitle, runDateParts } from "./reports.js";

describe("reportTitle", () => {
  it("takes the first heading and drops a trailing date", () => {
    expect(reportTitle("# Digest — 28 Aug\n\nEverything is fine.")).toBe("Digest");
  });

  it("drops a leading date too", () => {
    expect(reportTitle("# 28 Aug — Digest\n\nEverything is fine.")).toBe("Digest");
  });

  it("keeps a heading with no date as it is", () => {
    expect(reportTitle("## Triage\n\nOne thing needs attention.")).toBe("Triage");
  });

  it("falls back to the first sentence when there is no heading", () => {
    expect(reportTitle("Nothing needs attention this week. More detail follows.")).toBe(
      "Nothing needs attention this week.",
    );
  });
});

describe("runDateParts", () => {
  it("renders the date and the weekday separately", () => {
    // 2026-08-28 is a Friday.
    expect(runDateParts(Date.UTC(2026, 7, 28, 12))).toEqual({ date: "28 Aug", day: "Friday" });
  });
});

describe("groupByWeek", () => {
  const day = 86_400_000;

  it("buckets by the Monday each item's week starts on, newest week first", () => {
    // 2026-08-24 is a Monday; 2026-08-31 is the following Monday.
    const monday = Date.UTC(2026, 7, 24, 12);
    const nextMonday = monday + 7 * day;
    const items = [
      { id: "a", at: monday },
      { id: "b", at: monday + 2 * day },
      { id: "c", at: nextMonday },
    ];
    const groups = groupByWeek(items, (item) => item.at);
    expect(groups.map((g) => g.label)).toEqual(["Week of 31 August", "Week of 24 August"]);
    expect(groups[1].items.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("treats Sunday as the last day of the Monday-started week", () => {
    const monday = Date.UTC(2026, 7, 24, 12);
    const sunday = monday + 6 * day;
    const groups = groupByWeek([{ at: sunday }], (item) => item.at);
    expect(groups[0].label).toBe("Week of 24 August");
  });
});
