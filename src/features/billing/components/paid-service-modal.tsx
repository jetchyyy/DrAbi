import type { UseFormReturn } from 'react-hook-form';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FormField } from '../../../components/forms/form-field';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { formatCurrency } from '../../../lib/utils';
import type { LabServiceOption, PayForServiceFormValues } from '../types/forms';

interface PaidServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  payServiceForm: UseFormReturn<PayForServiceFormValues>;
  patients: Array<{ id: string; firstName: string; lastName: string }>;
  labServiceOptions: LabServiceOption[];
  selectedLabService: LabServiceOption | null;
  onSubmitPaidService: (data: PayForServiceFormValues) => void;
  payForServiceMutation: { isPending: boolean };
}

export function PaidServiceModal({
  isOpen,
  onClose,
  payServiceForm,
  patients,
  labServiceOptions,
  selectedLabService,
  onSubmitPaidService,
  payForServiceMutation,
}: PaidServiceModalProps) {
  if (!isOpen) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Paid Lab Service</p>
            <h2 className="mt-1 text-base font-bold text-slate-900">Pay for service</h2>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">Choose a patient and laboratory service. The system will use the live service fee, create the paid invoice, generate the lab request, and prepare a QR receipt.</p>
          </div>
          <button
            aria-label="Close paid service modal"
            className="inline-flex shrink-0 items-center justify-center border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={payServiceForm.handleSubmit(onSubmitPaidService)}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-4 px-4 py-5 sm:px-6">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient</p>
              <FormField error={payServiceForm.formState.errors.patientId?.message} label="Select patient">
                <Select {...payServiceForm.register('patientId')}>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.firstName} {patient.lastName}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Laboratory Service</p>
              <FormField error={payServiceForm.formState.errors.serviceId?.message} label="Lab service">
                <Select {...payServiceForm.register('serviceId')} disabled={labServiceOptions.length === 0}>
                  <option value="">Select a laboratory service</option>
                  {labServiceOptions.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {formatCurrency(service.serviceFee)}
                    </option>
                  ))}
                </Select>
              </FormField>

              {selectedLabService ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-950">{selectedLabService.name}</p>
                  <p className="mt-1">{selectedLabService.description ?? 'No service description available.'}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Category</p>
                      <p className="mt-1 font-semibold text-slate-950">{selectedLabService.category}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Declared fee</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatCurrency(selectedLabService.serviceFee)}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <FormField error={payServiceForm.formState.errors.notes?.message} label="Lab notes">
                <Textarea
                  placeholder="Optional intake or cashier notes for the laboratory team"
                  rows={3}
                  {...payServiceForm.register('notes')}
                />
              </FormField>

              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input className="accent-[var(--color-primary)]" type="checkbox" {...payServiceForm.register('urgentFlag')} />
                Mark as urgent
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Button className="w-full sm:w-auto" onClick={onClose} type="button" variant="tertiary">
              Cancel
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              disabled={payForServiceMutation.isPending || labServiceOptions.length === 0}
              type="submit"
            >
              {payForServiceMutation.isPending ? 'Processing payment...' : 'Pay and print receipt'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}