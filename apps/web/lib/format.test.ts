import { describe, expect, it } from "vitest";
import { checkDuration } from "./format";

describe("checkDuration", () => {
  it("reads minutes and seconds off the two timestamps GitHub gives", () => {
    expect(checkDuration({ started_at: "2026-08-26T09:00:00Z", completed_at: "2026-08-26T09:04:12Z" })).toBe("4m 12s");
    expect(checkDuration({ started_at: "2026-08-26T09:00:00Z", completed_at: "2026-08-26T09:00:58Z" })).toBe("58s");
    expect(checkDuration({ started_at: "2026-08-26T09:00:00Z", completed_at: "2026-08-26T09:01:05Z" })).toBe("1m 05s");
  });

  it("says nothing for a check that has not finished", () => {
    expect(checkDuration({ started_at: "2026-08-26T09:00:00Z", completed_at: null })).toBe("—");
    expect(checkDuration({})).toBe("—");
  });
});
