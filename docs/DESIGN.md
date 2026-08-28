# DESIGN.md — the Workboard UI language

The look and feel the app commits to, in one page. Every value below is a named
token in `apps/web/app/globals.css`, and every token maps to a Tailwind utility
through `@theme inline`. **Reach for the utility, never the raw value.**
`text-[13.5px]` is the habit `globals.css` was written to end.

## Principle

**Quiet chrome, loud content.** Colour is a signal, never decoration. The
neutral ramp carries every word; hue appears only in status glyphs, priority
bars, and semantic callouts. Where the old UI reached for a boxed panel, this
one reaches for whitespace and a single hairline.

Three moves define the language:

1. **Depth is layered, not decorated.** `page`, `surface`, and `surface-2` do
   the work. Shadows are reserved for things that genuinely float. No shadow
   stacks, no wells, no gradients.
2. **Content columns, property rails.** Every detail view is a 680px reading
   column plus a rail of small key/value rows. Metadata lives in the rail.
3. **Editing happens in place.** Clicking text turns it into an input. No
   accordions, no modal forms, no "Edit" mode toggle.

## Surfaces and depth

| Layer | Utility | Role |
| --- | --- | --- |
| Page | `bg-page` | Board canvas, content pane background |
| Surface | `bg-surface` | Sidebar, cards, rails, top bar |
| Surface-2 | `bg-surface-2` | Inputs, hover fills, quiet badges |
| Hairline | `border-hairline` | Every default border and divider |
| Grid | `border-grid` | Hover border, dashed empty states |

- One border, one background. A card is `rounded-card border border-hairline bg-surface`.
- Hover raises the *background* (`bg-surface-2`) and the *border* (`border-grid`) — never the z-axis.
- Inputs sit one step *above* their container, never below. `bg-page` inside a
  card reads as a hole punched in it.
- Radii: `rounded-chip` (6px) for chips and icon buttons, `rounded-control` (7px)
  for buttons and rail rows, `rounded-card` (11px) for cards and composers,
  `rounded-pill` for avatars and bars.
- Shadows: `shadow-[0_1px_2px_rgba(0,0,0,0.3)]` on the primary button, and a
  lighter `0.12` on the two overview cards that must lift off a long column.
  Everything else is flat.

## Type

InterVariable, self-hosted, with `cv01`, `ss03` and `zero` on. Weights use the
variable axis: `font-medium` is 510 and `font-semibold` is 590, retuned in
`@theme` so the whole app moves together.

| Utility | Size | Use |
| --- | --- | --- |
| `text-micro` | 11px | Section labels, badges, avatar initials — not a reading step |
| `text-meta` | 12px | Timestamps, rail labels, authorship |
| `text-caption` | 12.5px | Card footers, progress legend, rail meta |
| `text-label` | 13px | Rail values, lane counts, top-bar tabs, buttons |
| `text-detail` | 13.5px | Card blurbs, list rows, feed bodies |
| `text-body` | 14px | Comments and thread bodies |
| `text-prose` | 14.5px | Descriptions, summaries, activity titles |
| `text-title` | 15px | Card titles |
| `text-heading` | 18px | Reserved for the few places 15px is not enough |
| `text-page` | 24px | Page and task titles |
| `text-display` | 28px | The home board's one hero line |

The half-step gradation between 12.5 and 14.5 is deliberate. It is what
separates a card blurb from a list row from a description without reaching for
a second weight or a second colour — which is how the old UI told them apart,
and why it read as flat.

Section headings are uppercase micro-labels (`MicroLabel` in
`components/detail-layout.tsx`), not 15px bold headings — the content is the
heading. Numbers are always `tabular-nums`.

## Iconography of state

One shared language, in `components/state-glyphs.tsx`. Every glyph is paired
with a word, a `title`, or adjacent text: none of them carries meaning on
colour alone.

- **`StatusRing`** — a 13px ring in the lane colour. Hollow while a task is only
  filed or queued, a 5px dot once work has started, a 7px filled centre for done.
- **`PriorityBars`** — three ascending bars (4 / 7.5 / 11px). Lit bars take
  `critical` / `serious` / `muted`; unlit bars are `grid`.
- **`LabelChip` and `TypeMark`** — a rounded square outlined in the label or
  post-type hue, then the word in `muted`. Hue identifies; the neutral ramp
  reads. Filling the square would put eight competing colours on one card.
- **`AgentMark`** — a 14px accent-tinted square marked `A`.

Avatars keep their per-author gradient — 18px (`xs`) on cards, 24px (`md`) in
feeds. The `ring-2` halo belongs to `AvatarStack` alone, the only place two
avatars overlap and need separating.

## Lane colours

`backlog` muted · `queued` accent · `moving` good · `blocked` critical ·
`done` ink-2. They live in one record, `TASK_LANE_TONE` in
`components/labels.ts`, carrying `text`, `dot` and `border` together so a ring
can never pick a different hue from the dot beside it. These drive the status
ring, the overview task rows, and the progress bar — nothing else.

## Layout patterns

