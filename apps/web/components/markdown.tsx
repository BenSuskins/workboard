import { marked } from "marked";

export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  const html = marked.parse(children, { async: false, gfm: true, breaks: true });
  return <div className={`prose-wb ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
