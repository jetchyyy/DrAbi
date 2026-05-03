function PaymentBadge({ status }: { status: string }) {
  if (status === 'paid') return <span className="bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Paid</span>;
  if (status === 'partial') return <span className="bg-orange-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-700">Partial</span>;
  return <span className="bg-rose-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-rose-700">Unpaid</span>;
}

export { PaymentBadge };