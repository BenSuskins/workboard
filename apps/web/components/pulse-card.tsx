import { Sparkline } from "./sparkline";

export interface Pulse {
  counts: number[];
  blocked: number;
  moving: number;
}

/**
 * The board's opening line. The coloured word is read off real state rather
 * than decided in advance, so the headline says something different on a quiet
 * day than on a day something is stuck.
 */
function headline(pulse: Pulse): { word: string; tone: string } {
  const today = pulse.counts.at(-1) ?? 0;
  const week = pulse.counts.slice(-7).reduce((a, b) => a + b, 0);
  if (pulse.blocked > 0) return { word: "blocked", tone: "text-critical" };
  if (week === 0) return { word: "quiet", tone: "text-muted" };
  if (today > 0 && pulse.moving > 0) return { word: "moving", tone: "text-good" };
  if (pulse.moving > 0) return { word: "steady", tone: "text-accent" };
  return { word: "waiting", tone: "text-warning" };
}

export function PulseCard({ pulse }: { pulse: Pulse }) {
  const { word, tone } = headline(pulse);
  const today = pulse.counts.at(-1) ?? 0;
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <section className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-5">
      <div>
        <p className="text-meta text-muted">{date}</p>
        <h2 className="mt-1 text-display font-semibold tracking-tight text-ink">
          The workspace is <span className={tone}>{word}</span>
        </h2>
      </div>
      <Sparkline counts={pulse.counts} width={640} height={110} fill className="w-full" />
      <div className="flex items-center justify-between text-meta text-muted">
        <span>posts · {pulse.counts.length} days</span>
        <span>
          <span className="font-semibold text-ink-2">{today}</span> today
        </span>
      </div>
    </section>
  );
}
