import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from './button';

interface FeedbackModalProps {
  open: boolean;
  title: string;
  message: string;
  variant?: 'success' | 'error';
  autoCloseMs?: number;
  onClose: () => void;
}

export function FeedbackModal({
  open,
  title,
  message,
  variant = 'success',
  autoCloseMs = 3000,
  onClose,
}: FeedbackModalProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, autoCloseMs);

    return () => window.clearTimeout(timeoutId);
  }, [autoCloseMs, onClose, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const isSuccess = variant === 'success';
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;
  const accentClasses = isSuccess
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-rose-200 bg-rose-50 text-rose-700';
  const titleClasses = isSuccess ? 'text-emerald-900' : 'text-rose-900';
  const buttonClasses = isSuccess
    ? 'rounded-lg border-emerald-200 bg-emerald-600 hover:bg-emerald-700'
    : 'rounded-lg border-rose-200 bg-rose-600 hover:bg-rose-700';
  const progressClasses = isSuccess ? 'bg-emerald-500' : 'bg-rose-500';

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-end p-4 sm:p-5"
      role="status"
    >
      <div
        className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-200/60"
      >
        <div className={`flex items-start justify-between gap-4 border-b px-4 py-3 ${accentClasses}`}>
          <div className="flex min-w-0 items-start gap-3">
            <div className={`rounded-lg border p-2 ${accentClasses}`}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-current/80">
                {isSuccess ? 'Action Successful' : 'Action Failed'}
              </p>
              <p className={`mt-1 text-sm font-bold ${titleClasses}`}>{title}</p>
            </div>
          </div>
          <button
            aria-label="Close feedback modal"
            className="inline-flex items-center justify-center rounded-lg border border-current/20 bg-white/70 p-2 text-current transition hover:bg-white"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <p className="text-sm leading-relaxed text-slate-600">{message}</p>
          <div className="flex justify-end">
            <Button
              className={buttonClasses}
              onClick={onClose}
              type="button"
            >
              Close
            </Button>
          </div>
        </div>
        <div className="h-1 w-full bg-slate-100">
          <div
            className={`h-full animate-[feedback-shrink_linear_forwards] ${progressClasses}`}
            style={{
              animationDuration: `${Math.max(autoCloseMs, 500)}ms`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
