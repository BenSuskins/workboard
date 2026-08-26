import { renderMarkdown } from "./markdown-html.js";

export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return <div className={`prose-wb ${className}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(children) }} />;
}
