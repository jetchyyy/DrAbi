import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreditCard,
  Printer,
  ReceiptText,
  Save,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormField } from "../../components/forms/form-field";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { formatCurrency } from "../../lib/utils";
import { useAuth } from "../auth/auth-context";
import {
  useBookings,
  useCreateInvoice,
  useInvoices,
  useInvoiceItems,
  usePaymentsForInvoice,
  useUpdateInvoice,
  useUpdatePayment,
} from "../billing/api/billing-mutations";
import { PaymentUpdateModal } from "../billing/components/payment-update-modal";
import { buildBillingReceiptPrintDocument } from "../billing/lib/billing-receipt-print-document";
import { PaymentBadge } from "../billing/payment-badge";
import {
  billingSchema,
  type BillingFormValues,
} from "../billing/types/forms";
import { useAppointments } from "../appointments/hooks/use-appointments";
import { usePatients, useUpdatePatient } from "../patients/hooks/use-patients";
import { printHtmlDocument } from "../../lib/print";
import {
  getDoctorDirectoryLiveOrDemo,
  listConsultationsByPatientIdLiveOrDemo,
} from "../../lib/supabase-clinic";
import type { Invoice, Patient } from "../../types/domain";

import type { FrontDeskWorkflowRow } from "./workflow-utils";

const patientDetailsSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters."),
  lastName: z.string().min(2, "Last name must be at least 2 characters."),
  sex: z.enum(["male", "female", "other"]),
  birthDate: z.string().min(1, "Birth date is required."),
  mobileNumber: z.string().min(5, "Mobile number must be at least 5 digits."),
  email: z.string().email("Enter a valid email address."),
  address: z.string().min(4, "Address must be at least 4 characters."),
  bloodType: z.string().min(1, "Blood type is required."),
  allergies: z.string().min(1, "Allergies field is required."),
  medicalHistory: z.string().min(1, "Medical history field is required."),
  emergencyContactName: z
    .string()
    .min(2, "Emergency contact name must be at least 2 characters."),
  emergencyContactPhone: z
    .string()
    .min(5, "Emergency contact phone must be at least 5 digits."),
  temperature: z.string().optional(),
  bloodPressure: z.string().optional(),
  heartRate: z.string().optional(),
  o2Sat: z.string().optional(),
  respiratoryRate: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
});

type PatientDetailsFormValues = z.infer<typeof patientDetailsSchema>;

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
};

interface FrontDeskPatientDetailsModalProps {
  open: boolean;
  row: FrontDeskWorkflowRow | null;
  onClose: () => void;
}

function formatDoctorSignatureName(
  doctorName: string | null | undefined,
  postNominals?: string | null,
) {
  const baseName = (doctorName ?? "")
    .trim()
    .replace(/^dr\.?\s+/i, "")
    .trim();
  if (!baseName) {
    return "N/A";
  }

  const suffix = (postNominals ?? "")
    .trim()
    .replace(/^,\s*/, "")
    .replace(/^dr\.?\s+/i, "");

  return suffix ? `${baseName}, ${suffix}` : baseName;
}

async function resolveLatestDoctorAssignedName(patientId: string) {
  if (!patientId) {
    return "N/A";
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
      return "N/A";
    }

    if (latestConsultation.doctorId) {
      const matchedDoctor = doctors.find(
        (doctor) => doctor.id === latestConsultation.doctorId,
      );
      return formatDoctorSignatureName(
        matchedDoctor?.fullName ?? latestConsultation.providerName,
        matchedDoctor?.title ?? null,
      );
    }

    if (latestConsultation.providerName) {
      return formatDoctorSignatureName(latestConsultation.providerName);
    }

    return "N/A";
  } catch {
    return "N/A";
  }
}

function hasVitals(values: PatientDetailsFormValues) {
  return Boolean(
    values.temperature ||
      values.bloodPressure ||
      values.heartRate ||
      values.o2Sat ||
      values.respiratoryRate ||
      values.weight ||
      values.height,
  );
}

