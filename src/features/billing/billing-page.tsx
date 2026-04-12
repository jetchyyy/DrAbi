import { zodResolver } from '@hookform/resolvers/zod';
import { Coins, Pencil, Plus, Receipt, Search, Trash2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { getDatabase, createInvoice, deleteInvoiceRecord, listBookings, listInvoices, updateInvoiceRecord } from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';
import { formatCurrency } from '../../lib/utils';

const billingSchema = z.object({
  patientId: z.string().min(1, 'Patient is required.'),
  bookingId: z.string().optional(),
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  category: z.enum(['consultation', 'laboratory', 'medicine', 'other']),
  quantity: z.number().min(1, 'Quantity must be at least 1.'),
  unitPrice: z.number().min(1, 'Unit price must be at least 1.'),
});

type BillingFormValues = z.infer<typeof billingSchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

function PaymentBadge({ status }: { status: string }) {
  if (status === 'paid') return <span className="bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Paid</span>;
  if (status === 'partial') return <span className="bg-orange-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-700">Partial</span>;
  return <span className="bg-rose-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-rose-700">Unpaid</span>;
}

export function BillingPage() {
  const queryClient = useQueryClient();
  const database = getDatabase();
  const bookings = listBookings();
  const [search, setSearch] = useState('');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const deferredSearch = useDeferredValue(search);

  const { data: invoices = [] } = useQuery({
    queryKey: queryKeys.invoices,
    queryFn: async () => listInvoices(),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (values: BillingFormValues) => {
      const total = values.quantity * values.unitPrice;
      return createInvoice(
        { patientId: values.patientId, appointmentId: null, invoiceNumber: `INV-${Date.now()}`, paymentStatus: 'unpaid', subtotal: total, total },
        [{ description: values.description, quantity: values.quantity, unitPrice: values.unitPrice, category: values.category }],
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId, values }: { invoiceId: string; values: BillingFormValues }) => {
      const total = values.quantity * values.unitPrice;
      return updateInvoiceRecord(
        invoiceId,
        { patientId: values.patientId, appointmentId: null, invoiceNumber: invoices.find((invoice) => invoice.id === invoiceId)?.invoiceNumber ?? `INV-${Date.now()}`, paymentStatus: 'unpaid', subtotal: total, total },
        { description: values.description, quantity: values.quantity, unitPrice: values.unitPrice, category: values.category },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => deleteInvoiceRecord(invoiceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
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

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const patient = database.patients.find((item) => item.id === invoice.patientId);
        return `${invoice.invoiceNumber} ${patient?.firstName ?? ''} ${patient?.lastName ?? ''} ${invoice.paymentStatus}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase());
      }),
    [database.patients, deferredSearch, invoices],
  );

  useEffect(() => {
    if (!isInvoiceModalOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsInvoiceModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInvoiceModalOpen]);

  const openCreateModal = () => {
    form.reset({
      patientId: database.patients[0]?.id ?? '',
      bookingId: '',
      description: 'General Consultation',
      category: 'consultation',
      quantity: 1,
      unitPrice: 800,
    });
    setEditingInvoiceId(null);
    setIsInvoiceModalOpen(true);
  };

  const openEditModal = (invoiceId: string) => {
    const invoice = invoices.find((entry) => entry.id === invoiceId);
    const item = database.invoiceItems.find((entry) => entry.invoiceId === invoiceId);
    if (!invoice || !item) {
      return;
    }

    form.reset({
      patientId: invoice.patientId,
      bookingId: '',
      description: item.description,
      category: item.category,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    });
    setEditingInvoiceId(invoiceId);
    setIsInvoiceModalOpen(true);
  };

  const closeInvoiceModal = () => {
    setEditingInvoiceId(null);
    setIsInvoiceModalOpen(false);
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({
      ...currentState,
      open: false,
    }));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editingInvoiceId) {
        await updateInvoiceMutation.mutateAsync({ invoiceId: editingInvoiceId, values });
        setFeedbackModal({
          open: true,
          title: 'Invoice updated',
          message: 'The invoice details were updated successfully.',
          variant: 'success',
        });
      } else {
        await createInvoiceMutation.mutateAsync(values);
        setFeedbackModal({
          open: true,
          title: 'Invoice created',
          message: 'The invoice has been added successfully.',
          variant: 'success',
        });
      }

      closeInvoiceModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingInvoiceId ? 'Unable to update invoice' : 'Unable to create invoice',
        message: error instanceof Error ? error.message : 'Something went wrong while saving the invoice.',
        variant: 'error',
      });
    }
  });

  const handleDeleteInvoice = async (invoiceId: string) => {
    const isConfirmed = window.confirm('Delete this invoice from billing records?');
    if (!isConfirmed) {
      return;
    }

    try {
      await deleteInvoiceMutation.mutateAsync(invoiceId);
      setFeedbackModal({
        open: true,
        title: 'Invoice deleted',
        message: 'The invoice was removed successfully.',
        variant: 'success',
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: 'Unable to delete invoice',
        message: error instanceof Error ? error.message : 'Something went wrong while deleting the invoice.',
        variant: 'error',
      });
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-emerald-600 p-2.5 text-white">
                <Coins className="size-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-600">Billing</p>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Billing and Receipts</h1>
                <p className="mt-1 text-sm text-slate-500">Manage invoices in a table view and create new ones from a modal form.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link className="inline-flex items-center justify-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" to="/app/bookings/scan">
                <Receipt className="mr-2 size-4" />
                Scan booking receipt
              </Link>
              <Button className="rounded-none bg-emerald-600 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-emerald-700" onClick={openCreateModal}>
                <Plus className="mr-2 size-4" />
                New invoice
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search invoice, patient, or payment status"
                  value={search}
                />
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
            <span className="text-xs font-bold text-slate-500">{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found</span>
          </div>
        </div>

        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Invoice</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Patient</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Status</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Total</th>
                  <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12 text-center text-sm text-slate-400" colSpan={5}>
                      No invoices created yet.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => {
                    const patient = database.patients.find((item) => item.id === invoice.patientId);

                    return (
                      <tr className="transition-colors hover:bg-slate-50" key={invoice.id}>
                        <td className="px-6 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-950">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-slate-500">Invoice ID {invoice.id}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-slate-600">
                          {patient?.firstName} {patient?.lastName}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <PaymentBadge status={invoice.paymentStatus} />
                        </td>
                        <td className="px-6 py-4 align-top text-sm font-bold text-slate-950">{formatCurrency(invoice.total)}</td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                            <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditModal(invoice.id)} type="button">
                              <Pencil className="size-3.5" />
                              Edit
                            </button>
                            <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => void handleDeleteInvoice(invoice.id)} type="button">
                              <Trash2 className="size-3.5" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isInvoiceModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closeInvoiceModal}
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
                onClick={closeInvoiceModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient</p>
                  <FormField error={form.formState.errors.patientId?.message} label="Select patient">
                    <Select {...form.register('patientId')}>
                      {database.patients.map((patient) => (
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
                  {selectedBooking ? <p className="text-xs text-slate-500">Tagged booking amount: {formatCurrency(selectedBooking.feeAmount)}</p> : null}
                </div>

                <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Line Item</p>
                  <FormField error={form.formState.errors.description?.message} label="Description">
                    <Input {...form.register('description')} />
                  </FormField>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField error={form.formState.errors.category?.message} label="Category">
                      <Select {...form.register('category')}>
                        <option value="consultation">Consultation</option>
                        <option value="laboratory">Laboratory</option>
                        <option value="medicine">Medicine</option>
                        <option value="other">Other</option>
                      </Select>
                    </FormField>
                    <FormField error={form.formState.errors.quantity?.message} label="Qty">
                      <Input type="number" {...form.register('quantity', { valueAsNumber: true })} />
                    </FormField>
                    <FormField error={form.formState.errors.unitPrice?.message} label="Unit price">
                      <Input type="number" {...form.register('unitPrice', { valueAsNumber: true })} />
                    </FormField>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button className="w-full rounded-none sm:w-auto" onClick={closeInvoiceModal} type="button" variant="secondary">
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
      ) : null}

      <FeedbackModal
        autoCloseMs={3000}
        message={feedbackModal.message}
        onClose={closeFeedbackModal}
        open={feedbackModal.open}
        title={feedbackModal.title}
        variant={feedbackModal.variant}
      />
    </>
  );
}
