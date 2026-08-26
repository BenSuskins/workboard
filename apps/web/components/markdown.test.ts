import { describe, expect, it } from "vitest";
import { diagramKind, renderMarkdown } from "./markdown-html.js";

describe("markdown rendering", () => {
  it("turns a mermaid fence into a placeholder the client can draw", () => {
    const html = renderMarkdown("```mermaid\nflowchart LR\n  A-->B\n```");
    expect(html).toContain('class="wb-mermaid"');
    expect(html).toContain("flowchart LR");
    expect(html).not.toContain("<code");
  });

  it("escapes markup inside a diagram rather than injecting it", () => {
    const html = renderMarkdown('```mermaid\nflowchart LR\n  A["<img src=x onerror=alert(1)>"]-->B\n```');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("leaves ordinary fenced code as a code block", () => {
    const html = renderMarkdown("```ts\nconst x = 1;\n```");
    expect(html).toContain("<code");
    expect(html).not.toContain("wb-mermaid");
  });

  it("renders tables and task lists", () => {
    expect(renderMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |")).toContain("<table>");
    expect(renderMarkdown("- [x] done\n- [ ] todo")).toContain('type="checkbox"');
  });

  it("wraps a diagram in a figure carrying its kind and a fullscreen control", () => {
    const html = renderMarkdown("```mermaid\ngantt\n  title X\n```");
    expect(html).toContain('class="wb-figure"');
    expect(html).toContain("Timeline");
    expect(html).toContain("data-wb-expand");
  });
});

describe("diagramKind", () => {
  it("names the common diagram types", () => {
    expect(diagramKind("gantt\n  title X")).toBe("Timeline");
    expect(diagramKind("pie showData")).toBe("Pie chart");
    expect(diagramKind("flowchart LR")).toBe("Flowchart");
    expect(diagramKind("graph TD")).toBe("Flowchart");
    expect(diagramKind("sequenceDiagram")).toBe("Sequence");
    expect(diagramKind("stateDiagram-v2")).toBe("State diagram");
  });

  it("looks past leading directives and front matter", () => {
    expect(diagramKind("%%{init: {'theme':'dark'}}%%\npie title Cards")).toBe("Pie chart");
    expect(diagramKind("---\ntitle: X\n---\ngantt")).toBe("Timeline");
  });

  it("falls back for an unknown or empty source", () => {
    expect(diagramKind("somethingNew ABC")).toBe("Diagram");
    expect(diagramKind("   \n\n")).toBe("Diagram");
  });
});
