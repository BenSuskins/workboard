"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { TaskLane, TaskPriority } from "@workboard/core";
import { Avatar } from "./avatar";
import { ACCENT_BG, ACCENT_TEXT, labelAccent, TASK_LANE_BLURB, TASK_LANE_LABEL, TASK_LANE_ORDER, TASK_LANE_TONE } from "./labels";
import { moveTaskAction } from "@/lib/actions";

/**
 * One task, flattened for the client. The lane is derived on the server by
 * `taskLane` and sent along, so this bundle never pulls the domain — and never
 * grows a second copy of the rules that decide which column a task belongs in.
 */
/** Same tones the task badges use, so a priority reads the same wherever it appears. */
const PRIORITY_TEXT: Record<NonNullable<TaskPriority>, string> = {
  high: "text-critical",
  medium: "text-serious",
  low: "text-muted",
};

export interface BoardCard {
  id: number;
  /** `ENG-12` — computed on the server, where the project is already in hand. */
  identifier: string;
  title: string;
  lane: TaskLane;
  priority: TaskPriority | null;
  assignee: string | null;
  labels: string[];
  claimedBy: string | null;
  dueDate: string | null;
  replies: number;
}

/**
 * The tasks board. Five columns, drag to move, click to open the task in the
 * slide-over the @panel route already provides.
 *
 * Dragging is native HTML5 DnD rather than a library: the interaction is one
 * card into one of five drop zones with no reordering inside a column, which is
 * the case the browser already handles. Every drop goes through the same
 * `moveTaskAction` as the per-card lane select, so the pointer path and the
 * keyboard path cannot drift.
 */
export function TaskBoard({ cards, slug }: { cards: BoardCard[]; slug: string }) {
  const [, startTransition] = useTransition();
  // The write is a server action behind a revalidate, so the card has to move
  // now and reconcile when the page data comes back.
  const [shown, moveCard] = useOptimistic(cards, (current: BoardCard[], moved: { id: number; lane: TaskLane }) =>
    current.map((card) => (card.id === moved.id ? { ...card, lane: moved.lane } : card)),
  );
  const [over, setOver] = useState<TaskLane | null>(null);
  const dragging = useRef<number | null>(null);

  const move = (id: number, lane: TaskLane) => {
    const card = shown.find((c) => c.id === id);
    if (!card || card.lane === lane) return;
    const form = new FormData();
    form.set("taskId", String(id));
    form.set("slug", slug);
    form.set("lane", lane);
    startTransition(async () => {
      moveCard({ id, lane });
      await moveTaskAction(form);
    });
  };

  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2">
      <div className="grid min-w-[58rem] grid-cols-5 gap-3">
        {TASK_LANE_ORDER.map((lane) => {
          const laneCards = shown.filter((card) => card.lane === lane);
          const tone = TASK_LANE_TONE[lane];
          return (
            <section
              key={lane}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(lane);
              }}
              onDragLeave={() => setOver((current) => (current === lane ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setOver(null);
                const id = Number(event.dataTransfer.getData("text/plain") || dragging.current);
                if (Number.isFinite(id)) move(id, lane);
              }}
              className={`flex min-w-0 flex-col rounded-card border bg-surface transition-colors ${
                over === lane ? "border-accent/60 bg-accent/5" : "border-hairline"
              }`}
            >
              <header className="flex flex-col gap-0.5 border-b border-hairline px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden />
                  <h3 className={`text-title font-semibold ${tone.text}`}>{TASK_LANE_LABEL[lane]}</h3>
                  <span className="ml-auto text-meta tabular-nums text-muted">{laneCards.length}</span>
                </div>
                <p className="pl-3.5 text-meta text-muted">{TASK_LANE_BLURB[lane]}</p>
              </header>

              <div className="flex min-h-[4.5rem] flex-1 flex-col gap-2 p-2">
                {laneCards.map((card) => (
                  <Card
                    key={card.id}
                    card={card}
                    slug={slug}
                    onDragStart={(event) => {
                      dragging.current = card.id;
                      event.dataTransfer.setData("text/plain", String(card.id));
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      dragging.current = null;
                      setOver(null);
                    }}
                    onPick={(next) => move(card.id, next)}
                  />
                ))}
                {laneCards.length === 0 && (
                  <p className="px-1 py-3 text-center text-meta text-muted">Nothing here.</p>
                )}
                <Link
                  href={`/projects/${slug}/tasks/new?lane=${lane}`}
                  className="rounded-control px-2 py-1.5 text-meta text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  + Add task
                </Link>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  card,
  slug,
  onDragStart,
  onDragEnd,
  onPick,
}: {
  card: BoardCard;
  slug: string;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  onPick: (lane: TaskLane) => void;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="group flex cursor-grab flex-col gap-1.5 rounded-control border border-hairline bg-surface-2 p-2.5 transition-colors hover:border-grid active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] tabular-nums text-muted">{card.identifier}</span>
        {card.assignee && (
          <span className="ml-auto">
            <Avatar author={card.assignee} size="sm" />
          </span>
        )}
      </div>

      <div className="flex items-start gap-2">
        <Link
          href={`/projects/${slug}/tasks/${card.id}`}
          className={`min-w-0 break-words text-body leading-snug hover:text-accent ${
            card.lane === "done" ? "text-muted line-through" : "text-ink"
          }`}
        >
          {card.title}
        </Link>
      </div>

      {card.labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {card.labels.map((label) => {
            const accent = labelAccent(label);
            return (
              <span
                key={label}
                className={`rounded-chip px-1.5 py-0.5 text-[10px] font-medium ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {(card.priority || card.claimedBy || card.dueDate || card.replies > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {card.priority && (
            <span className={`text-[10px] font-medium capitalize ${PRIORITY_TEXT[card.priority]}`}>{card.priority}</span>
          )}
          {card.claimedBy && (
            <span className="rounded-chip bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent" title="Claimed via the agent queue">
              {card.claimedBy}
            </span>
          )}
          {card.dueDate && <span className="text-[10px] text-warning">due {card.dueDate}</span>}
          {card.replies > 0 && (
            <span className="text-[10px] text-muted">
              {card.replies} repl{card.replies === 1 ? "y" : "ies"}
            </span>
          )}
        </div>
      )}

      {/* The keyboard's way to do what the drag does — same action, same rules. */}
      <label className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <span className="sr-only">Move “{card.title}” to another column</span>
        <select
          value={card.lane}
          onChange={(event) => onPick(event.target.value as TaskLane)}
          className="w-full cursor-pointer rounded-chip border border-hairline bg-surface px-1.5 py-0.5 text-[10px] text-ink-2 outline-none hover:border-grid focus:border-accent/60"
        >
          {TASK_LANE_ORDER.map((lane) => (
            <option key={lane} value={lane}>
              {TASK_LANE_LABEL[lane]}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}
