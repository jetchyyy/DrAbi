export function LabStatusPill({ status }: { status: string }) {
  const normalized = status.trim().toLowerCase();

  if (normalized === 'released' || normalized === 'completed') {
    return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">Completed</span>;
  }

  if (normalized === 'ready' || normalized === 'confirmed' || normalized === 'in_progress') {
    return <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700 ring-1 ring-sky-100">Confirmed</span>;
  }

  if (normalized === 'processing') {
    return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">Processing</span>;
  }

  if (normalized === 'cancelled') {
    return <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700 ring-1 ring-rose-100">Cancelled</span>;
  }

  return <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-orange-700 ring-1 ring-orange-100">Pending</span>;
}
