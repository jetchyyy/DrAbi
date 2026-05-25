import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  children,
  className,
  type = 'button',
  variant = 'primary',
  size = 'md',
  ...props
}: PropsWithChildren<ButtonProps>) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-[var(--color-primary)] text-white shadow-sm hover:brightness-95 active:brightness-90',
    secondary:
      'border border-[var(--color-primary)] bg-white text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_8%,white)]',
    tertiary:
      'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900',
    danger:
      'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800',
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-sm',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
