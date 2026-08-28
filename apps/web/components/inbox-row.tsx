import type { InboxItem, InboxKind } from "@/lib/inbox";
import { Avatar } from "./avatar";
import { rowCls } from "./list";
import { TimeAgo } from "./time-ago";
import Link from "next/link";

const KIND_LABEL: Record<InboxKind, string> = {
  question: "Question",
  critical: "Critical",
  warning: "Warning",
  info: "Info",
  update: "Update",
};

const KIND_HUE: Record<InboxKind, string> = {
  question: "text-serious",
  critical: "text-critical",
  warning: "text-warning",
  info: "text-accent",
  update: "text-accent",
};

/**
 * One inbox item as a row, the whole row a link. `display: contents` on the
 * link keeps the row's own flex layout on the `<li>` — the link adds no box of
 * its own, so it can fill the row without breaking `last:border-b-0`.
 */
export function InboxRow({ item }: { item: InboxItem }) {
  return (
    <li className={rowCls}>
      <Link href={item.href} className="contents">
        <span
          className={`mt-1 size-[11px] flex-none rounded-[3px] border-[1.25px] ${KIND_HUE[item.kind]}`}
          style={{ borderColor: "currentColor" }}
          aria-hidden
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-[9px]">
            <span className={`flex-none text-[11.5px] font-semibold ${KIND_HUE[item.kind]}`}>
              {KIND_LABEL[item.kind]}
            </span>
            <span className="min-w-0 truncate text-body font-medium tracking-[-0.003em] text-ink">{item.title}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex-none text-meta text-ink-2">{item.project.name}</span>
            <span className="text-grid">·</span>
            <span className="min-w-0 truncate text-meta text-muted">{item.blurb}</span>
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          {item.author && <Avatar author={item.author} size="sm" />}
          <span className="text-meta tabular-nums text-muted">
            <TimeAgo at={item.at} />
          </span>
        </div>
      </Link>
    </li>
  );
}