function mapPaymentTypeForBilling(
  method: string | undefined,
): "cash" | "gcash" | "card" {
  if (method === "gcash" || method === "ewallet") {
    return "gcash";
  }

  if (method === "card") {
    return "card";
  }

  return "cash";
}

function buildDefaultInvoiceItem(reason: string | undefined) {
  const cleanReason = reason?.trim() ?? "";
  return {
    description: cleanReason ? `Consultation - ${cleanReason}` : "General Consultation",
    category: "consultation" as const,
    quantity: 1,
    unitPrice: 800,
  };
}

function ReceiptPrintModal({
  open,
  receipt,
  onClose,
  onPrint,
  onSavePdf,
}: {
  open: boolean;
  receipt: InvoiceReceiptState | null;
  onClose: () => void;
  onPrint: () => void;
  onSavePdf: () => void;
}) {
  if (!open || !receipt) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-lg overflow-hidden border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 bg-emerald-700 px-5 py-4 text-white">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-100">
              Receipt Ready
            </p>
            <p className="mt-1 text-sm font-bold">{receipt.invoiceNumber}</p>
          </div>
          <button
            aria-label="Close receipt modal"
            className="inline-flex items-center justify-center border border-white/35 bg-white/10 p-2 transition hover:bg-white/20"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <p>
              Patient: <span className="font-semibold text-slate-900">{receipt.customerName}</span>
            </p>
            <p>
              Payment: <span className="font-semibold text-slate-900">{receipt.paymentMethod}</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
              Total
            </p>
            <p className="mt-1 text-xl font-extrabold text-slate-950">
              {formatCurrency(receipt.total)}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="secondary">
            Close
          </Button>
          <Button onClick={onSavePdf} type="button" variant="secondary">
            Save as PDF
          </Button>
          <Button className="gap-2" onClick={onPrint} type="button">
            <Printer className="size-4" />
            Print receipt
          </Button>
        </div>
      </div>
    </div>
  );
}

function buildPatientUpdatePayload(
  patient: Patient,
  values: PatientDetailsFormValues,
): Omit<Patient, "id" | "createdAt" | "updatedAt"> {
  return {
    userId: patient.userId ?? null,
    qrCode: patient.qrCode,
    intakeSource: patient.intakeSource,
    visitStatus: patient.visitStatus,
    lastClinicVisitAt: patient.lastClinicVisitAt ?? null,
    firstName: values.firstName,
    lastName: values.lastName,
    sex: values.sex,
    birthDate: values.birthDate,
    mobileNumber: values.mobileNumber,
    email: values.email,
    address: values.address,
    bloodType: values.bloodType,
    allergies: values.allergies,
    medicalHistory: values.medicalHistory,
    emergencyContactName: values.emergencyContactName,
    emergencyContactPhone: values.emergencyContactPhone,
    temperature: values.temperature,
    bloodPressure: values.bloodPressure,
    heartRate: values.heartRate,
    o2Sat: values.o2Sat,
    respiratoryRate: values.respiratoryRate,
    weight: values.weight,
    height: values.height,
    vitalsRecordedAt: hasVitals(values)
      ? new Date().toISOString()
      : patient.vitalsRecordedAt ?? null,
  };
}

function mapPatientToFormValues(patient: Patient): PatientDetailsFormValues {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    sex: patient.sex,
    birthDate: patient.birthDate,
    mobileNumber: patient.mobileNumber,
    email: patient.email,
    address: patient.address,
    bloodType: patient.bloodType,
    allergies: patient.allergies,
    medicalHistory: patient.medicalHistory,
    emergencyContactName: patient.emergencyContactName,
    emergencyContactPhone: patient.emergencyContactPhone,
    temperature: patient.temperature ?? "",
    bloodPressure: patient.bloodPressure ?? "",
    heartRate: patient.heartRate ?? "",
    o2Sat: patient.o2Sat ?? "",
    respiratoryRate: patient.respiratoryRate ?? "",
    weight: patient.weight ?? "",
    height: patient.height ?? "",
  };
}

function displayOrFallback(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : "N/A";
}

function formatBirthDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function FrontDeskPatientDetailsModal({
  open,
  row,
  onClose,
}: FrontDeskPatientDetailsModalProps) {
  const { profile } = useAuth();
  const { data: patients = [] } = usePatients();
  const { data: appointments = [] } = useAppointments();
  const { data: bookings = [] } = useBookings();
  const { data: invoices = [] } = useInvoices();
  const { data: invoiceItems = [] } = useInvoiceItems();
  const updatePatient = useUpdatePatient();
  const createInvoiceMutation = useCreateInvoice();
  const updateInvoiceMutation = useUpdateInvoice();
  const updatePaymentMutation = useUpdatePayment();

  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [isPaymentUpdateModalOpen, setIsPaymentUpdateModalOpen] = useState(false);
  const [invoiceReceiptState, setInvoiceReceiptState] = useState<InvoiceReceiptState | null>(
    null,
  );
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isEditingPatientInfo, setIsEditingPatientInfo] = useState(false);

  const patient = useMemo(
    () => patients.find((entry) => entry.id === row?.patientId) ?? null,
    [patients, row?.patientId],
  );

  const appointment = useMemo(
    () => appointments.find((entry) => entry.id === row?.appointmentId) ?? null,
    [appointments, row?.appointmentId],
  );

  const patientInvoices = useMemo(() => {
    if (!row) return [];

    return invoices
      .filter(
        (invoice) =>
          invoice.patientId === row.patientId ||
          invoice.appointmentId === row.appointmentId,
      )
      .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [invoices, row]);

  const defaultInvoice = useMemo(() => {
    if (!row) return null;

    const linkedInvoice = patientInvoices.find(
      (invoice) => invoice.appointmentId === row.appointmentId,
    );

    if (linkedInvoice) {
      return linkedInvoice;
    }

    if (row.invoiceId) {
      return invoices.find((invoice) => invoice.id === row.invoiceId) ?? null;
    }

    return patientInvoices[0] ?? null;
  }, [invoices, patientInvoices, row]);

  const activeInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === activeInvoiceId) ?? null,
    [activeInvoiceId, invoices],
  );

  const { data: paymentsForActiveInvoice = [] } = usePaymentsForInvoice(
    activeInvoice?.id ?? "",
  );

  const activeInvoiceItems = useMemo(() => {
    if (!activeInvoice) return [];
    return invoiceItems.filter((entry) => entry.invoiceId === activeInvoice.id);
  }, [activeInvoice, invoiceItems]);

  const patientBookings = useMemo(() => {
    if (!row) return [];
    return bookings.filter((booking) => booking.patientId === row.patientId);
  }, [bookings, row]);

  const patientForm = useForm<PatientDetailsFormValues>({
    resolver: zodResolver(patientDetailsSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      sex: "female",
      birthDate: "",
      mobileNumber: "",
      email: "",
      address: "",
      bloodType: "",
      allergies: "None reported",
      medicalHistory: "No significant medical history yet",
      emergencyContactName: "",
      emergencyContactPhone: "",
      temperature: "",
      bloodPressure: "",
      heartRate: "",
      o2Sat: "",
      respiratoryRate: "",
      weight: "",
      height: "",
    },
  });

  const billingForm = useForm<BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      patientId: "",
      bookingId: "",
      appointmentId: "",
      paymentStatus: "unpaid",
      paymentType: "cash",
      referenceNumber: "",
      items: [buildDefaultInvoiceItem(appointment?.reason)],
    },
  });

  const billingItems = useFieldArray({
    control: billingForm.control,
    name: "items",
  });

  const billingPaymentStatus = billingForm.watch("paymentStatus");
  const billingPaymentType = billingForm.watch("paymentType");
  const billingLineItems = billingForm.watch("items");
  const billingTotal = useMemo(
    () =>
      billingLineItems.reduce(
        (sum, item) => sum + (item.quantity ?? 0) * (item.unitPrice ?? 0),
        0,
      ),
    [billingLineItems],
  );

  useEffect(() => {
    if (!open) {
      setActiveInvoiceId(null);
      setIsPaymentUpdateModalOpen(false);
      setInvoiceReceiptState(null);
      setIsReceiptModalOpen(false);
      setIsEditingPatientInfo(false);
      return;
    }

    setActiveInvoiceId(defaultInvoice?.id ?? null);
    setIsEditingPatientInfo(false);
  }, [defaultInvoice?.id, open]);

  useEffect(() => {
    if (!open || !row || !patient) {
      return;
    }

    patientForm.reset(mapPatientToFormValues(patient));

    const latestPayment = paymentsForActiveInvoice[0] ?? null;
    const mappedPaymentType = mapPaymentTypeForBilling(latestPayment?.method);
    const itemDefaults =
      activeInvoiceItems.length > 0
        ? activeInvoiceItems.map((item) => ({
            description: item.description,
            category: item.category,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }))
        : [buildDefaultInvoiceItem(appointment?.reason)];

    billingForm.reset({
      patientId: row.patientId,
      bookingId: row.bookingId ?? "",
      appointmentId: row.appointmentId,
      paymentStatus: activeInvoice?.paymentStatus === "paid" ? "paid" : "unpaid",
      paymentType: mappedPaymentType,
      referenceNumber:
        activeInvoice?.paymentStatus === "paid"
          ? latestPayment?.referenceNumber ?? ""
          : "",
      items: itemDefaults,
    });
  }, [
    activeInvoice?.id,
    activeInvoice?.paymentStatus,
    activeInvoiceItems,
    appointment?.reason,
    billingForm,
    open,
    patient,
    patientForm,
    paymentsForActiveInvoice,
    row,
  ]);

  useEffect(() => {
    if (billingPaymentStatus !== "paid" || billingPaymentType === "cash") {
      billingForm.setValue("referenceNumber", "");
    }
  }, [billingForm, billingPaymentStatus, billingPaymentType]);

  const openReceiptModalForInvoice = (
    invoice: Invoice,
    values: BillingFormValues,
    paymentMethodOverride?: string,
    paymentReferenceOverride?: string | null,
  ) => {
    if (!patient || !row) {
      return;
    }

    const markAsPaid = values.paymentStatus === "paid";
    const paymentMethod = paymentMethodOverride
      ? paymentMethodOverride
      : markAsPaid
        ? values.paymentType ?? "cash"
        : invoice.paymentStatus;

    const paymentReference =
      paymentReferenceOverride !== undefined
        ? paymentReferenceOverride
        : markAsPaid && values.paymentType !== "cash"
          ? values.referenceNumber?.trim() || null
          : null;

    setInvoiceReceiptState({
      patientId: row.patientId,
      invoiceNumber: invoice.invoiceNumber,
      customerName: `${patient.firstName} ${patient.lastName}`,
      doctorAssignedName: "N/A",
      receptionistName: profile?.fullName ?? "N/A",
      paymentMethod,
      paymentReference,
      issuedAt: invoice.createdAt,
      subtotal: invoice.subtotal,
      total: invoice.total,
      items: values.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      })),
    });
    setIsReceiptModalOpen(true);
  };

  const handleSavePatient = patientForm.handleSubmit(async (values) => {
    if (!patient) {
      return;
    }

    try {
      await updatePatient.mutateAsync({
        patientId: patient.id,
        payload: buildPatientUpdatePayload(patient, values),
      });
      patientForm.reset(values);
      setIsEditingPatientInfo(false);
      toast.success("Patient details updated.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update patient details.",
      );
    }
  });

  const handleStartPatientEdit = () => {
    if (!patient) {
      return;
    }

    patientForm.reset(mapPatientToFormValues(patient));
    setIsEditingPatientInfo(true);
  };

  const handleCancelPatientEdit = () => {
    if (!patient) {
      return;
    }

    patientForm.reset(mapPatientToFormValues(patient));
    setIsEditingPatientInfo(false);
  };

  const handleSaveBilling = billingForm.handleSubmit(async (values) => {
    if (!row) {
      return;
    }

    const normalizedValues: BillingFormValues = {
      ...values,
      patientId: row.patientId,
      bookingId: values.bookingId ?? row.bookingId ?? "",
      appointmentId: row.appointmentId,
      referenceNumber: values.referenceNumber ?? "",
    };

    try {
      if (activeInvoice) {
        const updatedInvoice = await updateInvoiceMutation.mutateAsync({
          invoiceId: activeInvoice.id,
          values: normalizedValues,
          bookings,
          invoices,
          profile,
        });
        billingForm.reset(normalizedValues);
        toast.success("Billing details updated.");
        openReceiptModalForInvoice(updatedInvoice, normalizedValues);
        return;
      }

      const createdInvoice = await createInvoiceMutation.mutateAsync({
        values: normalizedValues,
        bookings,
        profile,
      });
      billingForm.reset(normalizedValues);
      toast.success("Invoice created from Front Desk details.");
      setActiveInvoiceId(createdInvoice.id);
      openReceiptModalForInvoice(createdInvoice, normalizedValues);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save billing details.",
      );
    }
  });

  const handleMarkInvoicePaid = async (
    paymentType: string,
    referenceNumber: string,
  ) => {
    if (!activeInvoice) {
      toast.error("No invoice selected for payment update.");
      return;
    }

    try {
      await updatePaymentMutation.mutateAsync({
        invoiceId: activeInvoice.id,
        paymentType,
        referenceNumber,
        profile,
      });
      setIsPaymentUpdateModalOpen(false);
      toast.success("Payment status updated successfully.");

      const billingValues = billingForm.getValues();
      const mappedType = mapPaymentTypeForBilling(paymentType);
      const receiptValues: BillingFormValues = {
        ...billingValues,
        paymentStatus: "paid",
        paymentType: mappedType,
        referenceNumber: mappedType === "cash" ? "" : referenceNumber,
      };

      billingForm.setValue("paymentStatus", "paid", {
        shouldDirty: true,
        shouldValidate: true,
      });
      billingForm.setValue("paymentType", mappedType, {
        shouldDirty: true,
        shouldValidate: true,
      });
      billingForm.setValue(
        "referenceNumber",
        mappedType === "cash" ? "" : referenceNumber,
        { shouldDirty: true, shouldValidate: true },
      );

      openReceiptModalForInvoice(
        {
          ...activeInvoice,
          paymentStatus: "paid",
        },
        receiptValues,
        paymentType,
        referenceNumber || null,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update payment status.",
      );
    }
  };

  const handleOpenCurrentInvoiceReceipt = () => {
    if (!activeInvoice) {
      toast.error("Create or save an invoice first.");
      return;
    }

    openReceiptModalForInvoice(activeInvoice, billingForm.getValues());
  };

  const handlePrintInvoiceReceipt = async () => {
    if (!invoiceReceiptState) {
      return;
    }

    try {
      const doctorAssignedName = await resolveLatestDoctorAssignedName(
        invoiceReceiptState.patientId,
      );
      await printHtmlDocument(
        buildBillingReceiptPrintDocument({
          ...invoiceReceiptState,
          doctorAssignedName,
        }),
      );
    } catch {
      toast.error("The invoice receipt could not be sent to print.");
    }
  };

  const handleSaveInvoiceReceiptAsPdf = () => {
    toast.message('When the print dialog opens, choose "Save as PDF" as destination.');
    void handlePrintInvoiceReceipt();
  };

  const requestClose = () => {
    const hasUnsavedPatientEdits =
      isEditingPatientInfo && patientForm.formState.isDirty;
    const hasUnsavedBillingEdits = billingForm.formState.isDirty;

    if (hasUnsavedPatientEdits || hasUnsavedBillingEdits) {
      const confirmed = window.confirm(
        "You have unsaved changes. Close this modal anyway?",
      );

      if (!confirmed) {
        return;
      }
    }

    onClose();
  };

  if (!open || !row || !patient) {
    return null;
  }

  return (
    <>
      <div
        aria-modal="true"
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4"
        onClick={requestClose}
        role="dialog"
      >
        <div
          className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-orange-100 bg-orange-50 px-6 py-5">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
                Front Desk Patient Details
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-slate-950">
                {patient.firstName} {patient.lastName}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Edit patient details, update billing services, clear payment, and print receipt.
              </p>
            </div>
            <button
              aria-label="Close patient details modal"
              className="inline-flex items-center justify-center border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100"
              onClick={requestClose}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-6 xl:grid-cols-2">
              <form className="space-y-5" onSubmit={handleSavePatient}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <UserRound className="size-4 text-orange-600" />
                    <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
                      Patient Information
                    </p>
                  </div>

                  {!isEditingPatientInfo ? (
                    <Button
                      className="rounded-none"
                      onClick={handleStartPatientEdit}
                      type="button"
                      variant="secondary"
                    >
                      Edit information
                    </Button>
                  ) : null}
                </div>

                {!isEditingPatientInfo ? (
                  <div className="space-y-4 border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Walk-In Unique ID
                        </p>
                        <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900">
                          {displayOrFallback(patient.uniqueLoginId)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Account Setup
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {patient.walkInAccountClaimedAt
                            ? "Completed"
                            : "Pending"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Full Name
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {patient.firstName} {patient.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Sex / Birth Date
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {patient.sex} / {formatBirthDateLabel(patient.birthDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Mobile Number
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {displayOrFallback(patient.mobileNumber)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Email
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 break-all">
                          {displayOrFallback(patient.email)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                        Address
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {displayOrFallback(patient.address)}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Blood Type
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {displayOrFallback(patient.bloodType)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Allergies
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {displayOrFallback(patient.allergies)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Medical History
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {displayOrFallback(patient.medicalHistory)}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Emergency Contact
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {displayOrFallback(patient.emergencyContactName)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Emergency Phone
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {displayOrFallback(patient.emergencyContactPhone)}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                        Vitals Snapshot
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <p className="text-xs text-slate-600">
                          Temperature: <span className="font-semibold text-slate-900">{displayOrFallback(patient.temperature)}</span>
                        </p>
                        <p className="text-xs text-slate-600">
                          BP: <span className="font-semibold text-slate-900">{displayOrFallback(patient.bloodPressure)}</span>
                        </p>
                        <p className="text-xs text-slate-600">
                          HR: <span className="font-semibold text-slate-900">{displayOrFallback(patient.heartRate)}</span>
                        </p>
                        <p className="text-xs text-slate-600">
                          O2 Sat: <span className="font-semibold text-slate-900">{displayOrFallback(patient.o2Sat)}</span>
                        </p>
                        <p className="text-xs text-slate-600">
                          RR: <span className="font-semibold text-slate-900">{displayOrFallback(patient.respiratoryRate)}</span>
                        </p>
                        <p className="text-xs text-slate-600">
                          Weight / Height: <span className="font-semibold text-slate-900">{displayOrFallback(patient.weight)} / {displayOrFallback(patient.height)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        error={patientForm.formState.errors.firstName?.message}
                        label="First Name"
                      >
                        <Input {...patientForm.register("firstName")} />
                      </FormField>
                      <FormField
                        error={patientForm.formState.errors.lastName?.message}
                        label="Last Name"
                      >
                        <Input {...patientForm.register("lastName")} />
                      </FormField>
                      <FormField
                        error={patientForm.formState.errors.sex?.message}
                        label="Sex"
                      >
                        <Select {...patientForm.register("sex")}>
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="other">Other</option>
                        </Select>
                      </FormField>
                      <FormField
                        error={patientForm.formState.errors.birthDate?.message}
                        label="Birth Date"
                      >
                        <Input type="date" {...patientForm.register("birthDate")} />
                      </FormField>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        error={patientForm.formState.errors.mobileNumber?.message}
                        label="Mobile Number"
                      >
                        <Input {...patientForm.register("mobileNumber")} />
                      </FormField>
                      <FormField
                        error={patientForm.formState.errors.email?.message}
                        label="Email"
                      >
                        <Input {...patientForm.register("email")} />
                      </FormField>
                    </div>

                    <FormField
                      error={patientForm.formState.errors.address?.message}
                      label="Address"
                    >
                      <Textarea {...patientForm.register("address")} rows={2} />
                    </FormField>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <FormField
                        error={patientForm.formState.errors.bloodType?.message}
                        label="Blood Type"
                      >
                        <Input {...patientForm.register("bloodType")} />
                      </FormField>
                      <FormField
                        error={patientForm.formState.errors.allergies?.message}
                        label="Allergies"
                      >
                        <Input {...patientForm.register("allergies")} />
                      </FormField>
                      <FormField
                        error={patientForm.formState.errors.medicalHistory?.message}
                        label="Medical History"
                      >
                        <Input {...patientForm.register("medicalHistory")} />
                      </FormField>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        error={patientForm.formState.errors.emergencyContactName?.message}
                        label="Emergency Contact"
                      >
                        <Input {...patientForm.register("emergencyContactName")} />
                      </FormField>
                      <FormField
                        error={patientForm.formState.errors.emergencyContactPhone?.message}
                        label="Emergency Contact Phone"
                      >
                        <Input {...patientForm.register("emergencyContactPhone")} />
                      </FormField>
                    </div>

                    <div>
                      <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                        Vitals
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <FormField label="Temperature">
                          <Input {...patientForm.register("temperature")} />
                        </FormField>
                        <FormField label="Blood Pressure">
                          <Input {...patientForm.register("bloodPressure")} />
                        </FormField>
                        <FormField label="Heart Rate">
                          <Input {...patientForm.register("heartRate")} />
                        </FormField>
                        <FormField label="O2 Sat">
                          <Input {...patientForm.register("o2Sat")} />
                        </FormField>
                        <FormField label="Respiratory Rate">
                          <Input {...patientForm.register("respiratoryRate")} />
                        </FormField>
                        <FormField label="Weight / Height">
                          <div className="grid grid-cols-2 gap-2">
                            <Input placeholder="Weight" {...patientForm.register("weight")} />
                            <Input placeholder="Height" {...patientForm.register("height")} />
                          </div>
                        </FormField>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                      <Button
                        className="rounded-none"
                        onClick={handleCancelPatientEdit}
                        type="button"
                        variant="secondary"
                      >
                        Cancel
                      </Button>
                      <Button
                        className="gap-2 rounded-none"
                        disabled={updatePatient.isPending}
                        type="submit"
                      >
                        <Save className="size-4" />
                        {updatePatient.isPending ? "Saving..." : "Save Patient Details"}
                      </Button>
                    </div>
                  </>
                )}
              </form>

              <form className="space-y-5" onSubmit={handleSaveBilling}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">
                      Billing and Services
                    </p>
                    {activeInvoice ? (
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {activeInvoice.invoiceNumber}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        No invoice yet for this patient queue item.
                      </p>
                    )}
                  </div>
                  {activeInvoice ? (
                    <PaymentBadge status={activeInvoice.paymentStatus} />
                  ) : null}
                </div>

                {patientBookings.length > 0 ? (
                  <FormField label="Linked Booking (optional)">
                    <Select {...billingForm.register("bookingId")}> 
                      <option value="">No booking link</option>
                      {patientBookings.map((booking) => (
                        <option key={booking.id} value={booking.id}>
                          {booking.receiptCode} - {booking.feeType ?? "consultation"}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                ) : null}

                <FormField
                  error={billingForm.formState.errors.paymentStatus?.message}
                  label="Payment Status"
                >
                  <Select {...billingForm.register("paymentStatus")}>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </Select>
                </FormField>

                {billingPaymentStatus === "paid" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      error={billingForm.formState.errors.paymentType?.message}
                      label="Payment Type"
                    >
                      <Select {...billingForm.register("paymentType")}>
                        <option value="cash">Cash</option>
                        <option value="gcash">GCash</option>
                        <option value="card">Card</option>
                      </Select>
                    </FormField>
                    {billingPaymentType !== "cash" ? (
                      <FormField
                        error={billingForm.formState.errors.referenceNumber?.message}
                        label="Reference Number"
                      >
                        <Input
                          placeholder="Enter payment reference"
                          {...billingForm.register("referenceNumber")}
                        />
                      </FormField>
                    ) : null}
                  </div>
                ) : null}

                {activeInvoice && activeInvoice.paymentStatus !== "paid" ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="text-xs text-blue-800">
                      Need a quick cashier flow? Use mark as paid and keep the existing invoice lines.
                    </p>
                    <Button
                      className="mt-2 gap-2 rounded-none"
                      onClick={() => setIsPaymentUpdateModalOpen(true)}
                      type="button"
                      variant="secondary"
                    >
                      <CreditCard className="size-4" />
                      Mark as Paid
                    </Button>
                  </div>
                ) : null}

                <div className="border-t border-slate-100 pt-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                      Additional Services / Line Items
                    </p>
                    <Button
                      className="rounded-none text-xs"
                      onClick={() =>
                        billingItems.append({
                          description: "New service",
                          category: "other",
                          quantity: 1,
                          unitPrice: 0,
                        })
                      }
                      type="button"
                      variant="secondary"
                    >
                      Add service
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {billingItems.fields.map((field, index) => (
                      <div
                        className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                        key={field.id}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900">
                            Service {index + 1}
                          </p>
                          {billingItems.fields.length > 1 ? (
                            <button
                              className="text-xs font-semibold uppercase tracking-wide text-rose-600"
                              onClick={() => billingItems.remove(index)}
                              type="button"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <FormField
                            error={
                              billingForm.formState.errors.items?.[index]?.description
                                ?.message
                            }
                            label="Description"
                          >
                            <Input
                              {...billingForm.register(
                                `items.${index}.description` as const,
                              )}
                            />
                          </FormField>
                          <FormField
                            error={
                              billingForm.formState.errors.items?.[index]?.category?.message
                            }
                            label="Category"
                          >
                            <Select
                              {...billingForm.register(`items.${index}.category` as const)}
                            >
                              <option value="consultation">Consultation</option>
                              <option value="laboratory">Laboratory</option>
                              <option value="medicine">Medicine</option>
                              <option value="other">Other</option>
                            </Select>
                          </FormField>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <FormField
                            error={
                              billingForm.formState.errors.items?.[index]?.quantity?.message
                            }
                            label="Quantity"
                          >
                            <Input
                              type="number"
                              {...billingForm.register(`items.${index}.quantity` as const, {
                                valueAsNumber: true,
                              })}
                            />
                          </FormField>
                          <FormField
                            error={
                              billingForm.formState.errors.items?.[index]?.unitPrice?.message
                            }
                            label="Unit Price"
                          >
                            <Input
                              type="number"
                              {...billingForm.register(
                                `items.${index}.unitPrice` as const,
                                {
                                  valueAsNumber: true,
                                },
                              )}
                            />
                          </FormField>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                    Invoice Total
                  </p>
                  <p className="mt-1 text-xl font-extrabold text-emerald-950">
                    {formatCurrency(billingTotal)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                  <Button
                    className="gap-2 rounded-none bg-emerald-600 hover:bg-emerald-700"
                    disabled={
                      createInvoiceMutation.isPending || updateInvoiceMutation.isPending
                    }
                    type="submit"
                  >
                    <Save className="size-4" />
                    {createInvoiceMutation.isPending || updateInvoiceMutation.isPending
                      ? "Saving..."
                      : activeInvoice
                        ? "Update Billing"
                        : "Create Invoice"}
                  </Button>
                  <Button
                    className="gap-2 rounded-none"
                    disabled={!activeInvoice}
                    onClick={handleOpenCurrentInvoiceReceipt}
                    type="button"
                    variant="secondary"
                  >
                    <ReceiptText className="size-4" />
                    Print Receipt
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <PaymentUpdateModal
        isLoading={updatePaymentMutation.isPending}
        isOpen={isPaymentUpdateModalOpen}
        onClose={() => setIsPaymentUpdateModalOpen(false)}
        onConfirm={(paymentType, referenceNumber) => {
          void handleMarkInvoicePaid(paymentType, referenceNumber);
        }}
      />

      <ReceiptPrintModal
        onClose={() => setIsReceiptModalOpen(false)}
        onPrint={() => {
          void handlePrintInvoiceReceipt();
        }}
        onSavePdf={handleSaveInvoiceReceiptAsPdf}
        open={isReceiptModalOpen}
        receipt={invoiceReceiptState}
      />
    </>
  );
}
