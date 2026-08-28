"use client";

import { useTransition } from "react";
import type { Task, TaskLane } from "@workboard/core";
import { DatePicker } from "./date-picker";
import { TASK_LANE_LABEL, TASK_LANE_ORDER, TASK_LANE_TONE } from "./labels";
import { Picker, type PickerOption } from "./picker";
import { moveTaskAction, updateTaskDetailAction } from "@/lib/actions";
import { detailForm } from "@/lib/task-form";

/**
 * The rail's property pickers. Each one wraps the shared Picker and calls the
 * server action the rest of the app writes with — the panel is new, the write
 * path is not.
 */

const LANE_OPTIONS: PickerOption[] = TASK_LANE_ORDER.map((lane) => ({
  value: lane,
  label: TASK_LANE_LABEL[lane],
  dot: TASK_LANE_TONE[lane].dot,
}));

export function LanePicker({ taskId, slug, lane }: { taskId: number; slug: string; lane: TaskLane }) {
  const [, startTransition] = useTransition();
  return (
    <Picker
      label="Status"
      value={lane}
      options={LANE_OPTIONS}
      onSelect={(next) => {
        const form = new FormData();
        form.set("taskId", String(taskId));
        form.set("slug", slug);
        form.set("lane", next);
        startTransition(async () => {
          await moveTaskAction(form);
        });
      }}
    />
  );
}

const PRIORITY_OPTIONS: PickerOption[] = [
  { value: "", label: "No priority" },
  { value: "high", label: "High", dot: "bg-critical" },
  { value: "medium", label: "Medium", dot: "bg-serious" },
  { value: "low", label: "Low", dot: "bg-muted" },
];

export function PriorityPicker({ task, slug }: { task: Task; slug: string }) {
  const [, startTransition] = useTransition();
  return (
    <Picker
      label="Priority"
      value={task.priority ?? ""}
      options={PRIORITY_OPTIONS}
      placeholder="No priority"
      onSelect={(priority) => {
        startTransition(async () => {
          await updateTaskDetailAction(detailForm(task, { priority }, slug));
        });
      }}
    />
  );
}

export function DueDatePicker({ task, slug }: { task: Task; slug: string }) {
  const [, startTransition] = useTransition();
  return (
    <DatePicker
      label="Due date"
      value={task.dueDate ?? ""}
      tone="text-warning"
      onSelect={(dueDate) => {
        startTransition(async () => {
          await updateTaskDetailAction(detailForm(task, { dueDate }, slug));
        });
      }}
    />
  );
}
