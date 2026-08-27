/**
 * Issue identifiers — the short name a person says out loud and pastes into a
 * branch, a commit, or a PR title. `ENG-12` is a project's `key` and a task's
 * per-project `number`; neither the board-wide id nor the slug appears in it,
 * so the name survives a rename and stays short as the board grows.
 *
 * Pure on purpose: services allocates identifiers, the backfill assigns them to
 * an older tree, and both need the same rules.
 */
import type { Project, Task } from "./domain.js";

/** `ENG-12`. */
export function taskIdentifier(project: Pick<Project, "key">, task: Pick<Task, "number">): string {
  return `${project.key}-${task.number}`;
}

/** The two halves of an identifier, or undefined when the text is not one. */
export function parseIdentifier(text: string): { key: string; number: number } | undefined {
  const match = /^\s*([A-Za-z][A-Za-z0-9]*)-(\d+)\s*$/.exec(text);
  if (!match) return undefined;
  return { key: match[1].toUpperCase(), number: Number(match[2]) };
}

const KEY_MAX = 3;
const FALLBACK_KEY = "PRJ";

/**
 * A key from a project name: initials for a multi-word name ("Design System" →
 * `DS`), the leading letters for a single word ("Engineering" → `ENG`). Digits
 * count as letters here, but a key may not start with one — `ENG-12` only reads
 * as an identifier when the halves cannot be confused — and a name with nothing
 * usable in it falls back rather than producing an empty prefix.
 */
export function deriveProjectKey(name: string, taken: Iterable<string> = []): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const base =
    words.length === 0
      ? FALLBACK_KEY
      : words.length === 1
        ? words[0].slice(0, KEY_MAX).toUpperCase()
        : words
            .slice(0, KEY_MAX)
            .map((word) => word[0])
            .join("")
            .toUpperCase();
  return uniqueKey(/^\d/.test(base) ? `${FALLBACK_KEY[0]}${base}`.slice(0, KEY_MAX) : base, taken);
}

/** Disambiguate against keys already in use: `ENG`, then `ENG2`, `ENG3`… */
export function uniqueKey(base: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((key) => key.toUpperCase()));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * Labels are compared, filtered, and counted by value, so they are stored in one
 * shape: trimmed, lowercased, deduped, and ordered as first written.
 */
export function normalizeLabels(labels: readonly string[] | undefined): string[] {
  if (!labels) return [];
  const seen = new Set<string>();
  for (const raw of labels) {
    const label = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (label) seen.add(label);
  }
  return [...seen];
}
