import type { InputHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-100',
        props.className,
      )}
      {...props}
    />
  );
}
