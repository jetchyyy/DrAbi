import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FormField } from '../../../components/forms/form-field';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';

interface PaymentUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentType: string, referenceNumber: string) => void;
  isLoading: boolean;
}

export function PaymentUpdateModal({ isOpen, onClose, onConfirm, isLoading }: PaymentUpdateModalProps) {
  const [paymentType, setPaymentType] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentType && (paymentType === 'cash' || referenceNumber.trim())) {
      onConfirm(paymentType, referenceNumber.trim());
      setPaymentType('');
      setReferenceNumber('');
    }
  };

  const handleClose = () => {
    setPaymentType('');
    setReferenceNumber('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
      onClick={handleClose}
      role="dialog"
    >
      <div
        className="my-auto flex w-full max-w-md flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 bg-emerald-600 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-100">Mark as Paid</p>
            <p className="mt-0.5 text-sm font-bold text-white">Update Payment Status</p>
            <p className="mt-2 max-w-2xl text-sm text-emerald-50">Record payment details to mark this invoice as paid.</p>
          </div>
          <button
            aria-label="Close payment update modal"
            className="inline-flex shrink-0 items-center justify-center border border-emerald-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={handleClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-4 px-4 py-5 sm:px-6">
              <FormField label="Payment Type">
                <Select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} required>
                  <option value="">Select payment type</option>
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </Select>
              </FormField>

              <FormField label="Reference Number">
                <Input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder={paymentType === 'cash' ? 'Optional for cash payments' : 'Enter payment reference number'}
                  required={paymentType !== 'cash'}
                />
              </FormField>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Button className="w-full rounded-none sm:w-auto" onClick={handleClose} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              className="w-full rounded-none bg-emerald-600 px-5 py-3 text-sm font-extrabold uppercase tracking-widest hover:bg-emerald-700 sm:w-auto"
              disabled={isLoading || !paymentType || (paymentType !== 'cash' && !referenceNumber.trim())}
              type="submit"
            >
              {isLoading ? 'Updating...' : 'Mark as Paid'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}