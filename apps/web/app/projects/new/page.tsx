import { CATEGORY_PRESETS } from "@workboard/core";
import { createProjectAction } from "@/lib/actions";

const inputCls =
  "w-full rounded-lg border border-hairline bg-page px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-[460px]">
      <h1 className="mb-4 text-lg font-semibold tracking-tight text-ink">New project</h1>
      <form action={createProjectAction} className="flex flex-col gap-3.5 rounded-[10px] border border-hairline bg-surface p-[18px]">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Name
          <input name="name" required placeholder="Payments v2 migration" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Description / goal (markdown)
          <textarea name="description" rows={4} placeholder="What is this project and what does done look like?" className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Category
            <input name="category" defaultValue="coding" list="category-presets" className={inputCls} />
            <datalist id="category-presets">
              {CATEGORY_PRESETS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Priority
            <select name="priority" defaultValue="medium" className={inputCls}>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </label>
        </div>
        <div>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-deep">
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}
