import type { TextareaHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--color-primary)]',
        props.className,
      )}
      {...props}
    />
  );
}

