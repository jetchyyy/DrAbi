import type { PropsWithChildren } from 'react';

import { cn } from '../../lib/utils';

interface BadgeProps {
  intent?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function Badge({ children, intent = 'neutral', className }: PropsWithChildren<BadgeProps>) {
  const intents = {
    neutral: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
    info: 'bg-orange-100 text-orange-700',
  };

  return (
    <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-medium', intents[intent], className)}>
      {children}
    </span>
  );
}

