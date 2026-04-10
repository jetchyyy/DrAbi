import { zodResolver } from '@hookform/resolvers/zod';
import { Coins, Receipt } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { createInvoice, getDatabase, listBookings, listInvoices } from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';
import { formatCurrency } from '../../lib/utils';

const billingSchema = z.object({
  patientId: z.string().min(1),
  bookingId: z.string().optional(),
  description: z.string().min(2),
  category: z.enum(['consultation', 'laboratory', 'medicine', 'other']),
  quantity: z.number().min(1),
  unitPrice: z.number().min(1),
});

type BillingFormValues = z.infer<typeof billingSchema>;

function PaymentBadge({ status }: { status: string }) {
  if (status === 'paid') return <span className="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">Paid</span>;
  if (status === 'partial') return <span className="bg-orange-100 text-orange-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">Partial</span>;
  return <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">Unpaid</span>;
}

export function BillingPage() {
  const database = getDatabase();
  const bookings = listBookings();
  const { data: invoices = [] } = useQuery({
    queryKey: queryKeys.invoices,
    queryFn: async () => listInvoices(),
  });
  const mutation = useMutation({
    mutationFn: async (values: BillingFormValues) => {
      const total = values.quantity * values.unitPrice;
      return createInvoice(
        { patientId: values.patientId, appointmentId: null, invoiceNumber: `INV-${Date.now()}`, paymentStatus: 'unpaid', subtotal: total, total },
        [{ description: values.description, quantity: values.quantity, unitPrice: values.unitPrice, category: values.category }],
      );
    },
  });
  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      patientId: database.patients[0]?.id ?? '',
      bookingId: '',
      description: 'General Consultation',
      category: 'consultation',
      quantity: 1,
      unitPrice: 800,
    },
  });

  const selectedBookingId = form.watch('bookingId');
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) ?? null;

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    form.reset({ ...values, bookingId: '', description: '' });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      {/* Invoice list */}
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
          <div className="p-2 bg-emerald-600 text-white shrink-0">
            <Coins className="size-4" />
          </div>
          <div>
            <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Billing & Receipts</p>
            <p className="text-[11px] text-slate-400 font-medium">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} on record</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {invoices.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">No invoices created yet.</div>
          ) : (
            invoices.map((invoice) => {
              const patient = database.patients.find((item) => item.id === invoice.patientId);
              return (
                <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-slate-100 text-slate-500 shrink-0 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                      <Receipt className="size-4" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-950">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{patient?.firstName} {patient?.lastName}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4 shrink-0">
                    <PaymentBadge status={invoice.paymentStatus} />
                    <p className="font-extrabold text-slate-950">{formatCurrency(invoice.total)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create invoice form */}
      <div className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-emerald-600 px-6 py-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-100">New Invoice</p>
          <p className="text-sm font-bold text-white mt-0.5">Create Invoice</p>
          <Link className="mt-3 inline-flex text-xs font-semibold uppercase tracking-widest text-emerald-100 underline" to="/app/bookings/scan">
            Scan booking receipt
          </Link>
        </div>
        <form className="divide-y divide-slate-100" onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient</p>
            <FormField label="Select patient">
              <Select {...form.register('patientId')}>
                {database.patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>
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
                    return;
                  }

                  form.setValue('patientId', booking.patientId);
                  form.setValue('description', booking.feeType === 'follow_up' ? 'Follow-up Consultation' : 'Consultation Fee');
                  form.setValue('category', 'consultation');
                  form.setValue('quantity', 1);
                  form.setValue('unitPrice', booking.feeAmount);
                }}
              >
                <option value="">Manual entry</option>
                {bookings.map((booking) => {
                  const patient = database.patients.find((item) => item.id === booking.patientId);
                  return (
                    <option key={booking.id} value={booking.id}>
                      {patient?.firstName} {patient?.lastName} - {booking.feeType === 'follow_up' ? 'Follow-up' : 'Consultation'}
                    </option>
                  );
                })}
              </Select>
            </FormField>
            {selectedBooking ? (
              <p className="text-xs text-slate-500">
                Tagged booking amount: {formatCurrency(selectedBooking.feeAmount)}
              </p>
            ) : null}
          </div>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Line Item</p>
            <FormField label="Description"><Input {...form.register('description')} /></FormField>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Category">
                <Select {...form.register('category')}>
                  <option value="consultation">Consultation</option>
                  <option value="laboratory">Laboratory</option>
                  <option value="medicine">Medicine</option>
                  <option value="other">Other</option>
                </Select>
              </FormField>
              <FormField label="Qty"><Input type="number" {...form.register('quantity', { valueAsNumber: true })} /></FormField>
              <FormField label="Unit price"><Input type="number" {...form.register('unitPrice', { valueAsNumber: true })} /></FormField>
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50">
            <Button className="w-full rounded-none bg-emerald-600 hover:bg-emerald-700 font-extrabold uppercase tracking-widest text-sm py-5" disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Creating…' : 'Create Invoice'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
