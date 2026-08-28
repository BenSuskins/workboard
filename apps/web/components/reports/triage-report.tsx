import Link from "next/link";
import type { Summary, Warning, WarningSeverity } from "@workboard/core";
import { listCls, rowCls } from "@/components/list";
import { Markdown } from "@/components/markdown";
import { StatStrip, type StatCell } from "@/components/stat-strip";
import { SEVERITY } from "@/components/warnings";
import { compactAge } from "@/lib/format";

export interface TriageWarningRow {
  warning: Warning;
  project: { slug: string; name: string };
}

export interface SeverityGroup {
  severity: WarningSeverity;
  rows: TriageWarningRow[];
}

/**
 * Triage's strip is the one constant on the page — live counts, whether the
 * column below is showing today's warnings or a saved run's write-up.
 */
export function TriageReport({
  cells,
  run,
  groups,
}: {
  cells: StatCell[];
  /** Set once a saved run is explicitly chosen with `?run=`. */
  run: Summary | undefined;
  groups: SeverityGroup[];
}) {
  return (
    <>
      <StatStrip cells={cells} />
      {run ? <Markdown>{run.body}</Markdown> : <LiveWarnings groups={groups} />}
    </>
  );
}

function LiveWarnings({ groups }: { groups: SeverityGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-body text-muted">No open warnings. Nothing needs attention right now.</p>;
  }
  return (
    <div className="flex flex-col gap-[18px]">
      {groups.map(({ severity, rows }) => {
        const tone = SEVERITY[severity];
        return (
          <section key={severity} className="flex flex-col gap-2">
            <span className="flex items-center gap-2 px-0.5">
              <span className={`size-1.5 rounded-pill ${tone.dot}`} aria-hidden />
              <span className={`text-label font-semibold ${tone.text}`}>{tone.label}</span>
              <span className="text-meta tabular-nums text-muted">{rows.length}</span>
            </span>
            <ul className={listCls}>
              {rows.map(({ warning, project }) => (
                <li key={warning.id} className={rowCls}>
                  <Link href={`/projects/${project.slug}`} className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-pretty text-body font-medium tracking-[-0.003em] text-ink">
                      {warning.message}
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex-none text-meta text-ink-2">{project.name}</span>
                      {warning.suggestedAction && (
                        <>
                          <span className="text-grid">·</span>
                          <span className="min-w-0 truncate text-meta text-muted">{warning.suggestedAction}</span>
                        </>
                      )}
                    </span>
                  </Link>
                  <span className="flex-none text-meta tabular-nums text-muted">{compactAge(warning.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
