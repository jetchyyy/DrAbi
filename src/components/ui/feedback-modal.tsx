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

  if (!open) {
    return null;
  }

  const isSuccess = variant === 'success';
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-md overflow-hidden border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`flex items-start justify-between gap-4 px-5 py-4 ${isSuccess ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <div className="flex items-start gap-3">
            <div className="border border-white/25 bg-white/10 p-2 text-white">
              <Icon className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-white/80">
                {isSuccess ? 'Action Successful' : 'Action Failed'}
              </p>
              <p className="mt-1 text-sm font-bold text-white">{title}</p>
            </div>
          </div>
          <button
            aria-label="Close feedback modal"
            className="inline-flex items-center justify-center border border-white/25 bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm leading-relaxed text-slate-600">{message}</p>
          <div className="flex justify-end">
            <Button
              className={isSuccess ? 'rounded-none bg-emerald-600 hover:bg-emerald-700' : 'rounded-none bg-rose-600 hover:bg-rose-700'}
              onClick={onClose}
              type="button"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
