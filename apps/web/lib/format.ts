export function relativeTime(ms: number | string): string {
  const t = typeof ms === "string" ? Date.parse(ms) : ms;
  const diff = Date.now() - t;
  if (Number.isNaN(diff)) return "";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** "3h", "6d" — the age column on a triage row, with no "ago". */
export function compactAge(ms: number): string {
  const diff = Date.now() - ms;
  if (Number.isNaN(diff)) return "";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

export function fullDate(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function authorLabel(author: string): string {
  return author.startsWith("agent:") ? `🤖 ${author.slice(6)}` : author === "agent" ? "🤖 agent" : author;
}

/** Reduce agent markdown to one line of plain text for dense contexts. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A project nobody has touched for a week is stale; the board says so on its card. */
export const STALE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * "stale 12d", or nothing. Only active work can go stale — a parked or finished
 * project is quiet because it is meant to be, and badging it would cry wolf.
 */
export function staleLabel(lastActivityAt: number, status: string): string | null {
  if (status !== "active") return null;
  const idle = Date.now() - lastActivityAt;
  if (idle <= STALE_MS) return null;
  return `stale ${Math.floor(idle / 86_400_000)}d`;
}

/**
 * How long a check ran — "4m 12s", "58s", or an em dash while it is still
 * going. GitHub gives the two timestamps and no duration.
 */
export function checkDuration(check: { started_at?: string | null; completed_at?: string | null }): string {
  if (!check.started_at || !check.completed_at) return "—";
  const seconds = Math.round((Date.parse(check.completed_at) - Date.parse(check.started_at)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}
