import Link from "next/link";
import type { Summary, TaskRow } from "@workboard/core";
import { listCls } from "@/components/list";
import { Markdown } from "@/components/markdown";
import { MicroLabel } from "@/components/detail-layout";
import { groupByWeek } from "@/lib/reports";

/**
 * What shipped, by week. No date, no author, no identifier on a row — the week
 * heading already says when, and this page is a glance back rather than a log
 * to audit.
 */
export function AccomplishmentsReport({ run, rows }: { run: Summary | undefined; rows: TaskRow[] }) {
  if (run) return <Markdown>{run.body}</Markdown>;

  const weeks = groupByWeek(rows, (row) => row.task.updatedAt);
  if (weeks.length === 0) {
    return <p className="text-body text-muted">Nothing shipped yet.</p>;
  }

  return (
    <>
      {weeks.map((week) => (
        <section key={week.label} className="flex flex-col gap-2">
          <span className="flex items-baseline gap-[9px] px-0.5">
            <MicroLabel>{week.label}</MicroLabel>
            <span className="text-meta tabular-nums text-muted">{week.items.length}</span>
          </span>
          <ul className={listCls}>
            {week.items.map(({ task, project }) => (
              <li key={task.id} className="flex items-baseline gap-3 border-b border-hairline px-3.5 py-[11px] last:border-b-0">
                <Link
                  href={`/projects/${project.slug}/tasks/${task.id}`}
                  className="min-w-0 flex-1 text-pretty text-body tracking-[-0.003em] text-ink hover:text-accent"
                >
                  {task.title}
                </Link>
                <span className="flex-none text-meta text-muted">{project.name}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
