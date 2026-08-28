/**
 * Provider marks and the CI word. The board card's chip row is gone — a PR
 * pipeline is a project's detail, not something you scan a grid for — so what
 * remains here is what the PR page and the links rail draw.
 */

export function ciLabel(ciStatus: "passing" | "failing" | "pending" | null | undefined): string | null {
  if (ciStatus === "passing") return "CI ✓";
  if (ciStatus === "failing") return "CI ✗";
  if (ciStatus === "pending") return "CI …";
  return null;
}

export function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-3 fill-muted" aria-label="GitHub">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function JiraMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-3 fill-accent" aria-label="Jira">
      <path d="M15.6 7.4 8.6.4a.85.85 0 0 0-1.2 0L5.9 1.9l1.9 1.9a2.4 2.4 0 0 1 .3 3.4 2.4 2.4 0 0 1-3.4.3L2.8 5.6.4 8a.85.85 0 0 0 0 1.2l7 6.4a.85.85 0 0 0 1.2 0l1.5-1.5-1.9-1.9a2.4 2.4 0 0 1-.3-3.4 2.4 2.4 0 0 1 3.4-.3l1.9 1.9 2.4-2.4a.85.85 0 0 0 0-1.2Z" />
    </svg>
  );
}

export function DocMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-3 fill-muted" aria-label="Google Doc">
      <path d="M9.5 0H3.75C3.06 0 2.5.56 2.5 1.25v13.5c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V4l-4-4Zm-4 12.5h5v1h-5v-1Zm5-2.5h-5v1h5v-1Zm0-2.5h-5v1h5v-1ZM9 4.5V1l3.5 3.5H9Z" />
    </svg>
  );
}
