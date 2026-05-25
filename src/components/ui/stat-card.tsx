import type { LucideIcon } from 'lucide-react';

import { Card } from './card';

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <Card className="bg-white border-l-4 border-l-[var(--color-primary)] overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-600">{hint}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{background:'color-mix(in srgb, var(--color-primary) 14%, white)', color:'var(--color-primary)'}}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

