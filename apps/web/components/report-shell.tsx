import Link from "next/link";
import type { Summary } from "@workboard/core";
import { MicroLabel } from "./detail-layout";
import { runDateParts } from "@/lib/reports";

/**
 * A report page's shape: a reading column beside a rail of saved runs, each
 * scrolling on its own under the fixed top bar. `DetailLayout` is close but
 * wrong for this — it is a container query sized for the 672px slide-over, and
 * reports need a fixed rail beside a wider column. New shell, same vocabulary.
 */
export function ReportShell({
  children,
  rail,
  wide = false,
  gap = "gap-[22px]",
}: {
  children: React.ReactNode;
  rail: React.ReactNode;
  /** Triage runs wider (880px) than the Digest and Accomplishments prose (820px). */
  wide?: boolean;
  /** Each kind spaces its own content differently — prose reads looser than rows. */
  gap?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-stretch">
      <div className="min-w-0 flex-1 overflow-y-auto px-8 pb-11 pt-7">
        <div className={`mx-auto flex flex-col ${wide ? "max-w-[880px]" : "max-w-[820px]"} ${gap}`}>{children}</div>
      </div>
      <aside className="flex w-[212px] flex-none flex-col gap-2 overflow-y-auto px-4 pb-10 pt-7 shadow-[inset_1px_0_0_var(--wb-hairline)]">
        {rail}
      </aside>
    </div>
  );
}

/** The date rail: every saved run for this report kind, newest first. */
export function RunRail({ runs, currentId, basePath }: { runs: Summary[]; currentId: number; basePath: string }) {
  return (
    <>
      <MicroLabel className="px-2">Runs · {runs.length}</MicroLabel>
      {runs.map((run) => {
        const current = run.id === currentId;
        const { date, day } = runDateParts(run.createdAt);
        return (
          <Link
            key={run.id}
            href={`${basePath}?run=${run.id}`}
            className={`flex items-baseline gap-2 rounded-control px-2 py-[5px] transition-colors hover:bg-surface-2 ${
              current ? "bg-surface-2 text-ink" : "text-ink-2"
            }`}
          >
            <span className="flex-1 text-label tabular-nums">{date}</span>
            <span className="text-[11.5px] text-muted">{day}</span>
          </Link>
        );
      })}
    </>
  );
}
