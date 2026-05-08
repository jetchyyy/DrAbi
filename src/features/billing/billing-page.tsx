import { zodResolver } from '@hookform/resolvers/zod';
import { Coins, CreditCard, Eye, Pencil, Plus, Printer, Receipt, ScanLine, Search, TestTube2, Trash2, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { isModuleEnabled } from '../../config/modules';
import { useAuth } from '../auth/auth-context';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { useAppointments } from '../appointments/hooks/use-appointments';
import { LabServiceReceiptCard } from '../laboratory/components/lab-service-receipt-card';
import { printHtmlDocument } from '../../lib/print';
import { getDoctorDirectoryLiveOrDemo, listConsultationsByPatientIdLiveOrDemo } from '../../lib/supabase-clinic';
import { formatCurrency } from '../../lib/utils';
// import { labRequestService } from '../../lab-requests/api/lab-request-service';
// import type { LabRequestRecord } from '../../lab-requests/types';
import { PaymentBadge } from './payment-badge';
import { PaymentUpdateModal } from './components/payment-update-modal';
import { buildBillingReceiptPrintDocument } from './lib/billing-receipt-print-document';
import {
  usePatients,
  useBookings,
  useInvoices,
  useInvoiceItems,
  useLabServiceOptions,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  usePayForService,
  useUpdatePayment,
  usePaymentsForInvoice,
} from './api/billing-mutations';

import {
  billingSchema,
  payForServiceSchema,
  type BillingFormValues,
  type PayForServiceFormValues,
  type FeedbackModalState,
  type LabReceiptState,
  type InvoiceViewState,
  BILLING_PAGE_SIZE,
} from './types/forms';

type InvoiceReceiptState = {
  patientId: string;
  invoiceNumber: string;
  customerName: string;
  doctorAssignedName: string;
  receptionistName: string;
  paymentMethod: string;
  paymentReference: string | null;
  issuedAt: string;
  subtotal: number;
  total: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
} | null;

function formatDoctorSignatureName(
  doctorName: string | null | undefined,
  postNominals?: string | null,
) {
  const baseName = (doctorName ?? '').trim().replace(/^dr\.?\s+/i, '').trim();
  if (!baseName) {
    return 'N/A';
  }

  const suffix = (postNominals ?? '')
    .trim()
    .replace(/^,\s*/, '')
    .replace(/^dr\.?\s+/i, '');

  return suffix ? `Dr. ${baseName}, ${suffix}` : `Dr. ${baseName}`;
}

async function resolveLatestDoctorAssignedName(patientId: string) {
  if (!patientId) {
    return 'N/A';
  }

  try {
    const [patientConsultations, doctors] = await Promise.all([
      listConsultationsByPatientIdLiveOrDemo(patientId),
      getDoctorDirectoryLiveOrDemo(),
    ]);

    const latestConsultation = patientConsultations
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

    if (!latestConsultation) {
      return 'N/A';
    }

    if (latestConsultation.doctorId) {
      const matchedDoctor = doctors.find((doctor) => doctor.id === latestConsultation.doctorId);
      return formatDoctorSignatureName(
        matchedDoctor?.fullName ?? latestConsultation.providerName,
        matchedDoctor?.title ?? null,
      );
    }

    if (latestConsultation.providerName) {
      return formatDoctorSignatureName(latestConsultation.providerName);
    }

    return 'N/A';
  } catch {
    return 'N/A';
  }
}





export function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: clinicSettings } = useClinicSettingsData();
  const { profile } = useAuth();
  const bookingEnabled = isModuleEnabled('booking_appointments', clinicSettings?.enabledModules);
  const laboratoryEnabled = isModuleEnabled('laboratory', clinicSettings?.enabledModules);
  const [search, setSearch] = useState('');
  const [invoicePatientSearch, setInvoicePatientSearch] = useState('');
  const [isInvoicePatientDropdownOpen, setIsInvoicePatientDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPayServiceModalOpen, setIsPayServiceModalOpen] = useState(false);
  const [isPaymentUpdateModalOpen, setIsPaymentUpdateModalOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [updatingPaymentInvoiceId, setUpdatingPaymentInvoiceId] = useState<string | null>(null);
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
  const [invoiceReceiptState, setInvoiceReceiptState] = useState<InvoiceReceiptState>(null);
  const deferredSearch = useDeferredValue(search);

  const { data: patients = [] } = usePatients();

  const { data: bookings = [] } = useBookings();

  const { data: appointments = [] } = useAppointments();

  const { data: invoices = [] } = useInvoices();

  const { data: invoiceItems = [] } = useInvoiceItems();

  const { data: labServiceOptions = [] } = useLabServiceOptions();

  const createInvoiceMutation = useCreateInvoice();

  const updateInvoiceMutation = useUpdateInvoice();

  const deleteInvoiceMutation = useDeleteInvoice();

  const payForServiceMutation = usePayForService();

  const updatePaymentMutation = useUpdatePayment();

  const { data: paymentsForViewedInvoice = [] } = usePaymentsForInvoice(invoiceViewState.invoiceId || '');
  const { data: paymentsForEditingInvoice = [] } = usePaymentsForInvoice(editingInvoiceId || '');

  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      patientId: '',
      bookingId: '',
      paymentStatus: 'unpaid',
      paymentType: 'cash',
      referenceNumber: '',
      items: [
        {
          description: 'General Consultation',
          category: 'consultation',
          quantity: 1,
          unitPrice: 800,
        },
      ],
    },
  });
  const itemsFieldArray = useFieldArray({ control: form.control, name: 'items' });

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
  const selectedPatientId = form.watch('patientId');
  const selectedInvoicePaymentStatus = form.watch('paymentStatus');
  const selectedInvoicePaymentType = form.watch('paymentType');
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) ?? null;
  const selectedLabServiceId = payServiceForm.watch('serviceId');
  const selectedLabService = labServiceOptions.find((service: any) => service.id === selectedLabServiceId) ?? null;
  const filteredInvoicePatients = useMemo(() => {
    const query = invoicePatientSearch.trim().toLowerCase();
    if (!query) {
      return patients;
    }

    return patients.filter((patient) => {
      const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
      return fullName.includes(query);
    });
  }, [invoicePatientSearch, patients]);
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? null;

  const selectInvoicePatient = (patient: { id: string; firstName: string; lastName: string }) => {
    form.setValue('patientId', patient.id, { shouldDirty: true, shouldValidate: true });
    setInvoicePatientSearch(`${patient.firstName} ${patient.lastName}`);
    setIsInvoicePatientDropdownOpen(false);
  };

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
  const invoiceSummary = useMemo(
    () => ({
      paid: invoices.filter((inv) => inv.paymentStatus === 'paid').length,
      unpaid: invoices.filter((inv) => inv.paymentStatus === 'unpaid').length,
      partial: invoices.filter((inv) => inv.paymentStatus === 'partial').length,
    }),
    [invoices],
  );

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / BILLING_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * BILLING_PAGE_SIZE;
  const paginatedInvoices = useMemo(
    () => filteredInvoices.slice(pageStart, pageStart + BILLING_PAGE_SIZE),
    [filteredInvoices, pageStart],
  );
  const showingStart = filteredInvoices.length === 0 ? 0 : pageStart + 1;
  const showingEnd =
    filteredInvoices.length === 0
      ? 0
      : Math.min(pageStart + BILLING_PAGE_SIZE, filteredInvoices.length);
  const viewedInvoice = invoices.find((invoice) => invoice.id === invoiceViewState.invoiceId) ?? null;
  const viewedInvoiceItems = invoiceItems.filter((item) => item.invoiceId === invoiceViewState.invoiceId);
  const viewedInvoicePatient = patients.find((patient) => patient.id === viewedInvoice?.patientId) ?? null;
  const viewedInvoiceReceiptState = useMemo<InvoiceReceiptState>(() => {
    if (!viewedInvoice) {
      return null;
    }

    const latestPayment = paymentsForViewedInvoice[0] ?? null;
    const paymentMethodMap: Record<string, string> = {
      cash: 'cash',
      gcash: 'gcash',
      bank_transfer: 'bank transfer',
      other: 'other',
    };

    return {
      patientId: viewedInvoice.patientId,
      invoiceNumber: viewedInvoice.invoiceNumber,
      customerName: viewedInvoicePatient ? `${viewedInvoicePatient.firstName} ${viewedInvoicePatient.lastName}` : 'Walk-in customer',
      doctorAssignedName: 'N/A',
      receptionistName: profile?.fullName ?? 'N/A',
      paymentMethod: latestPayment ? paymentMethodMap[latestPayment.method] ?? latestPayment.method : viewedInvoice.paymentStatus,
      paymentReference: latestPayment?.referenceNumber ?? null,
      issuedAt: viewedInvoice.createdAt,
      subtotal: viewedInvoice.subtotal,
      total: viewedInvoice.total,
      items: viewedInvoiceItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      })),
    };
  }, [paymentsForViewedInvoice, profile?.fullName, viewedInvoice, viewedInvoiceItems, viewedInvoicePatient]);
  // const viewedInvoiceLabItem = viewedInvoiceItems.find((item) => item.category === 'laboratory') ?? viewedInvoiceItem;

  useEffect(() => {
    const invoiceIdFromQuery = (searchParams.get('invoiceId') ?? '').trim();
    if (!invoiceIdFromQuery || invoices.length === 0) {
      return;
    }

    const matchedInvoice = invoices.find((invoice) => invoice.id === invoiceIdFromQuery);
    if (!matchedInvoice) {
      return;
    }

    setInvoiceViewState({
      open: true,
      invoiceId: matchedInvoice.id,
    });

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('invoiceId');
    setSearchParams(nextParams, { replace: true });
  }, [invoices, searchParams, setSearchParams]);

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

  useEffect(() => {
    if (updatePaymentMutation.isSuccess) {
      closePaymentUpdateModal();
      toast.success('Payment status updated successfully');
    }
  }, [updatePaymentMutation.isSuccess]);

  useEffect(() => {
    if (selectedInvoicePaymentStatus !== 'paid' || selectedInvoicePaymentType === 'cash') {
      form.setValue('referenceNumber', '');
    }
  }, [form, selectedInvoicePaymentStatus, selectedInvoicePaymentType]);

  useEffect(() => {
    if (!editingInvoiceId || selectedInvoicePaymentStatus !== 'paid') {
      return;
    }

    const latestPayment = paymentsForEditingInvoice[0];
    if (!latestPayment) {
      return;
    }

    if (latestPayment.method === 'cash' || latestPayment.method === 'gcash' || latestPayment.method === 'card') {
      form.setValue('paymentType', latestPayment.method);
      form.setValue('referenceNumber', latestPayment.referenceNumber || '');
    }
  }, [editingInvoiceId, form, paymentsForEditingInvoice, selectedInvoicePaymentStatus]);

  const openCreateModal = () => {
    form.reset({
      patientId: '',
      bookingId: '',
      appointmentId: '',
      paymentStatus: 'unpaid',
      paymentType: 'cash',
      referenceNumber: '',
      items: [
        {
          description: 'General Consultation',
          category: 'consultation',
          quantity: 1,
          unitPrice: 800,
        },
      ],
    });
    setInvoicePatientSearch('');
    setIsInvoicePatientDropdownOpen(false);
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
    const items = invoiceItems.filter((entry) => entry.invoiceId === invoiceId);
    if (!invoice || items.length === 0) {
      return;
    }

    form.reset({
      patientId: invoice.patientId,
      bookingId: '',
      appointmentId: invoice.appointmentId ?? '',
      paymentStatus: invoice.paymentStatus === 'paid' ? 'paid' : 'unpaid',
      paymentType: 'cash',
      referenceNumber: '',
      items: items.map((item) => ({
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });
    const selectedPatient = patients.find((patient) => patient.id === invoice.patientId) ?? null;
    setInvoicePatientSearch(selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : '');
    setIsInvoicePatientDropdownOpen(false);
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
    setIsInvoicePatientDropdownOpen(false);
    setIsInvoiceModalOpen(false);
  };

  const closePayForServiceModal = () => {
    setIsPayServiceModalOpen(false);
  };

  const openPaymentUpdateModal = (invoiceId: string) => {
    setUpdatingPaymentInvoiceId(invoiceId);
    setIsPaymentUpdateModalOpen(true);
  };

  const closePaymentUpdateModal = () => {
    setUpdatingPaymentInvoiceId(null);
    setIsPaymentUpdateModalOpen(false);
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
        await updateInvoiceMutation.mutateAsync({ invoiceId: editingInvoiceId, values, bookings, invoices, profile });
        setFeedbackModal({
          open: true,
          title: 'Invoice updated',
          message: 'The invoice details were updated successfully.',
          variant: 'success',
        });
      } else {
        const createdInvoice = await createInvoiceMutation.mutateAsync({ values, bookings, profile });
        const selectedPatient = patients.find((patient) => patient.id === values.patientId) ?? null;
        const markAsPaidOnCreate = values.paymentStatus === 'paid';
        const paymentTypeOnCreate = values.paymentType ?? 'cash';
        const referenceOnCreate =
          paymentTypeOnCreate === 'cash' ? null : values.referenceNumber?.trim() || null;
        const doctorAssignedName = await resolveLatestDoctorAssignedName(values.patientId);

        setInvoiceReceiptState({
          patientId: values.patientId,
          invoiceNumber: createdInvoice.invoiceNumber,
          customerName: selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'Walk-in customer',
          doctorAssignedName,
          receptionistName: profile?.fullName ?? 'N/A',
          paymentMethod: markAsPaidOnCreate ? paymentTypeOnCreate : createdInvoice.paymentStatus,
          paymentReference: markAsPaidOnCreate ? referenceOnCreate : null,
          issuedAt: createdInvoice.createdAt,
          subtotal: createdInvoice.subtotal,
          total: createdInvoice.total,
          items: values.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.quantity * item.unitPrice,
          })),
        });
        setFeedbackModal({
          open: true,
          title: 'Invoice created',
          message: 'The invoice has been added successfully and is ready to print.',
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

  const handlePrintInvoiceReceipt = async () => {
    if (!invoiceReceiptState) {
      return;
    }

    try {
      const doctorAssignedName = await resolveLatestDoctorAssignedName(invoiceReceiptState.patientId);
      await printHtmlDocument(
        buildBillingReceiptPrintDocument({
          ...invoiceReceiptState,
          doctorAssignedName,
        }),
      );
    } catch {
      toast.error('The invoice receipt could not be sent to the print dialog.');
    }
  };

  const handlePrintViewedInvoice = async () => {
    if (!viewedInvoiceReceiptState) {
      toast.error('No invoice is selected for printing.');
      return;
    }

    try {
      const doctorAssignedName = await resolveLatestDoctorAssignedName(viewedInvoiceReceiptState.patientId);
      await printHtmlDocument(
        buildBillingReceiptPrintDocument({
          ...viewedInvoiceReceiptState,
          doctorAssignedName,
        }),
      );
    } catch {
      toast.error('The invoice could not be sent to the print dialog.');
    }
  };

  const handleSaveViewedInvoiceAsPdf = () => {
    toast.message('When the print dialog opens, choose "Save as PDF" as the destination.');
    void handlePrintViewedInvoice();
  };

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
      await payForServiceMutation.mutateAsync({ values, profile, labServiceOptions, patients });
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

  return (
    <>
      <div className="space-y-5">
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
              {bookingEnabled ? (
                <Link className="inline-flex items-center justify-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" to="/app/bookings/scan">
                  <Receipt className="mr-2 size-4" />
                  Scan booking receipt
                </Link>
              ) : null}
              {laboratoryEnabled ? (
                <Link className="inline-flex items-center justify-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" to="/app/laboratory/scan">
                  <ScanLine className="mr-2 size-4" />
                  Scan lab receipt
                </Link>
              ) : null}
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
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search invoice, patient, or payment status"
                  value={search}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-6 py-2.5">
            <span className="text-xs font-bold text-slate-500">{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found</span>
            <span className="inline-flex items-center border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
              {invoiceSummary.paid} paid
            </span>
            <span className="inline-flex items-center border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-red-600">
              {invoiceSummary.unpaid} unpaid
            </span>
            {invoiceSummary.partial > 0 ? (
              <span className="inline-flex items-center border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-yellow-700">
                {invoiceSummary.partial} partial
              </span>
            ) : null}
            {search ? (
              <button
                className="ml-auto border border-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition hover:bg-white"
                onClick={() => { setSearch(''); setCurrentPage(1); }}
                type="button"
              >
                Reset filter
              </button>
            ) : null}
          </div>
        </div>

        <div className="border border-violet-200 bg-violet-50/30">
          <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-violet-700 p-2 text-white">
                <TestTube2 className="size-4" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-700">Lab Service Payment</p>
                <p className="text-sm font-bold text-slate-950">Cashier shortcut for laboratory services</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center border border-violet-200 bg-white px-3 py-1.5 text-xs text-slate-600">
                <span className="mr-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Source —</span>
                Fees come from the live lab catalog.
              </span>
              <span className="inline-flex items-center border border-violet-200 bg-white px-3 py-1.5 text-xs text-slate-600">
                <span className="mr-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Receipt —</span>
                Printed QR links to the exact paid lab request.
              </span>
            </div>
          </div>
        </div>

        {labReceiptState.open && labReceiptState.invoice && labReceiptState.request ? (
          <div className="border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Receipt Preview</p>
              <button
                className="border border-slate-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition hover:bg-slate-50"
                onClick={closeLabReceiptModal}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="p-5">
              <LabServiceReceiptCard
                invoice={labReceiptState.invoice}
                patientName={labReceiptState.patientName}
                request={labReceiptState.request}
              />
            </div>
          </div>
        ) : null}

        {invoiceReceiptState ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Receipt className="size-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">
                  Invoice created - {invoiceReceiptState.invoiceNumber}
                </p>
                <p className="text-xs text-emerald-700">
                  {formatCurrency(invoiceReceiptState.total)} ({invoiceReceiptState.paymentMethod.toUpperCase()})
                </p>
              </div>
            </div>
            <Button
              className="gap-2 text-xs"
              onClick={() => void handlePrintInvoiceReceipt()}
              type="button"
              variant="secondary"
            >
              <Printer className="size-3.5" />
              Print receipt
            </Button>
          </div>
        ) : null}

        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Invoice</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Patient</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Status</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Total</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Actions</th>
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
                  paginatedInvoices.map((invoice) => {
                    const patient = patients.find((item) => item.id === invoice.patientId);

                    return (
                      <tr className="transition-colors hover:bg-slate-50" key={invoice.id}>
                        <td className="px-4 py-3 align-top">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-950">{invoice.invoiceNumber}</p>
                            <p className="font-mono text-xs text-slate-400">{invoice.id}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-slate-700">
                          {patient?.firstName} {patient?.lastName}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <PaymentBadge status={invoice.paymentStatus} />
                        </td>
                        <td className="px-4 py-3 align-top text-sm font-bold tabular-nums text-slate-950">{formatCurrency(invoice.total)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                            {invoice.paymentStatus === 'unpaid' ? (
                              <button className="inline-flex items-center gap-1 text-blue-600 hover:underline" onClick={() => openPaymentUpdateModal(invoice.id)} type="button">
                                <CreditCard className="size-3.5" />
                                Mark as Paid
                              </button>
                            ) : null}
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
          {filteredInvoices.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
              <p className="text-xs font-semibold text-slate-500">
                Showing {showingStart}-{showingEnd} of {filteredInvoices.length} invoices
              </p>
              <div className="flex items-center gap-2">
                <Button
                  className="rounded-none px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  type="button"
                  variant="secondary"
                >
                  Previous
                </Button>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <Button
                  className="rounded-none px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  type="button"
                  variant="secondary"
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
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
                    <div className="relative">
                      <input type="hidden" {...form.register('patientId')} />
                      <Input
                        onBlur={() => {
                          window.setTimeout(() => setIsInvoicePatientDropdownOpen(false), 120);
                        }}
                        onFocus={() => setIsInvoicePatientDropdownOpen(true)}
                        onChange={(event) => {
                          const query = event.target.value;
                          setInvoicePatientSearch(query);
                          setIsInvoicePatientDropdownOpen(true);

                          const exactMatch = patients.find(
                            (patient) =>
                              `${patient.firstName} ${patient.lastName}`.trim().toLowerCase() === query.trim().toLowerCase(),
                          );
                          if (exactMatch) {
                            form.setValue('patientId', exactMatch.id, { shouldDirty: true, shouldValidate: true });
                            return;
                          }
                          form.setValue('patientId', '', { shouldDirty: true, shouldValidate: true });
                        }}
                        placeholder="Type patient name"
                        value={invoicePatientSearch}
                      />
                      {isInvoicePatientDropdownOpen ? (
                        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto border border-slate-200 bg-white shadow-lg">
                          {filteredInvoicePatients.length > 0 ? (
                            filteredInvoicePatients.slice(0, 20).map((patient) => (
                              <button
                                className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                                  selectedPatientId === patient.id ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700'
                                }`}
                                key={patient.id}
                                onMouseDown={() => selectInvoicePatient(patient)}
                                type="button"
                              >
                                {patient.firstName} {patient.lastName}
                              </button>
                            ))
                          ) : (
                            <p className="px-3 py-2 text-xs text-slate-500">No matching patients found.</p>
                          )}
                        </div>
                      ) : null}
                      {selectedPatient ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Selected: {selectedPatient.firstName} {selectedPatient.lastName}
                        </p>
                      ) : null}
                    </div>
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

                        form.setValue('patientId', booking.patientId, { shouldDirty: true, shouldValidate: true });
                        const bookingPatient = patients.find((patient) => patient.id === booking.patientId) ?? null;
                        if (bookingPatient) {
                          setInvoicePatientSearch(`${bookingPatient.firstName} ${bookingPatient.lastName}`);
                        }
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
                      {appointments
                        .filter((appt) => appt.patientId === form.watch('patientId'))
                        .filter((appt) => !['cancelled', 'completed', 'no_show'].includes(appt.status))
                        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                        .map((appointment) => {
                          const date = new Date(appointment.scheduledAt);
                          const formatted = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                          return (
                            <option key={appointment.id} value={appointment.id}>
                              {formatted} - {appointment.status}
                            </option>
                          );
                        })}
                    </Select>
                  </FormField>
                  <p className="text-xs text-slate-500">Linking to an appointment ensures payment verification is tied to the specific session, preventing old invoices from authorizing access.</p>
                </div>

                <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Payment</p>
                  <FormField error={form.formState.errors.paymentStatus?.message} label="Payment Status">
                    <Select {...form.register('paymentStatus')}>
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </Select>
                  </FormField>

                  {selectedInvoicePaymentStatus === 'paid' ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField error={form.formState.errors.paymentType?.message} label="Payment Type">
                        <Select {...form.register('paymentType')}>
                          <option value="cash">Cash</option>
                          <option value="gcash">GCash</option>
                          <option value="card">Card</option>
                        </Select>
                      </FormField>
                      {selectedInvoicePaymentType !== 'cash' ? (
                        <FormField error={form.formState.errors.referenceNumber?.message} label="Reference Number">
                          <Input
                            placeholder="Enter reference number"
                            {...form.register('referenceNumber')}
                          />
                        </FormField>
                      ) : null}
                    </div>
                  ) : null}
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
                      {labServiceOptions.map((service: any) => (
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
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[90vh] sm:max-h-[85vh]"
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

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="space-y-5">
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

              {paymentsForViewedInvoice.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Payment Details</p>
                  {paymentsForViewedInvoice.map((payment) => {
                    const methodDisplayMap: Record<string, string> = {
                      cash: 'Cash',
                      gcash: 'GCash',
                      bank_transfer: 'Bank Transfer',
                      other: 'Other',
                    };
                    const displayMethod = methodDisplayMap[payment.method] || payment.method;

                    return (
                      <div key={payment.id} className="mt-3 grid gap-4 md:grid-cols-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Method</p>
                          <p className="mt-1 font-semibold text-slate-950">{displayMethod}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Amount</p>
                          <p className="mt-1 font-semibold text-slate-950">{formatCurrency(payment.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Reference Number</p>
                          <p className="mt-1 font-semibold text-slate-950">{payment.referenceNumber || 'N/A'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Line Items</p>
                {viewedInvoiceItems.length > 5 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Showing {viewedInvoiceItems.length} items. Scroll inside this section to view all.
                  </p>
                ) : null}
                {viewedInvoiceItems.length > 0 ? (
                  <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
                    {viewedInvoiceItems.map((item) => (
                      <div key={item.id} className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-5">
                        <div className="md:col-span-2">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Description</p>
                          <p className="mt-1 font-semibold text-slate-950">{item.description}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Category</p>
                          <p className="mt-1 font-semibold text-slate-950">{item.category}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Quantity</p>
                          <p className="mt-1 font-semibold text-slate-950">{item.quantity}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Unit Price</p>
                          <p className="mt-1 font-semibold text-slate-950">{formatCurrency(item.unitPrice)}</p>
                        </div>
                      </div>
                    ))}
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

      <PaymentUpdateModal
        isOpen={isPaymentUpdateModalOpen}
        onClose={closePaymentUpdateModal}
        onConfirm={(paymentType, referenceNumber) => {
          if (updatingPaymentInvoiceId) {
            updatePaymentMutation.mutate({
              invoiceId: updatingPaymentInvoiceId,
              paymentType,
              referenceNumber,
              profile,
            });
          }
        }}
        isLoading={updatePaymentMutation.isPending}
      />

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
