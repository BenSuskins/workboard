import { marked } from "marked";

/**
 * Markdown to HTML, with mermaid fences left as inert placeholders for the
 * client to draw. Separated from the component so it can be tested directly.
 */
const renderer = new marked.Renderer();
const inheritedCode = renderer.code.bind(renderer);
renderer.code = function code(token) {
  if (token.lang !== "mermaid") return inheritedCode(token);
  const escaped = token.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div class="wb-mermaid" role="img"><pre class="wb-mermaid-src">${escaped}</pre></div>`;
};

export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false, gfm: true, breaks: true, renderer });
}
