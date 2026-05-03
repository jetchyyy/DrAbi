import { X, Receipt, Printer } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { formatCurrency } from '../../../lib/utils';
import { PaymentBadge } from '../payment-badge';
import type { Invoice } from '../../../types/domain';

interface InvoiceViewModalProps {
  invoiceViewState: { open: boolean; invoiceId: string | null };
  viewedInvoice: Invoice | null;
  viewedInvoicePatient: { firstName: string; lastName: string; email?: string; mobileNumber?: string } | null;
  viewedInvoiceItem: { description: string; category: string; quantity: number; unitPrice: number } | null;
  onClose: () => void;
  handleSaveViewedInvoiceAsPdf: () => void;
  handlePrintViewedInvoice: () => void;
}

export function InvoiceViewModal({
  invoiceViewState,
  viewedInvoice,
  viewedInvoicePatient,
  viewedInvoiceItem,
  onClose,
  handleSaveViewedInvoiceAsPdf,
  handlePrintViewedInvoice,
}: InvoiceViewModalProps) {
  if (!invoiceViewState.open || !viewedInvoice) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 bg-slate-900 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-300">Invoice Details</p>
            <p className="mt-0.5 text-sm font-bold text-white">{viewedInvoice.invoiceNumber}</p>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Review the invoice record, linked patient, line item, and totals from billing.</p>
          </div>
          <button
            aria-label="Close invoice details modal"
            className="inline-flex shrink-0 items-center justify-center border border-slate-500/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient</p>
              <p className="mt-2 text-base font-bold text-slate-950">
                {viewedInvoicePatient ? `${viewedInvoicePatient.firstName} ${viewedInvoicePatient.lastName}` : 'Unknown patient'}
              </p>
              <p className="mt-1 text-sm text-slate-500">{viewedInvoicePatient?.email || viewedInvoicePatient?.mobileNumber || 'No contact info recorded'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Payment Status</p>
              <div className="mt-2">
                <PaymentBadge status={viewedInvoice.paymentStatus} />
              </div>
              <p className="mt-3 text-sm text-slate-500">Created {new Date(viewedInvoice.createdAt).toLocaleString('en-PH')}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Invoice Id</p>
              <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-950">{viewedInvoice.id}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Appointment Id</p>
              <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-950">{viewedInvoice.appointmentId || 'Not linked'}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Line Item</p>
            {viewedInvoiceItem ? (
              <div className="mt-3 grid gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Description</p>
                  <p className="mt-1 font-semibold text-slate-950">{viewedInvoiceItem.description}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Category</p>
                  <p className="mt-1 font-semibold text-slate-950">{viewedInvoiceItem.category}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Quantity</p>
                  <p className="mt-1 font-semibold text-slate-950">{viewedInvoiceItem.quantity}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Unit Price</p>
                  <p className="mt-1 font-semibold text-slate-950">{formatCurrency(viewedInvoiceItem.unitPrice)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No invoice item was found for this record.</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Subtotal</p>
              <p className="mt-2 text-lg font-extrabold text-emerald-950">{formatCurrency(viewedInvoice.subtotal)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Total</p>
              <p className="mt-2 text-lg font-extrabold text-emerald-950">{formatCurrency(viewedInvoice.total)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button className="gap-2 rounded-none sm:w-auto" onClick={handleSaveViewedInvoiceAsPdf} type="button" variant="secondary">
            <Receipt className="size-4" />
            Save as PDF
          </Button>
          <Button className="gap-2 rounded-none sm:w-auto" onClick={handlePrintViewedInvoice} type="button">
            <Printer className="size-4" />
            Print receipt
          </Button>
          <Button className="rounded-none" onClick={onClose} type="button" variant="secondary">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}