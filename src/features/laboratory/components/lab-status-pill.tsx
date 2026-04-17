export function LabStatusPill({ status }: { status: string }) {
  const normalized = status.trim().toLowerCase();

  if (normalized === 'released' || normalized === 'completed') {
    return <span className="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">Completed</span>;
  }

  if (normalized === 'ready' || normalized === 'confirmed' || normalized === 'in_progress') {
    return <span className="bg-sky-100 text-sky-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">Confirmed</span>;
  }

  if (normalized === 'processing') {
    return <span className="bg-violet-100 text-violet-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">Processing</span>;
  }

  if (normalized === 'cancelled') {
    return <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">Cancelled</span>;
  }

  return <span className="bg-orange-100 text-orange-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">Pending</span>;
}
