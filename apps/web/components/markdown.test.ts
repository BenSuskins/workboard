import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown-html.js";

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
});
