import { zodResolver } from '@hookform/resolvers/zod';
import { Coins, Eye, Pencil, Plus, Printer, Receipt, ScanLine, Search, TestTube2, Trash2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import QRCode from 'qrcode';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useAuth } from '../auth/auth-context';
import { LabServiceReceiptCard } from '../laboratory/components/lab-service-receipt-card';
import { buildLabServiceReceiptLookupUrl } from '../laboratory/lab-service-receipt';
import { labRequestService } from '../lab-requests/api/lab-request-service';
import type { LabRequestRecord } from '../lab-requests/types';
import { getDatabase } from '../../lib/local-db';
import { printHtmlDocument } from '../../lib/print';
import { queryKeys } from '../../lib/query-keys';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  createInvoiceLiveOrDemo,
  deleteInvoiceLiveOrDemo,
  listBookingsLiveOrDemo,
  listInvoiceItemsLiveOrDemo,
  listInvoicesLiveOrDemo,
  listPatientsLiveOrDemo,
  updateInvoiceLiveOrDemo,
} from '../../lib/supabase-clinic';
import { formatCurrency } from '../../lib/utils';
import type { Invoice } from '../../types/domain';

const billingSchema = z.object({
  patientId: z.string().min(1, 'Patient is required.'),
  bookingId: z.string().optional(),
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  category: z.enum(['consultation', 'laboratory', 'medicine', 'other']),
  quantity: z.number().min(1, 'Quantity must be at least 1.'),
  unitPrice: z.number().min(1, 'Unit price must be at least 1.'),
});

type BillingFormValues = z.infer<typeof billingSchema>;

const payForServiceSchema = z.object({
  patientId: z.string().min(1, 'Patient is required.'),
  serviceId: z.string().min(1, 'Laboratory service is required.'),
  notes: z.string().optional(),
  urgentFlag: z.boolean(),
});

type PayForServiceFormValues = z.infer<typeof payForServiceSchema>;

interface LabServiceOption {
  id: string;
  clinicId: string | null;
  name: string;
  description: string | null;
  category: string;
  serviceFee: number;
}

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

interface LabReceiptState {
  open: boolean;
  invoice: Invoice | null;
  request: LabRequestRecord | null;
  patientName: string;
}

interface InvoiceViewState {
  open: boolean;
  invoiceId: string | null;
}

function PaymentBadge({ status }: { status: string }) {
  if (status === 'paid') return <span className="bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Paid</span>;
  if (status === 'partial') return <span className="bg-orange-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-700">Partial</span>;
  return <span className="bg-rose-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-rose-700">Unpaid</span>;
}

