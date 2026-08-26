import { marked } from "marked";

/**
 * Markdown to HTML, with mermaid fences left as inert placeholders for the
 * client to draw. Separated from the component so it can be tested directly.
 */

/**
 * Mermaid names its diagram type on the first meaningful line. Reading it lets
 * the figure bar say what the reader is looking at before it renders.
 */
const DIAGRAM_KINDS: [RegExp, string][] = [
  [/^gantt\b/, "Timeline"],
  [/^pie\b/, "Pie chart"],
  [/^(flowchart|graph)\b/, "Flowchart"],
  [/^sequenceDiagram\b/, "Sequence"],
  [/^classDiagram\b/, "Class diagram"],
  [/^stateDiagram(-v2)?\b/, "State diagram"],
  [/^erDiagram\b/, "Entity diagram"],
  [/^journey\b/, "User journey"],
  [/^mindmap\b/, "Mindmap"],
  [/^timeline\b/, "Timeline"],
  [/^quadrantChart\b/, "Quadrant"],
  [/^xychart(-beta)?\b/, "XY chart"],
  [/^gitGraph\b/, "Git graph"],
  [/^sankey(-beta)?\b/, "Sankey"],
];

export function diagramKind(source: string): string {
  const lines = source.split("\n").map((line) => line.trim());
  // A front-matter block leads the source entirely; skip its contents, not just its fences.
  let start = 0;
  if (lines[0] === "---") {
    const close = lines.indexOf("---", 1);
    start = close === -1 ? lines.length : close + 1;
  }
  // %% directives and comments can still sit above the type line.
  const first = lines.slice(start).find((line) => line && !line.startsWith("%%"));
  if (!first) return "Diagram";
  for (const [pattern, label] of DIAGRAM_KINDS) {
    if (pattern.test(first)) return label;
  }
  return "Diagram";
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const renderer = new marked.Renderer();
const inheritedCode = renderer.code.bind(renderer);
renderer.code = function code(token) {
  if (token.lang !== "mermaid") return inheritedCode(token);
  const escaped = escapeHtml(token.text);
  const kind = escapeHtml(diagramKind(token.text));
  return (
    `<figure class="wb-figure">` +
    `<figcaption class="wb-figure-bar">` +
    `<span class="wb-figure-kind">Diagram</span><span>${kind}</span>` +
    `<button type="button" class="wb-figure-expand" data-wb-expand aria-label="View diagram fullscreen" title="View fullscreen">⤢</button>` +
    `</figcaption>` +
    `<div class="wb-mermaid" role="img"><pre class="wb-mermaid-src">${escaped}</pre></div>` +
    `</figure>`
  );
};

export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false, gfm: true, breaks: true, renderer });
}
