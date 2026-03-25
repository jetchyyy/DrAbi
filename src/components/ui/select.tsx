import type { SelectHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--color-primary)]',
        props.className,
      )}
      {...props}
    />
  );
}

