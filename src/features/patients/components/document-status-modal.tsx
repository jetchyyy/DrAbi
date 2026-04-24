import { CheckCircle2, Eye, FileText, Printer, X } from 'lucide-react';

import { Button } from '../../../components/ui/button';

interface DocumentStatusModalProps {
  open: boolean;
  title: string;
  message: string;
  eyebrowLabel?: string;
  onClose: () => void;
  onViewLatestFile: () => void;
  onPrint: () => void;
  onSavePdf: () => void;
  isViewingLatestFile: boolean;
  isPrinting: boolean;
  isSavingPdf: boolean;
}

export function DocumentStatusModal({
  open,
  title,
  message,
  eyebrowLabel = 'Document saved',
  onClose,
  onViewLatestFile,
  onPrint,
  onSavePdf,
  isViewingLatestFile,
  isPrinting,
  isSavingPdf,
}: DocumentStatusModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 bg-emerald-600 px-5 py-4 text-white">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-white/30 bg-white/10 p-2">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-white/85">{eyebrowLabel}</p>
              <p className="mt-1 text-sm font-bold">{title}</p>
            </div>
          </div>
          <button
            aria-label="Close document modal"
            className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <p className="text-sm leading-relaxed text-slate-600">{message}</p>

          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              className="gap-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
              disabled={isViewingLatestFile || isPrinting || isSavingPdf}
              onClick={onViewLatestFile}
              type="button"
              variant="secondary"
            >
              <Eye className="size-4" />
              {isViewingLatestFile ? 'Opening file...' : 'View latest file'}
            </Button>
            <Button
              className="gap-2 rounded-xl bg-slate-900 hover:bg-slate-800"
              disabled={isViewingLatestFile || isPrinting || isSavingPdf}
              onClick={onPrint}
              type="button"
            >
              <Printer className="size-4" />
              {isPrinting ? 'Opening printer...' : 'Print document'}
            </Button>
            <Button
              className="gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              disabled={isViewingLatestFile || isPrinting || isSavingPdf}
              onClick={onSavePdf}
              type="button"
              variant="secondary"
            >
              <FileText className="size-4" />
              {isSavingPdf ? 'Opening PDF dialog...' : 'Save as PDF'}
            </Button>
          </div>

          <div className="flex justify-end">
            <Button className="rounded-xl" onClick={onClose} type="button" variant="secondary">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
