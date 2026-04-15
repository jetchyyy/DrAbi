export function LabStatusPill({ status }: { status: string }) {
  if (status === 'released' || status === 'Completed' || status === 'completed')
    return <span className="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{status}</span>;
  if (status === 'ready' || status === 'Confirmed')
    return <span className="bg-sky-100 text-sky-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{status}</span>;
  if (status === 'processing' || status === 'in_progress')
    return <span className="bg-violet-100 text-violet-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{status}</span>;
  if (status === 'Cancelled' || status === 'cancelled')
    return <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{status}</span>;
  return <span className="bg-orange-100 text-orange-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{status}</span>;
}
