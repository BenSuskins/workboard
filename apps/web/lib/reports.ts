/**
 * Report runs, in words rather than markup — plain strings, no classes, so they
 * stay testable the way `lib/digest.ts` does. A `Summary` carries no title
 * (`packages/core/src/domain.ts:127`), only a markdown body, so the rail and the
 * digest's "Earlier" list both derive one from it here.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_PATTERN = MONTHS.join("|");

// A run's own heading is often the kind and the date together — "Digest — 28
// Aug" — and the date half is redundant beside the rail row or the byline that
// already names the day, on either side of the dash.
const TRAILING_DATE = new RegExp(`\\s*[—–-]\\s*\\d{1,2}\\s+(?:${MONTH_PATTERN})[a-z]*\\.?(?:\\s+\\d{4})?\\s*$`, "i");
const LEADING_DATE = new RegExp(`^\\s*\\d{1,2}\\s+(?:${MONTH_PATTERN})[a-z]*\\.?(?:\\s+\\d{4})?\\s*[—–-]\\s*`, "i");

function firstSentence(body: string): string {
  const plain = body.replace(/[#*_`>]/g, "").trim();
  const match = plain.match(/^[^.!?\n]+[.!?]?/);
  return (match ? match[0] : plain).trim();
}

/** The first ATX heading, minus any "Digest — 28 Aug" style date prefix; else the first sentence. */
export function reportTitle(body: string): string {
  const heading = body.match(/^#{1,6}\s+(.+)$/m);
  const raw = (heading ? heading[1] : firstSentence(body)).trim();
  const stripped = raw.replace(TRAILING_DATE, "").replace(LEADING_DATE, "").trim();
  return stripped || raw;
}

/** "28 Aug" + "Thursday", for a rail row. */
export function runDateParts(ms: number): { date: string; day: string } {
  const at = new Date(ms);
  return {
    date: at.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    day: at.toLocaleDateString("en-GB", { weekday: "long" }),
  };
}

function startOfWeek(ms: number): number {
  const at = new Date(ms);
  at.setHours(0, 0, 0, 0);
  // Monday is day 1; Sunday (0) is six days past the Monday that started its week.
  const sinceMonday = (at.getDay() + 6) % 7;
  at.setDate(at.getDate() - sinceMonday);
  return at.getTime();
}

/** Newest week first. Week starts Monday; label is "Week of 24 August". */
export function groupByWeek<T>(items: T[], at: (item: T) => number): { label: string; items: T[] }[] {
  const weeks = new Map<number, T[]>();
  for (const item of items) {
    const week = startOfWeek(at(item));
    const existing = weeks.get(week);
    if (existing) existing.push(item);
    else weeks.set(week, [item]);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => b - a)
    .map(([week, weekItems]) => ({
      label: `Week of ${new Date(week).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`,
      items: weekItems,
    }));
}
