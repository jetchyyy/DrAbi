import type { LucideIcon } from 'lucide-react';

import { Card } from './card';

interface EmptyStateProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function EmptyState({ title, description, icon: Icon }: EmptyStateProps) {
  return (
    <Card className="border-dashed text-center">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-8">
        <div className="rounded-full bg-slate-100 p-4">
          <Icon className="size-5 text-slate-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </Card>
  );
}

