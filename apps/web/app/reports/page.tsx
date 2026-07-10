import Link from "next/link";
import { listReports } from "@workboard/core";
import { Markdown } from "@/components/markdown";
import { db } from "@/lib/db";
import { authorLabel, fullDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const filter = kind === "digest" || kind === "triage" ? kind : undefined;
  const reports = listReports(db(), filter);

  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs ${
        active ? "border-accent bg-accent/15 text-accent" : "border-hairline text-ink-2 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Reports</h1>
        <div className="flex gap-1.5">
          {tab("/reports", "All", !filter)}
          {tab("/reports?kind=digest", "Digests", filter === "digest")}
          {tab("/reports?kind=triage", "Triage", filter === "triage")}
        </div>
      </div>
      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-grid px-6 py-16 text-center text-sm text-muted">
          No reports yet. Run the <code>workboard-digest</code> or <code>workboard-triage</code> skill from a coding agent to
          generate one.
        </div>
      ) : (
        reports.map((r) => (
          <article key={r.id} className="rounded-xl border border-hairline bg-surface p-5">
            <div className="mb-3 flex items-center gap-2 text-[11px] text-muted">
              <span
                className={`rounded-full border px-2 py-0.5 font-medium ${
                  r.kind === "digest" ? "border-accent/40 bg-accent/10 text-accent" : "border-warning/40 bg-warning/10 text-warning"
                }`}
              >
                {r.kind}
              </span>
              <span>{authorLabel(r.generatedBy)}</span>
              <span>· {fullDate(r.createdAt)}</span>
            </div>
            <Markdown>{r.body}</Markdown>
          </article>
        ))
      )}
    </div>
  );
}
