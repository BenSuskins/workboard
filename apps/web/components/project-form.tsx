"use client";

import { useState } from "react";
import type { ProjectAccent } from "@workboard/core";
import { createProjectAction } from "@/lib/actions";
import { Field, fieldCls, primaryButtonCls } from "./form";
import { ACCENT_BG, ACCENT_TEXT, ACCENTS, PROJECT_PRIORITY_OPTIONS, tileAccent, tileGlyph } from "./labels";
import { PickerField } from "./picker-field";

/**
 * Creating a project. The title leads at full size with no box around it, the
 * way the project page will show it; the tile previews live, because the hue
 * otherwise derives from a name you are still typing.
 */
export function ProjectForm({ categories }: { categories: string[] }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [accent, setAccent] = useState("");

  const hue = tileAccent({ slug: name.trim() || "untitled project", accent: (accent || null) as ProjectAccent | null });
  const glyph = tileGlyph({ name: name.trim() || "Untitled project", icon: icon || null });

  return (
    <form action={createProjectAction} className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-control text-heading font-semibold ${ACCENT_BG[hue]} ${ACCENT_TEXT[hue]}`}
          aria-hidden
        >
          {glyph}
        </span>
        <input
          name="name"
          required
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Project name"
          aria-label="Project name"
          className="min-w-0 flex-1 bg-transparent py-1 text-display font-semibold tracking-tight text-ink outline-none placeholder:font-normal placeholder:text-muted"
        />
      </div>

      <textarea
        name="description"
        rows={4}
        placeholder="What is this project, and what does done look like? Markdown works here."
        aria-label="Description"
        className="w-full resize-y bg-transparent text-body leading-relaxed text-ink-2 outline-none placeholder:text-muted"
      />

      <div className="flex flex-col gap-5 border-t border-hairline pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <input name="category" defaultValue="coding" list="category-presets" className={fieldCls} />
            <datalist id="category-presets">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </Field>
          <Field label="Priority">
            <PickerField
              name="priority"
              defaultValue="medium"
              options={PROJECT_PRIORITY_OPTIONS}
              label="Priority"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-end gap-5">
          <Field label="Icon" hint="One emoji, or leave it blank">
            <input
              name="icon"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              maxLength={4}
              placeholder="🚀"
              className={`${fieldCls} w-16 text-center`}
            />
          </Field>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-meta font-medium text-ink-2">Tile colour</legend>
            <div className="flex flex-wrap items-center gap-2">
              <Swatch value="" active={accent === ""} label="From the name" onPick={setAccent} />
              {ACCENTS.map((option) => (
                <Swatch key={option} value={option} active={accent === option} label={option} onPick={setAccent} />
              ))}
            </div>
          </fieldset>
          <input type="hidden" name="accent" value={accent} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className={primaryButtonCls}>
          Create project
        </button>
        <span className="text-meta text-muted">You can change any of this later.</span>
      </div>
    </form>
  );
}

function Swatch({
  value,
  active,
  label,
  onPick,
}: {
  value: string;
  active: boolean;
  label: string;
  onPick: (value: string) => void;
}) {
  const hue = value as ProjectAccent;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      aria-pressed={active}
      aria-label={label}
      title={value ? label : "Derive the colour from the name"}
      className={`grid size-7 place-items-center rounded-full transition-transform hover:scale-110 ${
        value ? ACCENT_BG[hue] : "border border-hairline bg-surface-2"
      } ${active ? "ring-2 ring-accent ring-offset-2 ring-offset-page" : ""}`}
    >
      {value ? (
        <span className={`size-2.5 rounded-full ${ACCENT_TEXT[hue]} bg-current`} aria-hidden />
      ) : (
        <span className="text-[10px] font-medium text-muted" aria-hidden>
          A
        </span>
      )}
    </button>
  );
}
