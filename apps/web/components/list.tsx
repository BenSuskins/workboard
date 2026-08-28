/**
 * The bordered-list idiom every row list in the app already draws itself in
 * (`app/issues/page.tsx`, `components/task-list.tsx`, `app/prs/page.tsx`) —
 * named here so the issues list, the inbox, and the two report row lists share
 * one definition instead of four copies drifting apart.
 */
export const listCls = "overflow-hidden rounded-card border border-hairline bg-surface";
export const rowCls = "flex items-start gap-[11px] border-b border-hairline px-3.5 py-[11px] last:border-b-0";
