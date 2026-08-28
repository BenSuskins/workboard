import type { TaskLane } from "@workboard/core";
import { MicroLabel } from "./detail-layout";
import { TASK_LANE_LABEL, TASK_LANE_TONE } from "./labels";

/**
 * Where a project's work has got to, as one bar and a legend. It replaces a
 * five-cell bordered stat strip: the counts are the same, but a bar says
 * "mostly done" or "mostly waiting" before you have read a single number.
 *
 * Backlog is counted but not drawn — an unstarted task is the absence of
 * progress, and colouring it would make an empty project look busy.
 */
const DRAWN: TaskLane[] = ["done", "moving", "blocked", "queued"];

export function ProgressBlock({ counts }: { counts: Record<TaskLane, number> }) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const legend: TaskLane[] = ["moving", "queued", "blocked", "done", "backlog"];

  return (
    <div className="flex flex-col gap-2.5">
      <MicroLabel>Progress</MicroLabel>
      <div className="flex h-1.5 overflow-hidden rounded-pill bg-surface-2" aria-hidden>
        {total > 0 &&
          DRAWN.map((lane) =>
            counts[lane] > 0 ? (
              <span
                key={lane}
                className={TASK_LANE_TONE[lane].dot}
                style={{ width: `${(counts[lane] / total) * 100}%` }}
              />
            ) : null,
          )}
      </div>
      <div className="flex flex-col gap-1.5">
        {legend
          .filter((lane) => counts[lane] > 0)
          .map((lane) => (
            <div key={lane} className="flex items-center gap-2 text-caption">
              <span className={`size-[7px] flex-none rounded-pill ${TASK_LANE_TONE[lane].dot}`} aria-hidden />
              <span className="text-ink-2">{TASK_LANE_LABEL[lane]}</span>
              <span className={`ml-auto tabular-nums font-medium ${TASK_LANE_TONE[lane].text}`}>{counts[lane]}</span>
            </div>
          ))}
        {total === 0 && <span className="text-caption text-muted">No tasks yet.</span>}
      </div>
    </div>
  );
}
