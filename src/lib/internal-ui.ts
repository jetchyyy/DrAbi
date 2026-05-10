import { cn } from "./utils";

/**
 * Shared visuals for authenticated /app surfaces: soft canvas, lifted cards,
 * calmer tables. Keeps Tailwind arbitrary values in one place.
 */
export const INTERNAL_SURFACE =
  "overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,41,71,0.04),0_8px_28px_-8px_rgba(15,41,71,0.09)]";

export const INTERNAL_SURFACE_PADDING = "rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,41,71,0.04),0_8px_28px_-8px_rgba(15,41,71,0.09)]";

export const INTERNAL_SURFACE_FOOTER =
  "border-t border-slate-100/90 bg-slate-50/90";

export const INTERNAL_SEARCH_INPUT_WRAP =
  "flex w-full min-w-[200px] max-w-md items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-[inset_0_1px_1px_rgba(15,41,71,0.04)]";

export const INTERNAL_TABLE_SCROLL = "overflow-x-auto";

export const INTERNAL_TABLE = "min-w-full border-collapse text-sm";

/** Table header stripe */
export const INTERNAL_THEAD_ROW =
  "border-b border-slate-200 bg-slate-100/80 [&>th]:font-semibold";

export const INTERNAL_TH =
  "px-5 py-3.5 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500 first:pl-6 last:pr-6";

export const INTERNAL_TR =
  "border-b border-slate-100 transition-colors hover:bg-slate-50/80 last:border-b-0";

export const INTERNAL_TD =
  "px-5 py-4 align-top text-slate-700 first:pl-6 last:pr-6";

/** Narrower gutters for dense operational tables (lab, receipts). */
export const INTERNAL_TH_COMPACT =
  "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500";

export const INTERNAL_TD_COMPACT = "px-4 py-2.5 align-top text-xs text-slate-700";

export const INTERNAL_TR_COMPACT =
  "border-b border-slate-100 transition-colors hover:bg-slate-50/80 last:border-b-0";

export const INTERNAL_BTN_PAGE =
  "min-w-[2.25rem] rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40";

export const INTERNAL_BTN_PAGE_ACTIVE =
  "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm hover:brightness-95";

export function internalSurface(className?: string) {
  return cn(INTERNAL_SURFACE, className);
}
