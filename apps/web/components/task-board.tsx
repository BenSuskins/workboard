"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { TaskLane, TaskPriority } from "@workboard/core";
import { Avatar } from "./avatar";
import { TASK_LANE_LABEL, TASK_LANE_ORDER } from "./labels";
import { AgentMark, LabelChip, PriorityBars, StatusRing } from "./state-glyphs";
import { moveTaskAction } from "@/lib/actions";

/**
 * One task, flattened for the client. The lane is derived on the server by
 * `taskLane` and sent along, so this bundle never pulls the domain — and never
 * grows a second copy of the rules that decide which column a task belongs in.
 */
export interface BoardCard {
  id: number;
  /** `ENG-12` — computed on the server, where the project is already in hand. */
  identifier: string;
  title: string;
  /** `task.description` as plain text, clamped server-side to two lines' worth. */
  blurb: string;
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
 * The columns have no container of their own — 18px of whitespace separates
 * them, and the cards are the only thing drawn. A column that is a bordered
 * well holding bordered cards states the same boundary twice.
 *
 * Dragging is native HTML5 DnD rather than a library: the interaction is one
 * card into one of five drop zones with no reordering inside a column, which is
 * the case the browser already handles.
 *
 * Moving a task here is drag-only, by design: the card carries no lane control.
 * The keyboard route to the same `moveTaskAction` is the Status row in the task
 * detail rail — open a card and set it there. Anything added to this card later
 * must go through `move()` so the pointer and the keyboard cannot diverge.
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
    <div className="flex-1 overflow-x-auto bg-page px-5 pb-7 pt-[22px]">
      <div className="grid min-w-[1540px] grid-cols-[repeat(5,minmax(296px,1fr))] items-start gap-[18px]">
        {TASK_LANE_ORDER.map((lane) => {
          const laneCards = shown.filter((card) => card.lane === lane);
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
              className="flex min-w-0 flex-col gap-2.5"
            >
              <header className="flex items-center gap-[9px] px-1 pb-0.5">
                <h3 className="text-detail font-medium text-ink-2">{TASK_LANE_LABEL[lane]}</h3>
                <span className="text-label tabular-nums text-muted">{laneCards.length}</span>
                <Link
                  href={`/projects/${slug}/tasks/new?lane=${lane}`}
                  title={`Add a task to ${TASK_LANE_LABEL[lane]}`}
                  className="ml-auto grid size-6 place-items-center rounded-chip text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-ink"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                    <path d="M8 3.5v9M3.5 8h9" />
                  </svg>
                  <span className="sr-only">Add a task to {TASK_LANE_LABEL[lane]}</span>
                </Link>
              </header>

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
                />
              ))}

              {laneCards.length === 0 && (
                <p
                  className={`rounded-card border border-dashed px-1 py-[18px] text-center text-caption text-muted transition-colors ${
                    over === lane ? "border-accent bg-accent/5" : "border-hairline"
                  }`}
                >
                  Nothing here
                </p>
              )}
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
}: {
  card: BoardCard;
  slug: string;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const done = card.lane === "done";
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="cursor-grab rounded-card border border-hairline bg-surface transition-colors duration-[130ms] hover:border-grid hover:bg-surface-2 active:cursor-grabbing"
    >
      {/* The whole card opens the task, not just the title — a card is one
          target, and a 4px-tall word is a poor one. The anchor is not itself
          draggable, so the gesture falls through to the article rather than
          becoming the browser's drag-a-link. */}
      <Link
        href={`/projects/${slug}/tasks/${card.id}`}
        draggable={false}
        title={card.identifier}
        className="flex flex-col gap-2.5 px-4 pb-3.5 pt-[15px] [cursor:inherit]"
      >
        <span className="flex items-start gap-[9px]">
          <span className="mt-[3px] flex-none">
            <StatusRing lane={card.lane} />
          </span>
          <span
            className={`min-w-0 text-pretty break-words text-title font-medium leading-[1.35] tracking-[-0.005em] ${
              done ? "text-muted line-through" : "text-ink"
            }`}
          >
            {card.title}
          </span>
          <span className="ml-auto mt-0.5 flex flex-none items-center gap-2">
            {card.claimedBy && <AgentMark />}
            <PriorityBars priority={card.priority} />
          </span>
        </span>

        {card.blurb && <span className="line-clamp-2 text-pretty text-detail text-muted">{card.blurb}</span>}

        {(card.labels.length > 0 || card.dueDate || card.assignee || card.replies > 0) && (
          <span className="flex items-center gap-2 pt-px">
            {card.labels.map((label) => (
              <LabelChip key={label} label={label} />
            ))}
            {card.dueDate && <span className="flex-none text-caption text-warning">{card.dueDate}</span>}
            {card.replies > 0 && (
              <span className="flex-none text-caption text-muted">
                {card.replies} repl{card.replies === 1 ? "y" : "ies"}
              </span>
            )}
            {card.assignee && (
              <span className="ml-auto flex-none">
                <Avatar author={card.assignee} size="xs" />
              </span>
            )}
          </span>
        )}
      </Link>
    </article>
  );
}
