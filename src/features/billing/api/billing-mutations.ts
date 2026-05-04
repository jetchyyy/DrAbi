import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { getDatabase } from '../../../lib/local-db';
import { labRequestService } from '../../lab-requests/api/lab-request-service';
import { queryKeys } from '../../../lib/query-keys';
import {
  createInvoiceLiveOrDemo,
  deleteInvoiceLiveOrDemo,
  listBookingsLiveOrDemo,
  listInvoiceItemsLiveOrDemo,
  listInvoicesLiveOrDemo,
  listPatientsLiveOrDemo,
  updateInvoiceLiveOrDemo,
} from '../../../lib/supabase-clinic';
import type { Invoice, InvoiceItem, Payment } from '../../../types/domain';
import type { LabRequestRecord } from '../../lab-requests/types';
import type { BillingFormValues, LabServiceOption, PayForServiceFormValues } from '../types/forms';

// Helper function to generate invoice number in format INV-YYYY-MM-NNNN
function generateInvoiceNumber(existingInvoices: Invoice[]): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${year}-${month}`;
  
  // Count invoices from the current month
  const currentMonthInvoices = existingInvoices.filter((inv) => 
    inv.invoiceNumber.startsWith(`INV-${yearMonth}`)
  );
  
  // Generate sequential number (001, 002, etc.)
  const sequence = String(currentMonthInvoices.length + 1).padStart(4, '0');
  
  return `INV-${yearMonth}-${sequence}`;
}

export function usePatients() {
  return useQuery({
    queryKey: queryKeys.patients,
    queryFn: async () => listPatientsLiveOrDemo(),
  });
}

export function useBookings() {
  return useQuery({
    queryKey: queryKeys.bookings,
    queryFn: async () => listBookingsLiveOrDemo(),
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices,
    queryFn: async () => listInvoicesLiveOrDemo(),
  });
}

export function useInvoiceItems() {
  return useQuery({
    queryKey: queryKeys.invoiceItems,
    queryFn: async () => listInvoiceItemsLiveOrDemo(),
  });
}

export function usePaymentsForInvoice(invoiceId: string) {
  return useQuery({
    queryKey: ['payments', invoiceId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) {
        return [];
      }

      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map((payment: any) => ({
        id: payment.id,
        invoiceId: payment.invoice_id,
        amount: Number(payment.amount),
        method: payment.method,
        referenceNumber: payment.reference_number,
        receivedBy: payment.received_by,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
      })) satisfies Payment[];
    },
    enabled: !!invoiceId && isSupabaseConfigured,
  });
}

export function useLabServiceOptions() {
  return useQuery({
    queryKey: ['lab-request-services'],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) {
        return getDatabase().labServices
          .slice()
          .sort((left: any, right: any) => left.name.localeCompare(right.name))
          .map((service: any) => ({
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
      })) satisfies LabServiceOption[];
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ values, bookings }: { values: BillingFormValues; bookings: any[] }) => {
      const total = values.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const taggedBooking = bookings.find((booking) => booking.id === values.bookingId) ?? null;
      
      // Get existing invoices to generate sequential invoice number
      const existingInvoices = queryClient.getQueryData<Invoice[]>(queryKeys.invoices) ?? [];
      const invoiceNumber = generateInvoiceNumber(existingInvoices);
      
      return createInvoiceLiveOrDemo(
        {
          patientId: values.patientId,
          appointmentId: taggedBooking?.appointmentId ?? null,
          invoiceNumber,
          paymentStatus: 'unpaid',
          subtotal: total,
          total,
        },
        values.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          category: item.category,
        })),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, values, bookings, invoices }: { invoiceId: string; values: BillingFormValues; bookings: any[]; invoices: Invoice[] }) => {
      const total = values.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const taggedBooking = bookings.find((booking) => booking.id === values.bookingId) ?? null;
      
      // Keep existing invoice number or generate new one
      const invoiceNumber = invoices.find((invoice) => invoice.id === invoiceId)?.invoiceNumber ?? generateInvoiceNumber(invoices);
      
      return updateInvoiceLiveOrDemo(
        invoiceId,
        {
          patientId: values.patientId,
          appointmentId: taggedBooking?.appointmentId ?? null,
          invoiceNumber,
          paymentStatus: 'unpaid',
          subtotal: total,
          total,
        },
        values.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          category: item.category,
        })),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => deleteInvoiceLiveOrDemo(invoiceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
    },
  });
}

export function usePayForService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ values, profile, labServiceOptions, patients }: { values: PayForServiceFormValues; profile: any; labServiceOptions: LabServiceOption[]; patients: any[] }) => {
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
        // Get existing invoices to generate sequential invoice number
        const existingInvoices = queryClient.getQueryData<Invoice[]>(queryKeys.invoices) ?? [];
        const invoiceNumber = generateInvoiceNumber(existingInvoices);

        createdInvoice = await createInvoiceLiveOrDemo(
          {
            patientId: values.patientId,
            appointmentId: null,
            invoiceNumber,
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
          const { createLabOrder } = await import('../../../lib/local-db');
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
            paymentStatus: 'paid',
            receiptCode: createdInvoice.invoiceNumber,
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

          request =
            (await labRequestService.markRequestAsPaid(createdRequest.id, createdRequest.receiptCode ?? null)) ??
            createdRequest;
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
      // Note: setLabReceiptState needs to be handled in the component
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, paymentType, referenceNumber, profile }: { 
      invoiceId: string; 
      paymentType: string; 
      referenceNumber?: string;
      profile: any;
    }) => {
      // Get current invoice data
      const invoices = queryClient.getQueryData<Invoice[]>(queryKeys.invoices) ?? [];
      const invoiceItems = queryClient.getQueryData<InvoiceItem[]>(queryKeys.invoiceItems) ?? [];
      
      const currentInvoice = invoices.find(inv => inv.id === invoiceId);
      const currentItems = invoiceItems.filter(item => item.invoiceId === invoiceId);
      
      if (!currentInvoice) {
        throw new Error('Invoice not found');
      }

      // Update only the payment status
      const updatedInvoice = {
        ...currentInvoice,
        paymentStatus: 'paid' as const,
      };

      const updatedItems = currentItems.map(item => ({
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));

      // Update the invoice status
      await updateInvoiceLiveOrDemo(invoiceId, updatedInvoice, updatedItems);

      // Create payment record if Supabase is configured
      if (isSupabaseConfigured && supabase) {
        const { error: paymentError } = await (supabase
          .from('payments') as any)
          .insert({
            invoice_id: invoiceId,
            amount: currentInvoice.total,
            method: paymentType,
            reference_number: referenceNumber || null,
            received_by: profile?.id || null,
          });

        if (paymentError) {
          console.error('Failed to create payment record:', paymentError);
          // Don't throw here - invoice is already updated
        }
      }

      return updatedInvoice;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
    },
  });
}