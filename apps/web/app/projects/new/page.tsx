import { CATEGORY_PRESETS, PROJECT_ACCENTS } from "@workboard/core";
import { createProjectAction } from "@/lib/actions";

const inputCls =
  "w-full rounded-control border border-hairline bg-page px-2.5 py-1.5 text-body text-ink placeholder:text-muted focus:border-accent focus:outline-none";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-[460px]">
      <h1 className="mb-4 text-heading font-semibold tracking-tight text-ink">New project</h1>
      <form action={createProjectAction} className="flex flex-col gap-3.5 rounded-card border border-hairline bg-surface p-[18px]">
        <label className="flex flex-col gap-1 text-meta text-muted">
          Name
          <input name="name" required placeholder="Payments v2 migration" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted">
          Description / goal (markdown)
          <textarea name="description" rows={4} placeholder="What is this project and what does done look like?" className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-meta text-muted">
            Category
            <input name="category" defaultValue="coding" list="category-presets" className={inputCls} />
            <datalist id="category-presets">
              {CATEGORY_PRESETS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-meta text-muted">
            Priority
            <select name="priority" defaultValue="medium" className={inputCls}>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-meta text-muted">
            Icon (emoji)
            <input name="icon" maxLength={4} placeholder="🚀" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-meta text-muted">
            Tile colour
            <select name="accent" defaultValue="" className={inputCls}>
              <option value="">from the name</option>
              {PROJECT_ACCENTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <button type="submit" className="rounded-control bg-accent px-4 py-2 text-body font-medium text-white hover:bg-accent-deep">
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}