**App shell** — a 240px sidebar on `bg-surface` with an inset right hairline;
the content pane on `bg-page`. Project routes add a 48px top bar carrying the
project → view breadcrumb, the view tabs as `rounded-chip` pills, Refresh, and
one primary action. Every other route draws itself in `pageContainerCls`.

**Board** — columns separated by 18px of whitespace, with no container of their
own: a bordered well holding bordered cards states the same boundary twice.
Cards are `minmax(296px, 1fr)` and stack as status ring + wrapping title +
right-hand priority cluster · two-line blurb · label row with the assignee
pushed right.

The **whole card** is the link to the task, not the title inside it. A card is
one target and a wrapped title is a poor one. The anchor sets `draggable=false`
so the gesture falls through to the `<article>` that owns the drag.

Moving a task on the board is **drag-only** — the card carries no lane control,
because a picker on every card is a control repeated once per task to change a
thing the columns already show. The keyboard route to the same `moveTaskAction`
is the Status row in the task detail rail.

**Detail views** — `DetailLayout` + `ReadingColumn` + the rail. The split is a
**container query, not a viewport one**, because the same view renders full-page
and inside the 672px slide-over: the rail sits beside the column above 948px and
stacks under it below.

Put `@container` and the `@[948px]:` classes it governs on **two elements**. An
element cannot query its own container, so `@[948px]:flex-row` beside
`@container` asks about the enclosing container and silently never matches —
while the descendants inside it match normally, which makes the failure look
like a styling accident rather than a query that never ran.

Stacked and beside are two designs, not one design squeezed. Stacked, the rail
is a footer at the column's measure with no fill; beside, it is the
surface-backed sidebar.

Title and description are click-to-edit — hover shows a
`bg-surface-2` fill and a hairline; editing swaps in a field with an accent
border and a 3px accent glow.

**Leaving the slide-over** takes a plain `<a>`, never `<Link>`. The panel is
already mounted at the URL it would navigate to, so a soft navigation re-enters
the intercepting route and appears to do nothing. Only a document load reaches
the real page.

**Rail rows** — a fixed label column, then the value, so the eye reads down one
edge rather than hunting across a form.

**Pickers, not native selects.** There is no `<select>` and no `<input
type="date">` anywhere in the app. Choosing a value opens a drawn panel
(`components/picker.tsx`, `components/date-picker.tsx`), because an OS menu
cannot be styled and breaks the surface language the moment it opens.

The cost is that the platform's keyboard and screen-reader behaviour has to be
rebuilt, so both follow the ARIA patterns exactly: the value picker is a
**listbox** — options carry `aria-selected` and the cursor rides
`aria-activedescendant` while focus stays on the list — and the calendar is a
**grid**, where arrows move a day, PageUp/Down a month, Home/End the week, and
Backspace clears. Both close on Escape and return focus to their trigger.

Panels are `position: fixed`, placed from the trigger's rect, because the rail
is a scroll container that would clip an absolutely positioned one. Scrolling
closes them rather than chasing the trigger.

Two mechanisms, one appearance: `filter-controls.tsx`'s `Dropdown` stays a
`<details>` of links, because a filter is a URL and its menu must work without
JavaScript. `Picker` sets a value and wears the same chrome. Inside an ordinary
server-rendered form, `PickerField` writes the chosen value to a hidden input,
so the form still posts to its server action with the same field name — only
the control changes, never the write.

**Activity** — an inline composer, then a day-grouped timeline. Group headers
are micro-labels with a hairline rule; entries are borderless rows that gain a
card on hover. The rail carries the pulse sparkline, type filters with counts,
and any open-question callout.

## Semantic callouts

A warning or a question is a single row: an 8% tint of the semantic colour, a
35% border of it, a 6px dot, the severity word, the message, and one quiet
action. Never a boxed panel led by an emoji — `⛔ ⚠️ ℹ️` read as decoration to
the eye and as "grimacing face" to a screen reader, and said nothing the word
beside them did not.

## Motion

120–130ms on `background`, `border-color` and `color`. **Nothing moves position
on hover.** Panels keep the existing 180ms `cubic-bezier(0.32, 0.72, 0, 1)`
slide-in, and both are disabled under `prefers-reduced-motion`.

## Contrast

Governed by the policy in [ARCHITECTURE.md](./ARCHITECTURE.md#key-decisions),
not restated here: the neutral ramp clears AAA, semantic and brand colour clear
AA as a hard floor, both measured against the lightest surface a tone actually
sits on. The one rule worth repeating because it is easy to get wrong: the dark
palette treats accent as a *light* hue, so any filled accent surface takes its
foreground from `text-on-accent`.

## What this language deliberately does without

- Stat strips as bordered grids. A progress bar and a legend say the same thing.
- Lane description blurbs. A column called Blocked needs no caption.
- `bg-surface-2` cards inside `bg-surface` containers — the double-nested grey.
- Emoji severity icons.
- `<details>` accordions standing in for a page. If a form needs room, give it a route.
- Native `<select>` and `<input type="date">`. See **Pickers, not native selects**.
