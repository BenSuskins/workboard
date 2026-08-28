import Link from "next/link";
import type { Summary } from "@workboard/core";
import { listCls, rowCls } from "@/components/list";
import { Markdown } from "@/components/markdown";
import { MicroLabel } from "@/components/detail-layout";
import { authorLabel, fullDate } from "@/lib/format";
import { reportTitle, runDateParts } from "@/lib/reports";

/**
 * The digest reading column: the selected run's own prose, then every other
 * saved run as a plain list. The rail already carries the dates; this list
 * carries what each run actually said.
 */
export function DigestReport({ run, others }: { run: Summary; others: Summary[] }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <MicroLabel>{fullDate(run.createdAt)}</MicroLabel>
        <span className="text-grid">·</span>
        <span className="text-meta text-muted">{authorLabel(run.generatedBy)}</span>
      </div>

      <Markdown>{run.body}</Markdown>

      {others.length > 0 && (
        <>
          <div className="h-px bg-hairline" aria-hidden />
          <div className="flex flex-col gap-2">
            <MicroLabel className="px-0.5">Earlier</MicroLabel>
            <ul className={listCls}>
              {others.map((other) => (
                <li key={other.id} className={rowCls}>
                  <span className="w-24 flex-none text-meta tabular-nums text-muted">
                    {runDateParts(other.createdAt).date}
                  </span>
                  <Link href={`?run=${other.id}`} className="min-w-0 flex-1 truncate text-detail text-ink-2 hover:text-ink">
                    {reportTitle(other.body)}
                  </Link>
                  <span className="ml-auto flex-none text-meta text-muted">{authorLabel(other.generatedBy)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
