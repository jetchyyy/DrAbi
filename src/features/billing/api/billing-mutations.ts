import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isSupabaseConfigured, supabase } from "../../../lib/supabase";
import {
  createPaymentRecord,
  getDatabase,
  upsertLatestPaymentRecord,
} from "../../../lib/local-db";
import { labRequestService } from "../../lab-requests/api/lab-request-service";
import { queryKeys } from "../../../lib/query-keys";
import {
  createInvoiceLiveOrDemo,
  deleteInvoiceLiveOrDemo,
  listBookingsLiveOrDemo,
  listInvoiceItemsLiveOrDemo,
  listInvoicesLiveOrDemo,
  listPatientsLiveOrDemo,
  updateInvoiceLiveOrDemo,
} from "../../../lib/supabase-clinic";
import type { Invoice, InvoiceItem, Payment } from "../../../types/domain";
import type { LabRequestRecord } from "../../lab-requests/types";
import type {
  BillingFormValues,
  LabServiceOption,
  PayForServiceFormValues,
} from "../types/forms";

// Helper function to generate invoice number in format INV-YYYY-MM-NNNN
export function generateInvoiceNumber(existingInvoices: Invoice[]): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${year}-${month}`;

  // Count invoices from the current month
  const currentMonthInvoices = existingInvoices.filter((inv) =>
    inv.invoiceNumber.startsWith(`INV-${yearMonth}`),
  );

  // Generate sequential number (001, 002, etc.)
  const sequence = String(currentMonthInvoices.length + 1).padStart(4, "0");

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
    queryKey: ["payments", invoiceId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) {
        return getDatabase()
          .payments.filter((payment) => payment.invoiceId === invoiceId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      }

      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false });

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
    enabled: !!invoiceId,
  });
}

export function useLabServiceOptions() {
  return useQuery({
    queryKey: ["lab-request-services"],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) {
        return getDatabase()
          .labServices.slice()
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
        .from("medical_services")
        .select("id, clinic_id, name, description, category, service_fee")
        .eq("department", "Laboratory")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      return (
        (data ?? []) as Array<{
          id: string;
          clinic_id: string | null;
          name: string;
          description: string | null;
          category: string;
          service_fee: number;
        }>
      ).map((service) => ({
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
    mutationFn: async ({
      values,
      bookings,
      profile,
    }: {
      values: BillingFormValues;
      bookings: any[];
      profile: any;
    }) => {
      const markAsPaid = values.paymentStatus === "paid";
      const paymentType = values.paymentType ?? "cash";
      const referenceNumber =
        paymentType === "cash" ? null : values.referenceNumber?.trim() || null;

      const subtotal = values.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      const discountAmount = values.discountAmount ?? 0;
      const taxAmount = values.taxAmount ?? 0;
      const total = Math.max(0, subtotal - discountAmount);

      const taggedBooking =
        bookings.find((booking) => booking.id === values.bookingId) ?? null;

      // Get existing invoices to generate sequential invoice number
      const existingInvoices =
        queryClient.getQueryData<Invoice[]>(queryKeys.invoices) ?? [];
      const invoiceNumber = generateInvoiceNumber(existingInvoices);

      // Prefer explicit appointmentId from form, fall back to tagged booking's appointment
      const appointmentId =
        values.appointmentId ?? taggedBooking?.appointmentId ?? null;

      const createdInvoice = await createInvoiceLiveOrDemo(
        {
          patientId: values.patientId,
          appointmentId,
          invoiceNumber,
          paymentStatus: markAsPaid ? "paid" : "unpaid",
          subtotal,
          discountType: values.discountType ?? "none",
          discountAmount,
          taxAmount,
          total,
        },
        values.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          category: item.category,
          referenceId: item.referenceId ?? null,
          referenceType: item.referenceType ?? null,
        })),
      );

      if (markAsPaid) {
        if (isSupabaseConfigured && supabase) {
          const { error: paymentError } = await (
            supabase.from("payments") as any
          ).insert({
            invoice_id: createdInvoice.id,
            amount: createdInvoice.total,
            method: paymentType,
            reference_number: referenceNumber,
            received_by: profile?.id || null,
          });

          if (paymentError) {
            await deleteInvoiceLiveOrDemo(createdInvoice.id).catch(
              () => undefined,
            );
            throw paymentError;
          }

          // Mark linked lab orders as paid
          for (const item of values.items) {
            if (
              item.category === "laboratory" &&
              item.referenceType === "lab_order" &&
              item.referenceId
            ) {
              try {
                await labRequestService.markRequestAsPaid(
                  item.referenceId,
                  createdInvoice.invoiceNumber,
                );
              } catch (err) {
                console.error("Failed to mark lab request paid:", err);
              }
            }
          }
        } else {
          createPaymentRecord({
            invoiceId: createdInvoice.id,
            amount: createdInvoice.total,
            method: paymentType as Payment["method"],
            referenceNumber: referenceNumber ?? "",
            receivedBy: profile?.id || "",
          });
        }
      }

      return createdInvoice;
    },
    onSuccess: async (createdInvoice) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
      await queryClient.invalidateQueries({
        queryKey: ["payments", createdInvoice.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["patient-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["lab-queue"] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      values,
      bookings,
      invoices,
      profile,
    }: {
      invoiceId: string;
      values: BillingFormValues;
      bookings: any[];
      invoices: Invoice[];
      profile: any;
    }) => {
      const markAsPaid = values.paymentStatus === "paid";
      const paymentType = values.paymentType ?? "cash";
      const referenceNumber =
        paymentType === "cash" ? "" : values.referenceNumber?.trim() || "";

      const subtotal = values.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      const discountAmount = values.discountAmount ?? 0;
      const taxAmount = values.taxAmount ?? 0;
      const total = Math.max(0, subtotal - discountAmount);

      const taggedBooking =
        bookings.find((booking) => booking.id === values.bookingId) ?? null;

      // Keep existing invoice number or generate new one
      const invoiceNumber =
        invoices.find((invoice) => invoice.id === invoiceId)?.invoiceNumber ??
        generateInvoiceNumber(invoices);

      // Prefer explicit appointmentId from form, fall back to tagged booking's appointment
      const appointmentId =
        values.appointmentId ?? taggedBooking?.appointmentId ?? null;

      const updatedInvoice = await updateInvoiceLiveOrDemo(
        invoiceId,
        {
          patientId: values.patientId,
          appointmentId,
          invoiceNumber,
          paymentStatus: markAsPaid ? "paid" : "unpaid",
          subtotal,
          discountType: values.discountType ?? "none",
          discountAmount,
          taxAmount,
          total,
        },
        values.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          category: item.category,
          referenceId: item.referenceId ?? null,
          referenceType: item.referenceType ?? null,
        })),
      );

      if (!updatedInvoice) {
        throw new Error("Invoice update did not return a saved invoice.");
      }

      if (markAsPaid) {
        if (isSupabaseConfigured && supabase) {
          const { data: existingPayments, error: existingPaymentsError } =
            await (supabase.from("payments") as any)
              .select("id")
              .eq("invoice_id", invoiceId)
              .order("created_at", { ascending: false })
              .limit(1);

          if (existingPaymentsError) {
            throw existingPaymentsError;
          }

          const latestPaymentId =
            (existingPayments?.[0]?.id as string | undefined) ?? null;
          const paymentPayload = {
            amount: total,
            method: paymentType,
            reference_number: referenceNumber || null,
            received_by: profile?.id || null,
          };

          if (latestPaymentId) {
            const { error: paymentUpdateError } = await (
              supabase.from("payments") as any
            )
              .update(paymentPayload)
              .eq("id", latestPaymentId);

            if (paymentUpdateError) {
              throw paymentUpdateError;
            }
          } else {
            const { error: paymentInsertError } = await (
              supabase.from("payments") as any
            ).insert({
              invoice_id: invoiceId,
              ...paymentPayload,
            });

            if (paymentInsertError) {
              throw paymentInsertError;
            }
          }

          // Mark linked lab orders as paid
          for (const item of values.items) {
            if (
              item.category === "laboratory" &&
              item.referenceType === "lab_order" &&
              item.referenceId
            ) {
              try {
                await labRequestService.markRequestAsPaid(
                  item.referenceId,
                  updatedInvoice.invoiceNumber,
                );
              } catch (err) {
                console.error("Failed to mark lab request paid:", err);
              }
            }
          }
        } else {
          upsertLatestPaymentRecord({
            invoiceId,
            amount: total,
            method: paymentType as Payment["method"],
            referenceNumber,
            receivedBy: profile?.id || "",
          });
        }
      }

      return updatedInvoice;
    },
    onSuccess: async (updatedInvoice) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
      await queryClient.invalidateQueries({
        queryKey: ["payments", updatedInvoice.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["patient-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["lab-queue"] });
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
    mutationFn: async ({
      values,
      profile,
      labServiceOptions,
      patients,
    }: {
      values: PayForServiceFormValues;
      profile: any;
      labServiceOptions: LabServiceOption[];
      patients: any[];
    }) => {
      if (!profile?.id) {
        throw new Error("You must be signed in to record a paid lab service.");
      }

      const selectedService =
        labServiceOptions.find((service) => service.id === values.serviceId) ??
        null;
      if (!selectedService) {
        throw new Error("The selected laboratory service could not be found.");
      }

      const amount = Number(selectedService.serviceFee ?? 0);
      if (amount <= 0) {
        throw new Error(
          "The selected laboratory service does not have a valid service fee yet.",
        );
      }

      const patient =
        patients.find((entry) => entry.id === values.patientId) ?? null;
      let createdInvoice: Invoice | null = null;

      try {
        // Get existing invoices to generate sequential invoice number
        const existingInvoices =
          queryClient.getQueryData<Invoice[]>(queryKeys.invoices) ?? [];
        const invoiceNumber = generateInvoiceNumber(existingInvoices);

        createdInvoice = await createInvoiceLiveOrDemo(
          {
            patientId: values.patientId,
            appointmentId: null,
            invoiceNumber,
            paymentStatus: "paid",
            subtotal: amount,
            total: amount,
          },
          [
            {
              description: selectedService.name,
              quantity: 1,
              unitPrice: amount,
              category: "laboratory",
            },
          ],
        );

        let request: LabRequestRecord;
        if (!isSupabaseConfigured || !supabase) {
          const { createLabOrder } = await import("../../../lib/local-db");
          const order = createLabOrder({
            patientId: values.patientId,
            appointmentId: null,
            labServiceId: selectedService.id,
            requestedBy: profile.id,
            status: "requested",
            notes: values.notes?.trim() || "",
            urgentFlag: values.urgentFlag,
            schedDate: null,
            schedTime: null,
          });

          request = {
            id: order.id,
            clinicId: "",
            clinicName: null,
            appointmentId: null,
            patientId: values.patientId,
            patientName: patient
              ? `${patient.firstName} ${patient.lastName}`
              : null,
            requestedBy: profile.id,
            requestedByName: profile.fullName,
            serviceId: selectedService.id,
            serviceName: selectedService.name,
            serviceCategory: selectedService.category,
            department: "Laboratory",
            transactionType: "cashier_paid_service",
            paymentStatus: "paid",
            receiptCode: createdInvoice.invoiceNumber,
            status: "pending",
            sampleStatus: "pending",
            resultStatus: "pending",
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
            patientNotes: values.notes?.trim() || "",
            urgentFlag: values.urgentFlag,
            transactionType: "cashier_paid_service",
          });

          if (!createdRequest) {
            throw new Error("The lab request was not returned after payment.");
          }

          request =
            (await labRequestService.markRequestAsPaid(
              createdRequest.id,
              createdRequest.receiptCode ?? null,
            )) ?? createdRequest;
        }

        return {
          invoice: createdInvoice,
          request,
          patientName: patient
            ? `${patient.firstName} ${patient.lastName}`
            : "Patient",
        };
      } catch (error) {
        if (createdInvoice) {
          await deleteInvoiceLiveOrDemo(createdInvoice.id).catch(
            () => undefined,
          );
        }
        throw error;
      }
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
      await queryClient.invalidateQueries({ queryKey: ["lab-queue"] });
      await queryClient.invalidateQueries({
        queryKey: ["lab-request", result.request.id],
      });
      // Note: setLabReceiptState needs to be handled in the component
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      paymentType,
      referenceNumber,
      profile,
    }: {
      invoiceId: string;
      paymentType: string;
      referenceNumber?: string;
      profile: any;
    }) => {
      // Get current invoice data
      const invoices =
        queryClient.getQueryData<Invoice[]>(queryKeys.invoices) ?? [];
      const invoiceItems =
        queryClient.getQueryData<InvoiceItem[]>(queryKeys.invoiceItems) ?? [];

      const currentInvoice = invoices.find((inv) => inv.id === invoiceId);
      const currentItems = invoiceItems.filter(
        (item) => item.invoiceId === invoiceId,
      );

      if (!currentInvoice) {
        throw new Error("Invoice not found");
      }

      // Update only the payment status
      const updatedInvoice = {
        ...currentInvoice,
        paymentStatus: "paid" as const,
      };

      const updatedItems = currentItems.map((item) => ({
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        referenceId: item.referenceId ?? null,
        referenceType: item.referenceType ?? null,
      }));

      // Update the invoice status
      await updateInvoiceLiveOrDemo(invoiceId, updatedInvoice, updatedItems);

      // Create payment record
      if (isSupabaseConfigured && supabase) {
        const { error: paymentError } = await (
          supabase.from("payments") as any
        ).insert({
          invoice_id: invoiceId,
          amount: currentInvoice.total,
          method: paymentType,
          reference_number: referenceNumber || null,
          received_by: profile?.id || null,
        });

        if (paymentError) {
          console.error("Failed to create payment record:", paymentError);
          // Don't throw here - invoice is already updated
        }
      } else {
        createPaymentRecord({
          invoiceId,
          amount: currentInvoice.total,
          method: paymentType as Payment["method"],
          referenceNumber: referenceNumber || "",
          receivedBy: profile?.id || "",
        });
      }

      return updatedInvoice;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}
