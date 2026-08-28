import { listWarnings } from "@workboard/core";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { InboxRow } from "@/components/inbox-row";
import { listCls } from "@/components/list";
import { PageTopBar, topBarGhostCls } from "@/components/page-top-bar";
import { PillGroup, type FilterOption } from "@/components/filter-controls";
import { resolveAllWarningsAction } from "@/lib/actions";
import { db } from "@/lib/db";
import { collectInbox, type InboxKind } from "@/lib/inbox";

export const dynamic = "force-dynamic";

/** The four ways to narrow the inbox — a tab covers one or more item kinds. */
const TABS: { key: string; label: string; kinds?: InboxKind[] }[] = [
  { key: "", label: "Everything" },
  { key: "question", label: "Questions", kinds: ["question"] },
  { key: "warning", label: "Warnings", kinds: ["critical", "warning", "info"] },
  { key: "update", label: "Updates", kinds: ["update"] },
];

/**
 * What is waiting on you. Workboard has no read state, so this is not a feed
 * of everything — it lists the three things that actually block an agent or
 * need a decision: an open question, an open warning, and a recent update.
 */
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind = "" } = await searchParams;
  const database = db();
  const items = collectInbox(database, Date.now());
  const openWarnings = listWarnings(database, {}).length;

  const tab = TABS.find((candidate) => candidate.key === kind) ?? TABS[0];
  const kinds = tab.kinds;
  const shown = kinds ? items.filter((item) => kinds.includes(item.kind)) : items;

  const count = items.length === 0 ? "Nothing needs you" : `${items.length} thing${items.length === 1 ? "" : "s"} need you`;

  const tabOptions: FilterOption[] = TABS.map((candidate) => ({
    key: candidate.key,
    href: `/inbox${candidate.key ? `?kind=${candidate.key}` : ""}`,
    label: candidate.label,
    active: candidate.key === tab.key,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <PageTopBar name="Inbox" count={count} action={<ResolveAllWarnings count={openWarnings} />} />

      <div className="flex flex-1 flex-col gap-3.5 px-5 pb-9 pt-[22px]">
        <div className="flex items-center gap-3.5">
          <PillGroup options={tabOptions} />
          <span className="ml-auto text-meta text-muted">Agent updates cover the last 24 hours</span>
        </div>

        {shown.length === 0 ? (
          <p className="text-body text-muted">Nothing is waiting on you. Agents are unblocked.</p>
        ) : (
          <ul className={listCls}>
            {shown.map((item) => (
              <InboxRow key={item.key} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Destructive and irreversible, so it confirms before it clears every open warning at once. */
function ResolveAllWarnings({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <form action={resolveAllWarningsAction}>
      <ConfirmSubmit message={`Resolve all ${count} open warning${count === 1 ? "" : "s"}?`} className={topBarGhostCls}>
        Resolve all warnings
      </ConfirmSubmit>
    </form>
  );
}
