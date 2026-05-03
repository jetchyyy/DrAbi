import { zodResolver } from '@hookform/resolvers/zod';
import { Coins, Eye, Pencil, Plus, Receipt, ScanLine, Search, TestTube2, Trash2, X, CreditCard } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { isModuleEnabled } from '../../config/modules';
import { useAuth } from '../auth/auth-context';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { LabServiceReceiptCard } from '../laboratory/components/lab-service-receipt-card';
import { formatCurrency } from '../../lib/utils';
// import { labRequestService } from '../../lab-requests/api/lab-request-service';
// import type { LabRequestRecord } from '../../lab-requests/types';
import { PaymentBadge } from './payment-badge';
import { PaymentUpdateModal } from './components/payment-update-modal';
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





export function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: clinicSettings } = useClinicSettingsData();
  const { profile } = useAuth();
  const bookingEnabled = isModuleEnabled('booking_appointments', clinicSettings?.enabledModules);
  const laboratoryEnabled = isModuleEnabled('laboratory', clinicSettings?.enabledModules);
  const [search, setSearch] = useState('');
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
  const deferredSearch = useDeferredValue(search);

  const { data: patients = [] } = usePatients();

  const { data: bookings = [] } = useBookings();

  const { data: invoices = [] } = useInvoices();

  const { data: invoiceItems = [] } = useInvoiceItems();

  const { data: labServiceOptions = [] } = useLabServiceOptions();

  const createInvoiceMutation = useCreateInvoice();

  const updateInvoiceMutation = useUpdateInvoice();

  const deleteInvoiceMutation = useDeleteInvoice();

  const payForServiceMutation = usePayForService();

  const updatePaymentMutation = useUpdatePayment();

  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      patientId: patients[0]?.id ?? '',
      bookingId: '',
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
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) ?? null;
  const selectedLabServiceId = payServiceForm.watch('serviceId');
  const selectedLabService = labServiceOptions.find((service: any) => service.id === selectedLabServiceId) ?? null;

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
  const viewedInvoiceItem = viewedInvoiceItems[0] ?? null;
  const viewedInvoicePatient = patients.find((patient) => patient.id === viewedInvoice?.patientId) ?? null;
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

  useEffect(() => {
    if (updatePaymentMutation.isSuccess) {
      closePaymentUpdateModal();
      toast.success('Payment status updated successfully');
    }
  }, [updatePaymentMutation.isSuccess]);

  const openCreateModal = () => {
    form.reset({
      patientId: patients[0]?.id ?? '',
      bookingId: '',
      items: [
        {
          description: 'General Consultation',
          category: 'consultation',
          quantity: 1,
          unitPrice: 800,
        },
      ],
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
    const items = invoiceItems.filter((entry) => entry.invoiceId === invoiceId);
    if (!invoice || items.length === 0) {
      return;
    }

    form.reset({
      patientId: invoice.patientId,
      bookingId: '',
      items: items.map((item) => ({
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
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
        await updateInvoiceMutation.mutateAsync({ invoiceId: editingInvoiceId, values, bookings, invoices });
        setFeedbackModal({
          open: true,
          title: 'Invoice updated',
          message: 'The invoice details were updated successfully.',
          variant: 'success',
        });
      } else {
        await createInvoiceMutation.mutateAsync({ values, bookings });
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

  // const handleOpenInvoiceOutput = async () => {
  //   if (!viewedInvoice) {
  //     toast.error('No invoice is selected for printing.');
  //     return;
  //   }

  //   let relatedRequest: LabRequestRecord | null = null;

  //   if (viewedInvoice.paymentStatus === 'paid' && viewedInvoiceLabItem?.category === 'laboratory') {
  //     try {
  //       if (!isSupabaseConfigured || !supabase) {
  //         const database = getDatabase();
  //         const matchedService = database.labServices.find((service) => service.name === viewedInvoiceLabItem.description) ?? null;
  //         const matchingOrders = database.labOrders
  //           .filter((order) => order.patientId === viewedInvoice.patientId)
  //           .filter((order) => (matchedService ? order.labServiceId === matchedService.id : true))
  //           .sort(
  //             (left, right) =>
  //               Math.abs(new Date(left.createdAt).getTime() - new Date(viewedInvoice.createdAt).getTime()) -
  //               Math.abs(new Date(right.createdAt).getTime() - new Date(viewedInvoice.createdAt).getTime()),
  //             );

  //         const order = matchingOrders[0] ?? null;
  //         if (order) {
  //           const service = database.labServices.find((entry) => entry.id === order.labServiceId) ?? null;
  //           relatedRequest = {
  //             id: order.id,
  //             clinicId: '',
  //             clinicName: null,
  //             appointmentId: order.appointmentId ?? null,
  //             patientId: order.patientId,
  //             patientName: viewedInvoicePatient ? `${viewedInvoicePatient.firstName} ${viewedInvoicePatient.lastName}` : null,
  //             requestedBy: order.requestedBy,
  //             requestedByName: null,
  //             serviceId: order.labServiceId,
  //             serviceName: service?.name ?? viewedInvoiceLabItem.description,
  //             serviceCategory: service?.category ?? 'laboratory',
  //             department: 'Laboratory',
  //             transactionType: 'cashier_paid_service',
  //             status: order.status === 'released' ? 'completed' : 'pending',
  //             sampleStatus: order.status === 'processing' || order.status === 'ready' || order.status === 'released' ? 'processing' : 'pending',
  //             resultStatus: order.status === 'released' ? 'completed' : 'pending',
  //             patientNotes: order.notes || null,
  //             resultData: null,
  //             resultNotes: null,
  //             urgentFlag: Boolean(order.urgentFlag),
  //             completedBy: null,
  //             completedByName: null,
  //             completedAt: null,
  //             media: [],
  //             createdAt: order.createdAt,
  //             updatedAt: order.updatedAt,
  //           };
  //         }
  //       } else {
  //         const patientRequests = await labRequestService.getPatientRequests(viewedInvoice.patientId);
  //         const matchingRequests = patientRequests
  //           .filter((request) => request.department === 'Laboratory')
  //           .filter((request) => request.transactionType === 'cashier_paid_service')
  //           .filter((request) => {
  //             if (request.serviceName) {
  //               return request.serviceName === viewedInvoiceLabItem.description;
  //             }

  //             return request.serviceCategory.toLowerCase() === viewedInvoiceLabItem.category.toLowerCase();
  //           })
  //           .sort(
  //             (left, right) =>
  //               Math.abs(new Date(left.createdAt).getTime() - new Date(viewedInvoice.createdAt).getTime()) -
  //               Math.abs(new Date(right.createdAt).getTime() - new Date(viewedInvoice.createdAt).getTime()),
  //           );

  //         relatedRequest = matchingRequests[0] ?? null;
  //       }
  //     } catch {
  //       relatedRequest = null;
  //     }
  //   }

  //   let qrSvgMarkup = '';
  //   if (relatedRequest) {
  //     qrSvgMarkup = await QRCode.toString(buildLabServiceReceiptLookupUrl(relatedRequest.id), {
  //       errorCorrectionLevel: 'M',
  //       margin: 1,
  //       type: 'svg',
  //       width: 220,
  //     });
  //   }

  //   await printHtmlDocument(
  //     buildInvoicePrintDocument({
  //       clinicName: clinicSettings?.clinicName ?? 'Clinic',
  //       invoice: viewedInvoice,
  //       patientName: viewedInvoicePatient
  //         ? `${viewedInvoicePatient.firstName} ${viewedInvoicePatient.lastName}`
  //         : 'Unknown patient',
  //       patientContact: viewedInvoicePatient?.email || viewedInvoicePatient?.mobileNumber || '',
  //       items: viewedInvoiceItems,
  //       qrSvgMarkup,
  //       qrHelperText: relatedRequest
  //         ? 'Clinic or laboratory staff can scan this QR code to open the linked request and proceed with the test.'
  //         : undefined,
  //     }),
  //   );
  // };

  // const handlePrintViewedInvoice = () => {
  //   void handleOpenInvoiceOutput().catch(() => {
  //     toast.error('The invoice could not be sent to the print dialog.');
  //   });
  // };

  // const handleSaveViewedInvoiceAsPdf = () => {
  //   toast.message('When the print dialog opens, choose "Save as PDF" as the destination.');
  //   void handleOpenInvoiceOutput().catch(() => {
  //     toast.error('The invoice could not be prepared for PDF saving.');
  //   });
  // };

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
                  paginatedInvoices.map((invoice) => {
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
              {/* <Button className="gap-2 rounded-none sm:w-auto" onClick={handleSaveViewedInvoiceAsPdf} type="button" variant="secondary">
                <Receipt className="size-4" />
                Save as PDF
              </Button>
              <Button className="gap-2 rounded-none sm:w-auto" onClick={handlePrintViewedInvoice} type="button">
                <Printer className="size-4" />
                Print receipt
              </Button> */}
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
