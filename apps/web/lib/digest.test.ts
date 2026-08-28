import { describe, expect, it } from "vitest";
import { digestLead, digestState, projectWantingAttention, type DigestCounts } from "./digest.js";

const NONE: DigestCounts = {
  projects: 4,
  moving: 0,
  movingProjects: 0,
  blocked: 0,
  upForGrabs: 0,
  questions: 0,
};

describe("digestState", () => {
  it("puts a block ahead of everything else — it is the one thing you can act on", () => {
    expect(digestState({ blocked: 3, movingProjects: 2, week: 9 })).toBe("blocked");
  });

  it("reads a week with no posts as quiet, however much is nominally in progress", () => {
    expect(digestState({ blocked: 0, movingProjects: 4, week: 0 })).toBe("quiet");
  });

  it("separates work that is moving from work that is merely open", () => {
    expect(digestState({ blocked: 0, movingProjects: 2, week: 5 })).toBe("moving");
    expect(digestState({ blocked: 0, movingProjects: 0, week: 5 })).toBe("waiting");
  });
});

describe("digestLead", () => {
  it("names the unit, so it cannot be read against the task counts beside it", () => {
    const lead = digestLead({ ...NONE, moving: 12, movingProjects: 4, blocked: 3 });
    expect(lead).toContain("12 tasks moving across 4 projects, 3 blocked.");
  });

  it("agrees in number, down to one of each", () => {
    expect(digestLead({ ...NONE, moving: 1, movingProjects: 1, blocked: 1 })).toContain(
      "1 task moving across 1 project, 1 blocked.",
    );
    expect(digestLead({ ...NONE, upForGrabs: 1, questions: 1 })).toContain(
      "1 task is up for grabs and 1 question is open",
    );
    expect(digestLead({ ...NONE, upForGrabs: 2, questions: 3 })).toContain(
      "2 tasks are up for grabs and 3 questions are open",
    );
  });

  it("says an empty queue out loud rather than dropping the clause", () => {
    expect(digestLead(NONE)).toContain("Nothing is up for grabs and no questions are open");
  });

  it("still reads when nothing is moving at all", () => {
    expect(digestLead({ ...NONE, blocked: 2 })).toContain("Nothing is moving, and 2 tasks are blocked.");
    expect(digestLead(NONE)).toContain("Nothing is moving.");
  });

  it("points at one project when something wants attention, and at none when nothing does", () => {
    expect(digestLead({ ...NONE, attention: "Family Hub" })).toContain(
      "— the only thing wanting attention is Family Hub.",
    );
    expect(digestLead(NONE)).not.toContain("wanting attention");
  });

  it("says what to do when the workspace is empty, instead of counting zeroes", () => {
    expect(digestLead({ ...NONE, projects: 0 })).toBe(
      "No projects yet. Connect a coding agent to the Workboard MCP server, or create one by hand.",
    );
  });
});

describe("projectWantingAttention", () => {
  const day = 86_400_000;
  const now = Date.now();

  it("prefers a block to a warning, and a warning to mere silence", () => {
    const projects = [
      { name: "Quiet", status: "active", warnings: 0, lastActivityAt: now - 30 * day },
      { name: "Warned", status: "active", warnings: 1, lastActivityAt: now },
      { name: "Stuck", status: "blocked", warnings: 0, lastActivityAt: now },
    ];
    expect(projectWantingAttention(projects)).toBe("Stuck");
    expect(projectWantingAttention(projects.slice(0, 2))).toBe("Warned");
    expect(projectWantingAttention(projects.slice(0, 1))).toBe("Quiet");
  });

  it("holds its tongue when everything is healthy and recent", () => {
    expect(projectWantingAttention([{ name: "Fine", status: "active", warnings: 0, lastActivityAt: now }])).toBeNull();
    expect(projectWantingAttention([])).toBeNull();
  });

  it("ignores projects that are quiet on purpose", () => {
    const parked = [{ name: "Parked", status: "on_hold", warnings: 0, lastActivityAt: now - 90 * day }];
    expect(projectWantingAttention(parked)).toBeNull();
  });
});
