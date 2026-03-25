import type { InputHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-[var(--color-primary)]',
        props.className,
      )}
      {...props}
    />
  );
}

