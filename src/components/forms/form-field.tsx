import type { PropsWithChildren } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
}

export function FormField({ label, error, hint, children }: PropsWithChildren<FormFieldProps>) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

