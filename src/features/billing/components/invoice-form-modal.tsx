import type { UseFormReturn } from 'react-hook-form';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FormField } from '../../../components/forms/form-field';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { formatCurrency } from '../../../lib/utils';
import type { BillingFormValues } from '../types/forms';

interface InvoiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingInvoiceId: string | null;
  form: UseFormReturn<BillingFormValues>;
  patients: Array<{ id: string; firstName: string; lastName: string }>;
  bookings: Array<{ id: string; patientId: string; feeType: string; feeAmount: number; appointmentId?: string | null }>;
  appointments: Array<{ id: string; patientId: string; scheduledAt: string; status: string }>;
  onSubmit: (data: BillingFormValues) => void;
  createInvoiceMutation: { isPending: boolean };
  updateInvoiceMutation: { isPending: boolean };
  selectedBooking: { feeAmount: number } | null;
  itemsFieldArray: {
    fields: Array<{ id: string }>;
    append: (item: any) => void;
    remove: (index: number) => void;
  };
}

export function InvoiceFormModal({
  isOpen,
  onClose,
  editingInvoiceId,
  form,
  patients,
  bookings,
  appointments,
  onSubmit,
  createInvoiceMutation,
  updateInvoiceMutation,
  selectedBooking,
  itemsFieldArray,
}: InvoiceFormModalProps) {
  if (!isOpen) return null;

  const selectedPatientId = form.watch('patientId');
  const patientAppointments = appointments.filter((appt) => appt.patientId === selectedPatientId);

  const formatAppointmentTime = (scheduledAt: string) => {
    try {
      const date = new Date(scheduledAt);
      return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return scheduledAt;
    }
  };

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
        <div className="flex items-start justify-between gap-4 bg-emerald-600 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-100">Invoice Form</p>
            <p className="mt-0.5 text-sm font-bold text-white">{editingInvoiceId ? 'Edit Invoice' : 'Create Invoice'}</p>
            <p className="mt-2 max-w-2xl text-sm text-emerald-50">Create or update billing entries from this modal form.</p>
          </div>
          <button
            aria-label="Close invoice modal"
            className="inline-flex shrink-0 items-center justify-center border border-emerald-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-4 px-4 py-5 sm:px-6">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient</p>
              <FormField error={form.formState.errors.patientId?.message} label="Select patient">
                <Select {...form.register('patientId')}>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.firstName} {patient.lastName}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Tag from booking">
                <Select
                  {...form.register('bookingId')}
                  onChange={(event) => {
                    const booking = bookings.find((item) => item.id === event.target.value) ?? null;
                    form.setValue('bookingId', event.target.value);
                    if (!booking) {
                      form.setValue('items', [
                        {
                          description: 'General Consultation',
                          category: 'consultation',
                          quantity: 1,
                          unitPrice: 800,
                        },
                      ]);
                      return;
                    }

                    form.setValue('patientId', booking.patientId);
                    form.setValue('items', [
                      {
                        description: booking.feeType === 'follow_up' ? 'Follow-up Consultation' : 'Consultation Fee',
                        category: 'consultation',
                        quantity: 1,
                        unitPrice: booking.feeAmount,
                      },
                    ]);
                  }}
                >
                  <option value="">Manual entry</option>
                  {bookings.map((booking) => {
                    const patient = patients.find((item) => item.id === booking.patientId);
                    return (
                      <option key={booking.id} value={booking.id}>
                        {patient?.firstName} {patient?.lastName} - {booking.feeType === 'follow_up' ? 'Follow-up' : 'Consultation'}
                      </option>
                    );
                  })}
                </Select>
              </FormField>
              {selectedBooking ? <p className="text-xs text-slate-500">Tagged booking amount: {formatCurrency(selectedBooking.feeAmount)}</p> : null}
              
              <FormField label="Link to appointment (optional but recommended)">
                <Select {...form.register('appointmentId')}>
                  <option value="">Select an appointment</option>
                  {patientAppointments
                    .filter((appt) => !['cancelled', 'completed', 'no_show'].includes(appt.status))
                    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                    .map((appointment) => (
                      <option key={appointment.id} value={appointment.id}>
                        {formatAppointmentTime(appointment.scheduledAt)} - {appointment.status}
                      </option>
                    ))}
                </Select>
              </FormField>
              <p className="text-xs text-slate-500">Linking to an appointment ensures payment verification is tied to the specific session, preventing old invoices from authorizing access.</p>
            </div>

            <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Line items</p>
                  <p className="text-sm text-slate-500">Add one or more billing entries to match the printed invoice layout.</p>
                </div>
                <Button
                  className="rounded-none border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:bg-slate-100"
                  onClick={() =>
                    itemsFieldArray.append({
                      description: 'New service',
                      category: 'other',
                      quantity: 1,
                      unitPrice: 0,
                    })
                  }
                  type="button"
                  variant="secondary"
                >
                  Add line item
                </Button>
              </div>

              {itemsFieldArray.fields.map((field, index) => (
                <div key={field.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Item {index + 1}</p>
                    {itemsFieldArray.fields.length > 1 ? (
                      <button
                        className="text-xs font-semibold uppercase tracking-widest text-rose-600 hover:text-rose-700"
                        onClick={() => itemsFieldArray.remove(index)}
                        type="button"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <FormField
                      error={form.formState.errors.items?.[index]?.description?.message}
                      label="Description"
                    >
                      <Input {...form.register(`items.${index}.description` as const)} />
                    </FormField>
                    <FormField error={form.formState.errors.items?.[index]?.category?.message} label="Category">
                      <Select {...form.register(`items.${index}.category` as const)}>
                        <option value="consultation">Consultation</option>
                        <option value="laboratory">Laboratory</option>
                        <option value="medicine">Medicine</option>
                        <option value="other">Other</option>
                      </Select>
                    </FormField>
                    <FormField error={form.formState.errors.items?.[index]?.quantity?.message} label="Qty">
                      <Input type="number" {...form.register(`items.${index}.quantity` as const, { valueAsNumber: true })} />
                    </FormField>
                    <FormField error={form.formState.errors.items?.[index]?.unitPrice?.message} label="Unit price">
                      <Input type="number" {...form.register(`items.${index}.unitPrice` as const, { valueAsNumber: true })} />
                    </FormField>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    Amount: {formatCurrency((form.getValues(`items.${index}.quantity`) ?? 0) * (form.getValues(`items.${index}.unitPrice`) ?? 0))}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Button className="w-full rounded-none sm:w-auto" onClick={onClose} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              className="w-full rounded-none bg-emerald-600 px-5 py-3 text-sm font-extrabold uppercase tracking-widest hover:bg-emerald-700 sm:w-auto"
              disabled={createInvoiceMutation.isPending || updateInvoiceMutation.isPending}
              type="submit"
            >
              {createInvoiceMutation.isPending || updateInvoiceMutation.isPending
                ? 'Saving...'
                : editingInvoiceId
                  ? 'Save Invoice'
                  : 'Create Invoice'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}