function buildInvoicePrintDocument(input: {
  invoice: Invoice;
  patientName: string;
  patientContact: string;
  itemDescription: string;
  itemCategory: string;
  quantity: number;
  unitPrice: number;
  qrSvgMarkup?: string;
  qrHelperText?: string;
}) {
  const createdAt = new Date(input.invoice.createdAt);
  const paymentStatusLabel = input.invoice.paymentStatus.toUpperCase();
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Service Payment Receipt</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 28px;
        background: #f8fafc;
        color: #1f2937;
      }
      .sheet {
        max-width: 760px;
        margin: 0 auto;
        background: #ffffff;
        padding: 30px 44px 34px;
      }
      .clinic-name {
        margin: 0;
        color: #2563eb;
        font-size: 20px;
        font-weight: 700;
        text-align: center;
      }
      h1 {
        margin: 8px 0 0;
        font-size: 17px;
        font-weight: 800;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.01em;
      }
      p {
        margin: 0;
        line-height: 1.5;
      }
      .divider {
        margin: 22px 0 30px;
        border: 0;
        border-top: 2px solid #374151;
      }
      .meta {
        display: grid;
        grid-template-columns: 180px minmax(0, 1fr);
        row-gap: 8px;
        gap: 16px;
        align-items: start;
      }
      .meta-label {
        font-size: 14px;
        font-weight: 700;
        color: #374151;
      }
      .meta-value {
        font-size: 14px;
        color: #111827;
        text-align: right;
        word-break: break-word;
      }
      .code {
        font-family: "Courier New", monospace;
      }
      .status-paid {
        color: #059669;
        font-weight: 800;
      }
      .status-unpaid {
        color: #dc2626;
        font-weight: 800;
      }
      .status-partial {
        color: #d97706;
        font-weight: 800;
      }
      .section-title {
        margin-top: 30px;
        font-size: 15px;
        font-weight: 700;
        color: #1f2937;
      }
      .section-rule {
        margin: 10px 0 14px;
        border: 0;
        border-top: 1px solid #d1d5db;
      }
      .service-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 110px 120px auto;
        gap: 16px;
        align-items: center;
        font-size: 14px;
        color: #111827;
      }
      .service-row.header {
        color: #6b7280;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .service-row + .service-row {
        margin-top: 10px;
      }
      .service-amount {
        text-align: right;
        font-weight: 800;
      }
      .service-centered {
        text-align: center;
      }
      .total-box {
        margin-top: 26px;
        border-left: 4px solid #2563eb;
        padding: 11px 14px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 16px;
        align-items: center;
      }
      .total-label {
        font-size: 16px;
        font-weight: 800;
        color: #1f2937;
      }
      .total-value {
        font-size: 16px;
        font-weight: 800;
        color: #059669;
      }
      .qr-panel {
        margin-top: 26px;
        border: 1px dashed #d1d5db;
        border-radius: 10px;
        padding: 18px 18px 14px;
        text-align: center;
      }
      .qr-title {
        font-size: 14px;
        font-weight: 700;
        color: #1f2937;
      }
      .qr-wrap {
        margin-top: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 158px;
      }
      .qr-wrap svg {
        width: 150px;
        height: 150px;
      }
      .qr-note {
        margin-top: 10px;
        font-size: 11px;
        color: #6b7280;
      }
      .footnote {
        margin-top: 20px;
        border-left: 4px solid #f59e0b;
        padding-left: 12px;
      }
      .footnote-title {
        font-size: 14px;
        font-weight: 800;
        color: #1f2937;
      }
      .footnote p:last-child {
        margin-top: 8px;
        color: #475569;
        font-size: 14px;
      }
      @media print {
        body {
          background: #ffffff;
          padding: 0;
        }
        .sheet {
          border: none;
          border-radius: 0;
          max-width: none;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <p class="clinic-name">Odyssey Clinic</p>
      <h1>Service Payment Receipt</h1>

      <hr class="divider" />

      <section class="meta">
        <p class="meta-label">Patient:</p>
        <p class="meta-value">${input.patientName}</p>

        <p class="meta-label">Contact:</p>
        <p class="meta-value">${input.patientContact || 'No contact info recorded'}</p>

        <p class="meta-label">Date:</p>
        <p class="meta-value">${createdAt.toLocaleDateString('en-PH')}</p>

        <p class="meta-label">Time:</p>
        <p class="meta-value">${createdAt.toLocaleTimeString('en-PH')}</p>

        <p class="meta-label">Status:</p>
        <p class="meta-value ${
          input.invoice.paymentStatus === 'paid'
            ? 'status-paid'
            : input.invoice.paymentStatus === 'partial'
              ? 'status-partial'
              : 'status-unpaid'
        }">${paymentStatusLabel}</p>

        <p class="meta-label">Invoice No.:</p>
        <p class="meta-value code">${input.invoice.invoiceNumber}</p>
      </section>

      <section>
        <p class="section-title">Services Paid:</p>
        <hr class="section-rule" />
        <div class="service-row header">
          <p>Description</p>
          <p class="service-centered">Category</p>
          <p class="service-centered">Qty x Rate</p>
          <p class="service-amount">Amount</p>
        </div>
        <div class="service-row">
          <p>${input.itemDescription}</p>
          <p class="service-centered">${input.itemCategory}</p>
          <p class="service-centered">${input.quantity} x ${formatCurrency(input.unitPrice)}</p>
          <p class="service-amount">${formatCurrency(input.invoice.total)}</p>
        </div>
      </section>

      <section class="total-box">
        <p class="total-label">Total Amount:</p>
        <p class="total-value">${formatCurrency(input.invoice.total)}</p>
      </section>

      ${
        input.qrSvgMarkup
          ? `<section class="qr-panel">
        <p class="qr-title">Payment Verification QR Code</p>
        <div class="qr-wrap">${input.qrSvgMarkup}</div>
        <p class="qr-note">${input.qrHelperText ?? 'Present this QR code for staff scanning.'}</p>
      </section>`
          : ''
      }

      <section class="footnote">
        <p class="footnote-title">${input.qrSvgMarkup ? 'Important Instructions:' : 'Billing Note:'}</p>
        <p>${
          input.qrSvgMarkup
            ? 'Present this receipt to the clinic or laboratory staff and let them scan the QR code before proceeding with the test.'
            : 'This receipt reflects the recorded billing line item and payment status saved in the system.'
        }</p>
      </section>
    </main>
  </body>
</html>`;
}

export function BillingPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPayServiceModalOpen, setIsPayServiceModalOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const [labReceiptState, setLabReceiptState] = useState<LabReceiptState>({
    open: false,
    invoice: null,
    request: null,
    patientName: '',
  });
  const [invoiceViewState, setInvoiceViewState] = useState<InvoiceViewState>({
    open: false,
    invoiceId: null,
  });
  const deferredSearch = useDeferredValue(search);

  const { data: patients = [] } = useQuery({
    queryKey: queryKeys.patients,
    queryFn: async () => listPatientsLiveOrDemo(),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: queryKeys.bookings,
    queryFn: async () => listBookingsLiveOrDemo(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: queryKeys.invoices,
    queryFn: async () => listInvoicesLiveOrDemo(),
  });

  const { data: invoiceItems = [] } = useQuery({
    queryKey: queryKeys.invoiceItems,
    queryFn: async () => listInvoiceItemsLiveOrDemo(),
  });

  const { data: labServiceOptions = [] } = useQuery({
    queryKey: ['lab-request-services'],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) {
        return getDatabase().labServices
          .slice()
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((service) => ({
            id: service.id,
            clinicId: null,
            name: service.name,
            description: service.description,
            category: service.category,
            serviceFee: service.price,
          })) satisfies LabServiceOption[];
      }

      const { data, error } = await supabase
        .from('medical_services')
        .select('id, clinic_id, name, description, category, service_fee')
        .eq('department', 'Laboratory')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as Array<{
        id: string;
        clinic_id: string | null;
        name: string;
        description: string | null;
        category: string;
        service_fee: number;
      }>).map((service) => ({
        id: service.id,
        clinicId: service.clinic_id,
        name: service.name,
        description: service.description,
        category: service.category,
        serviceFee: Number(service.service_fee ?? 0),
      }));
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (values: BillingFormValues) => {
      const total = values.quantity * values.unitPrice;
      const taggedBooking = bookings.find((booking) => booking.id === values.bookingId) ?? null;
      return createInvoiceLiveOrDemo(
        {
          patientId: values.patientId,
          appointmentId: taggedBooking?.appointmentId ?? null,
          invoiceNumber: `INV-${Date.now()}`,
          paymentStatus: 'unpaid',
          subtotal: total,
          total,
        },
        [{ description: values.description, quantity: values.quantity, unitPrice: values.unitPrice, category: values.category }],
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId, values }: { invoiceId: string; values: BillingFormValues }) => {
      const total = values.quantity * values.unitPrice;
      const taggedBooking = bookings.find((booking) => booking.id === values.bookingId) ?? null;
      return updateInvoiceLiveOrDemo(
        invoiceId,
        {
          patientId: values.patientId,
          appointmentId: taggedBooking?.appointmentId ?? null,
          invoiceNumber: invoices.find((invoice) => invoice.id === invoiceId)?.invoiceNumber ?? `INV-${Date.now()}`,
          paymentStatus: 'unpaid',
          subtotal: total,
          total,
        },
        { description: values.description, quantity: values.quantity, unitPrice: values.unitPrice, category: values.category },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => deleteInvoiceLiveOrDemo(invoiceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
    },
  });

  const payForServiceMutation = useMutation({
    mutationFn: async (values: PayForServiceFormValues) => {
      if (!profile?.id) {
        throw new Error('You must be signed in to record a paid lab service.');
      }

      const selectedService = labServiceOptions.find((service) => service.id === values.serviceId) ?? null;
      if (!selectedService) {
        throw new Error('The selected laboratory service could not be found.');
      }

      const amount = Number(selectedService.serviceFee ?? 0);
      if (amount <= 0) {
        throw new Error('The selected laboratory service does not have a valid service fee yet.');
      }

      const patient = patients.find((entry) => entry.id === values.patientId) ?? null;
      let createdInvoice: Invoice | null = null;

      try {
        createdInvoice = await createInvoiceLiveOrDemo(
          {
            patientId: values.patientId,
            appointmentId: null,
            invoiceNumber: `INV-LAB-${Date.now()}`,
            paymentStatus: 'paid',
            subtotal: amount,
            total: amount,
          },
          [
            {
              description: selectedService.name,
              quantity: 1,
              unitPrice: amount,
              category: 'laboratory',
            },
          ],
        );

        let request: LabRequestRecord;
        if (!isSupabaseConfigured || !supabase) {
          const { createLabOrder } = await import('../../lib/local-db');
          const order = createLabOrder({
            patientId: values.patientId,
            appointmentId: null,
            labServiceId: selectedService.id,
            requestedBy: profile.id,
            status: 'requested',
            notes: values.notes?.trim() || '',
            urgentFlag: values.urgentFlag,
            schedDate: null,
            schedTime: null,
          });

          request = {
            id: order.id,
            clinicId: '',
            clinicName: null,
            appointmentId: null,
            patientId: values.patientId,
            patientName: patient ? `${patient.firstName} ${patient.lastName}` : null,
            requestedBy: profile.id,
            requestedByName: profile.fullName,
            serviceId: selectedService.id,
            serviceName: selectedService.name,
            serviceCategory: selectedService.category,
            department: 'Laboratory',
            transactionType: 'cashier_paid_service',
            status: 'pending',
            sampleStatus: 'pending',
            resultStatus: 'pending',
            patientNotes: values.notes?.trim() || null,
            resultData: null,
            resultNotes: null,
            urgentFlag: values.urgentFlag,
            completedBy: null,
            completedByName: null,
            completedAt: null,
            media: [],
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
          };
        } else {
          const createdRequest = await labRequestService.createRequest({
            clinicId: selectedService.clinicId,
            patientId: values.patientId,
            requestedBy: profile.id,
            appointmentId: null,
            serviceId: selectedService.id,
            serviceCategory: selectedService.category,
            patientNotes: values.notes?.trim() || '',
            urgentFlag: values.urgentFlag,
            transactionType: 'cashier_paid_service',
          });

          if (!createdRequest) {
            throw new Error('The lab request was not returned after payment.');
          }

          request = createdRequest;
        }

        return {
          invoice: createdInvoice,
          request,
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Patient',
        };
      } catch (error) {
        if (createdInvoice) {
          await deleteInvoiceLiveOrDemo(createdInvoice.id).catch(() => undefined);
        }
        throw error;
      }
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
      await queryClient.invalidateQueries({ queryKey: ['lab-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['lab-request', result.request.id] });
      setLabReceiptState({
        open: true,
        invoice: result.invoice,
        request: result.request,
        patientName: result.patientName,
      });
    },
  });

  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      patientId: patients[0]?.id ?? '',
      bookingId: '',
      description: 'General Consultation',
      category: 'consultation',
      quantity: 1,
      unitPrice: 800,
    },
  });

  const payServiceForm = useForm<PayForServiceFormValues>({
    resolver: zodResolver(payForServiceSchema),
    defaultValues: {
      patientId: patients[0]?.id ?? '',
      serviceId: '',
      notes: '',
      urgentFlag: false,
    },
  });

  const selectedBookingId = form.watch('bookingId');
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) ?? null;
  const selectedLabServiceId = payServiceForm.watch('serviceId');
  const selectedLabService = labServiceOptions.find((service) => service.id === selectedLabServiceId) ?? null;

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const patient = patients.find((item) => item.id === invoice.patientId);
        return `${invoice.invoiceNumber} ${patient?.firstName ?? ''} ${patient?.lastName ?? ''} ${invoice.paymentStatus}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase());
      }),
    [deferredSearch, invoices, patients],
  );
  const viewedInvoice = invoices.find((invoice) => invoice.id === invoiceViewState.invoiceId) ?? null;
  const viewedInvoiceItem = invoiceItems.find((item) => item.invoiceId === invoiceViewState.invoiceId) ?? null;
  const viewedInvoicePatient = patients.find((patient) => patient.id === viewedInvoice?.patientId) ?? null;

  useEffect(() => {
    if (form.getValues('patientId') || patients.length === 0) {
      return;
    }

    form.setValue('patientId', patients[0]?.id ?? '');
  }, [form, patients]);

  useEffect(() => {
    if (payServiceForm.getValues('patientId') || patients.length === 0) {
      return;
    }

    payServiceForm.setValue('patientId', patients[0]?.id ?? '');
  }, [patients, payServiceForm]);

  useEffect(() => {
    if (payServiceForm.getValues('serviceId') || labServiceOptions.length === 0) {
      return;
    }

    payServiceForm.setValue('serviceId', labServiceOptions[0]?.id ?? '');
  }, [labServiceOptions, payServiceForm]);

  useEffect(() => {
    if (!isInvoiceModalOpen && !isPayServiceModalOpen && !invoiceViewState.open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsInvoiceModalOpen(false);
        setIsPayServiceModalOpen(false);
        setInvoiceViewState({
          open: false,
          invoiceId: null,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [invoiceViewState.open, isInvoiceModalOpen, isPayServiceModalOpen]);

  const openCreateModal = () => {
    form.reset({
      patientId: patients[0]?.id ?? '',
      bookingId: '',
      description: 'General Consultation',
      category: 'consultation',
      quantity: 1,
      unitPrice: 800,
    });
    setEditingInvoiceId(null);
    setIsInvoiceModalOpen(true);
  };

  const openPayForServiceModal = () => {
    payServiceForm.reset({
      patientId: patients[0]?.id ?? '',
      serviceId: labServiceOptions[0]?.id ?? '',
      notes: '',
      urgentFlag: false,
    });
    setIsPayServiceModalOpen(true);
  };

  const openEditModal = (invoiceId: string) => {
    const invoice = invoices.find((entry) => entry.id === invoiceId);
    const item = invoiceItems.find((entry) => entry.invoiceId === invoiceId);
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

  const openViewModal = (invoiceId: string) => {
    setInvoiceViewState({
      open: true,
      invoiceId,
    });
  };

  const closeInvoiceModal = () => {
    setEditingInvoiceId(null);
    setIsInvoiceModalOpen(false);
  };

  const closePayForServiceModal = () => {
    setIsPayServiceModalOpen(false);
  };

  const closeInvoiceViewModal = () => {
    setInvoiceViewState({
      open: false,
      invoiceId: null,
    });
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({
      ...currentState,
      open: false,
    }));
  };

  const closeLabReceiptModal = () => {
    setLabReceiptState({
      open: false,
      invoice: null,
      request: null,
      patientName: '',
    });
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

  const onSubmitPaidService = payServiceForm.handleSubmit(async (values) => {
    try {
      await payForServiceMutation.mutateAsync(values);
      setFeedbackModal({
        open: true,
        title: 'Lab service paid',
        message: 'Payment was recorded, the lab request was created, and the receipt is ready to print.',
        variant: 'success',
      });
      closePayForServiceModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: 'Unable to pay for service',
        message: error instanceof Error ? error.message : 'Something went wrong while recording the paid laboratory service.',
        variant: 'error',
      });
    }
  });

  const handleOpenInvoiceOutput = async () => {
    if (!viewedInvoice) {
      toast.error('No invoice is selected for printing.');
      return;
    }

    let relatedRequest: LabRequestRecord | null = null;

    if (viewedInvoice.paymentStatus === 'paid' && viewedInvoiceItem?.category === 'laboratory') {
      try {
        if (!isSupabaseConfigured || !supabase) {
          const database = getDatabase();
          const matchedService = database.labServices.find((service) => service.name === viewedInvoiceItem.description) ?? null;
          const matchingOrders = database.labOrders
            .filter((order) => order.patientId === viewedInvoice.patientId)
            .filter((order) => (matchedService ? order.labServiceId === matchedService.id : true))
            .sort(
              (left, right) =>
                Math.abs(new Date(left.createdAt).getTime() - new Date(viewedInvoice.createdAt).getTime()) -
                Math.abs(new Date(right.createdAt).getTime() - new Date(viewedInvoice.createdAt).getTime()),
            );

          const order = matchingOrders[0] ?? null;
          if (order) {
            const service = database.labServices.find((entry) => entry.id === order.labServiceId) ?? null;
            relatedRequest = {
              id: order.id,
              clinicId: '',
              clinicName: null,
              appointmentId: order.appointmentId ?? null,
              patientId: order.patientId,
              patientName: viewedInvoicePatient ? `${viewedInvoicePatient.firstName} ${viewedInvoicePatient.lastName}` : null,
              requestedBy: order.requestedBy,
              requestedByName: null,
              serviceId: order.labServiceId,
              serviceName: service?.name ?? viewedInvoiceItem.description,
              serviceCategory: service?.category ?? 'laboratory',
              department: 'Laboratory',
              transactionType: 'cashier_paid_service',
              status: order.status === 'released' ? 'completed' : 'pending',
              sampleStatus: order.status === 'processing' || order.status === 'ready' || order.status === 'released' ? 'processing' : 'pending',
              resultStatus: order.status === 'released' ? 'completed' : 'pending',
              patientNotes: order.notes || null,
              resultData: null,
              resultNotes: null,
              urgentFlag: Boolean(order.urgentFlag),
              completedBy: null,
              completedByName: null,
              completedAt: null,
              media: [],
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
            };
          }
        } else {
          const patientRequests = await labRequestService.getPatientRequests(viewedInvoice.patientId);
          const matchingRequests = patientRequests
            .filter((request) => request.department === 'Laboratory')
            .filter((request) => request.transactionType === 'cashier_paid_service')
            .filter((request) => {
              if (request.serviceName) {
                return request.serviceName === viewedInvoiceItem.description;
              }

              return request.serviceCategory.toLowerCase() === viewedInvoiceItem.category.toLowerCase();
            })
            .sort(
              (left, right) =>
                Math.abs(new Date(left.createdAt).getTime() - new Date(viewedInvoice.createdAt).getTime()) -
                Math.abs(new Date(right.createdAt).getTime() - new Date(viewedInvoice.createdAt).getTime()),
            );

          relatedRequest = matchingRequests[0] ?? null;
        }
      } catch {
        relatedRequest = null;
      }
    }

    let qrSvgMarkup = '';
    if (relatedRequest) {
      qrSvgMarkup = await QRCode.toString(buildLabServiceReceiptLookupUrl(relatedRequest.id), {
        errorCorrectionLevel: 'M',
        margin: 1,
        type: 'svg',
        width: 220,
      });
    }

    await printHtmlDocument(
      buildInvoicePrintDocument({
        invoice: viewedInvoice,
        patientName: viewedInvoicePatient
          ? `${viewedInvoicePatient.firstName} ${viewedInvoicePatient.lastName}`
          : 'Unknown patient',
        patientContact: viewedInvoicePatient?.email || viewedInvoicePatient?.mobileNumber || '',
        itemDescription: viewedInvoiceItem?.description || 'No line item recorded',
        itemCategory: viewedInvoiceItem?.category || 'other',
        quantity: viewedInvoiceItem?.quantity || 1,
        unitPrice: viewedInvoiceItem?.unitPrice || viewedInvoice.total,
        qrSvgMarkup,
        qrHelperText: relatedRequest
          ? 'Clinic or laboratory staff can scan this QR code to open the linked request and proceed with the test.'
          : undefined,
      }),
    );
  };

  const handlePrintViewedInvoice = () => {
    void handleOpenInvoiceOutput().catch(() => {
      toast.error('The invoice could not be sent to the print dialog.');
    });
  };

  const handleSaveViewedInvoiceAsPdf = () => {
    toast.message('When the print dialog opens, choose "Save as PDF" as the destination.');
    void handleOpenInvoiceOutput().catch(() => {
      toast.error('The invoice could not be prepared for PDF saving.');
    });
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
              <Link className="inline-flex items-center justify-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" to="/app/laboratory/scan">
                <ScanLine className="mr-2 size-4" />
                Scan lab receipt
              </Link>
              <Button className="rounded-none border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest text-violet-800 hover:bg-violet-100" onClick={openPayForServiceModal}>
                <TestTube2 className="mr-2 size-4" />
                Pay for service
              </Button>
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

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-none border-violet-200 bg-violet-50/50">
            <p className="text-xs font-extrabold uppercase tracking-widest text-violet-700">Lab Service Payment</p>
            <CardTitle className="mt-2">Cashier shortcut for laboratory services</CardTitle>
            <p className="mt-2 text-sm text-slate-600">
              Use <span className="font-semibold text-slate-900">Pay for service</span> to fetch the live laboratory service fee, mark the invoice as paid, create the lab request, and print a QR receipt for staff scanning.
            </p>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <div className="rounded-2xl border border-violet-200 bg-white px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Live source</p>
                <p className="mt-1 font-semibold text-slate-950">Laboratory services and fees come from the lab catalog.</p>
              </div>
              <div className="rounded-2xl border border-violet-200 bg-white px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Receipt flow</p>
                <p className="mt-1 font-semibold text-slate-950">The printed QR opens the exact paid lab request for intake or processing.</p>
              </div>
            </div>
          </Card>

          {labReceiptState.open && labReceiptState.invoice && labReceiptState.request ? (
            <div className="space-y-3">
              <LabServiceReceiptCard
                invoice={labReceiptState.invoice}
                patientName={labReceiptState.patientName}
                request={labReceiptState.request}
              />
              <Button className="w-full rounded-none" onClick={closeLabReceiptModal} type="button" variant="secondary">
                Close receipt preview
              </Button>
            </div>
          ) : (
            <Card className="rounded-none border-dashed border-slate-300 bg-slate-50">
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Receipt Preview</p>
              <CardTitle className="mt-2">Paid laboratory receipts will appear here</CardTitle>
              <p className="mt-2 text-sm text-slate-500">
                After a cashier records a lab-service payment, the printable QR receipt will open in this panel.
              </p>
            </Card>
          )}
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
                    const patient = patients.find((item) => item.id === invoice.patientId);

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
                            <button className="inline-flex items-center gap-1 text-emerald-700 hover:underline" onClick={() => openViewModal(invoice.id)} type="button">
                              <Eye className="size-3.5" />
                              View
                            </button>
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

      {isPayServiceModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closePayForServiceModal}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 bg-violet-700 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-widest text-violet-200">Paid Lab Service</p>
                <p className="mt-0.5 text-sm font-bold text-white">Pay for service</p>
                <p className="mt-2 max-w-2xl text-sm text-violet-50">Choose a patient and laboratory service. The system will use the live service fee, create the paid invoice, generate the lab request, and prepare a QR receipt.</p>
              </div>
              <button
                aria-label="Close paid service modal"
                className="inline-flex shrink-0 items-center justify-center border border-violet-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={closePayForServiceModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmitPaidService}>
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
                    <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-950">{selectedLabService.name}</p>
                      <p className="mt-1">{selectedLabService.description ?? 'No service description available.'}</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Category</p>
                          <p className="mt-1 font-semibold text-slate-950">{selectedLabService.category}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Declared fee</p>
                          <p className="mt-1 font-semibold text-violet-800">{formatCurrency(selectedLabService.serviceFee)}</p>
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
                    <input className="accent-violet-700" type="checkbox" {...payServiceForm.register('urgentFlag')} />
                    Mark as urgent
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button className="w-full rounded-none sm:w-auto" onClick={closePayForServiceModal} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button
                  className="w-full rounded-none bg-violet-700 px-5 py-3 text-sm font-extrabold uppercase tracking-widest hover:bg-violet-800 sm:w-auto"
                  disabled={payForServiceMutation.isPending || labServiceOptions.length === 0}
                  type="submit"
                >
                  {payForServiceMutation.isPending ? 'Processing payment...' : 'Pay and print receipt'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {invoiceViewState.open && viewedInvoice ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closeInvoiceViewModal}
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
                onClick={closeInvoiceViewModal}
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
              <Button className="rounded-none" onClick={closeInvoiceViewModal} type="button" variant="secondary">
                Close
              </Button>
            </div>
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
