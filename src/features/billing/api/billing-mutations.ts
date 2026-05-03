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
import type { Invoice, InvoiceItem } from '../../../types/domain';
import type { LabRequestRecord } from '../../lab-requests/types';
import type { BillingFormValues, LabServiceOption, PayForServiceFormValues } from '../types/forms';

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
      return createInvoiceLiveOrDemo(
        {
          patientId: values.patientId,
          appointmentId: taggedBooking?.appointmentId ?? null,
          invoiceNumber: `INV-${Date.now()}`,
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
    mutationFn: async ({ invoiceId, paymentType: _paymentType, referenceNumber: _referenceNumber }: { invoiceId: string; paymentType: string; referenceNumber: string }) => {
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

      return updateInvoiceLiveOrDemo(invoiceId, updatedInvoice, updatedItems);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
    },
  });
}