import { authorLabel } from "../lib/format";

/**
 * An identicon, not identity data. Workboard stores `author` as a bare string —
 * there is no user table and no uploaded picture — so the gradient is derived
 * from the string itself. The same author is the same colour everywhere.
 */
const GRADIENTS = [
  ["#ff8a5c", "#f45d9c"],
  ["#7bd6f5", "#5e6ad2"],
  ["#6ee7b7", "#3b82f6"],
  ["#c4b5fd", "#7c3aed"],
  ["#fcd34d", "#f97316"],
  ["#f9a8d4", "#a855f7"],
  ["#5eead4", "#0d9488"],
  ["#fda4af", "#e11d48"],
];

function gradientFor(author: string): [string, string] {
  let hash = 0;
  for (const char of author) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length] as [string, string];
}

const SIZES = {
  xs: "size-[18px] text-[9px]",
  sm: "size-5 text-[9px]",
  md: "size-6 text-[10px]",
  lg: "size-7 text-micro",
};

/** authorLabel prefixes agents with an emoji, which is no use as an initial. */
function initialFor(author: string): string {
  const name = author.startsWith("agent:") ? author.slice(6) : author;
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function Avatar({ author, size = "md" }: { author: string; size?: keyof typeof SIZES }) {
  const [from, to] = gradientFor(author);
  const label = authorLabel(author);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white/95 ${SIZES[size]}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      title={label}
      aria-label={label}
    >
      {initialFor(author)}
    </span>
  );
}

/**
 * Overlapping stack of everyone who has touched a project, most recent first.
 * The ring lives here rather than on Avatar: it is what separates two avatars
 * that overlap, and a single avatar on a card has nothing to be separated from.
 */
export function AvatarStack({ authors, max = 3 }: { authors: string[]; max?: number }) {
  const shown = authors.slice(0, max);
  const extra = authors.length - shown.length;
  if (shown.length === 0) return null;
  return (
    <div className="flex items-center">
      {shown.map((author, index) => (
        <span key={author} className={`rounded-full ring-2 ring-surface ${index === 0 ? "" : "-ml-2"}`}>
          <Avatar author={author} />
        </span>
      ))}
      {extra > 0 && (
        <span className="-ml-2 inline-flex size-6 items-center justify-center rounded-full bg-surface-2 text-[10px] font-medium text-ink-2 ring-2 ring-surface">
          +{extra}
        </span>
      )}
    </div>
  );
}
