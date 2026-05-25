import type {
  Appointment,
  AppointmentStatus,
  Booking,
  Invoice,
  Patient,
  PaymentStatus,
  VisitType,
} from "../../types/domain";

export type WorkflowPaymentState = "paid" | "payment_needed" | "no_invoice";

export type FrontDeskWorkflowState =
  | "payment_needed"
  | "needs_vitals"
  | "ready_for_doctor"
  | "in_consultation"
  | "completed";

export type DoctorWorkflowState = "ready" | "blocked" | "in_consultation";

export interface FrontDeskWorkflowRow {
  id: string;
  patientId: string;
  patientName: string;
  patientIntakeSource: Patient["intakeSource"];
  appointmentSource: Appointment["source"];
  isWalkInPatient: boolean;
  appointmentId: string;
  bookingId: string | null;
  scheduledAt: string;
  appointmentStatus: AppointmentStatus;
  paymentState: WorkflowPaymentState;
  workflowState: FrontDeskWorkflowState;
  invoiceId: string | null;
  invoiceNumber: string | null;
  receiptCode: string | null;
  missingVitals: boolean;
  reason: string;
}

export interface DoctorWorkflowRow {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId: string;
  scheduledAt: string;
  appointmentStatus: AppointmentStatus;
  paymentState: WorkflowPaymentState;
  workflowState: DoctorWorkflowState;
  canStartConsultation: boolean;
  blockingReason: string | null;
  reason: string;
  visitType: VisitType;
}

interface FrontDeskWorkflowInput {
  appointments: Appointment[];
  bookings: Booking[];
  invoices: Invoice[];
  patients: Patient[];
  todayDateKey: string;
}

interface DoctorWorkflowInput {
  appointments: Appointment[];
  invoices: Invoice[];
  patients: Patient[];
  todayDateKey: string;
  doctorId?: string | null;
}

function getPhilippineDateKeyFromIso(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Manila",
    year: "numeric",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function isTodayAppointment(appointment: Appointment, todayDateKey: string) {
  return getPhilippineDateKeyFromIso(appointment.scheduledAt) === todayDateKey;
}

function getPatientName(patient: Patient | undefined) {
  if (!patient) return "Unknown patient";
  return `${patient.firstName} ${patient.lastName}`.trim();
}

function hasRecordedVitals(patient: Patient | undefined) {
  if (!patient) return false;
  return Boolean(
    patient.temperature ||
      patient.bloodPressure ||
      patient.heartRate ||
      patient.o2Sat ||
      patient.respiratoryRate ||
      patient.weight ||
      patient.height,
  );
}

function toPaymentState(status: PaymentStatus | undefined): WorkflowPaymentState {
  if (!status) return "no_invoice";
  return status === "paid" ? "paid" : "payment_needed";
}

function findLatestInvoice(
  appointment: Appointment,
  invoices: Invoice[],
): Invoice | undefined {
  const appointmentInvoice = invoices
    .filter((invoice) => invoice.appointmentId === appointment.id)
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (appointmentInvoice) {
    return appointmentInvoice;
  }

  return invoices
    .filter((invoice) => invoice.patientId === appointment.patientId)
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function findLinkedBooking(appointment: Appointment, bookings: Booking[]) {
  return bookings.find(
    (booking) =>
      booking.id === appointment.bookingId ||
      booking.appointmentId === appointment.id,
  );
}

function getPaymentStateForAppointment(
  appointment: Appointment,
  invoices: Invoice[],
  bookings: Booking[] = [],
): {
  invoice: Invoice | undefined;
  paymentState: WorkflowPaymentState;
  receiptCode: string | null;
} {
  const invoice = findLatestInvoice(appointment, invoices);
  const booking = findLinkedBooking(appointment, bookings);
  const invoicePaymentState = toPaymentState(invoice?.paymentStatus);

  if (invoicePaymentState !== "no_invoice") {
    return {
      invoice,
      paymentState: invoicePaymentState,
      receiptCode: booking?.receiptCode ?? null,
    };
  }

  if (booking?.paymentStatus === "paid") {
    return { invoice, paymentState: "paid" as const, receiptCode: booking.receiptCode };
  }

  if (booking?.paymentStatus === "pending_cashier") {
    return {
      invoice,
      paymentState: "payment_needed" as const,
      receiptCode: booking.receiptCode,
    };
  }

  return { invoice, paymentState: "no_invoice" as const, receiptCode: null };
}

function getFrontDeskWorkflowState(
  appointment: Appointment,
  paymentState: WorkflowPaymentState,
  missingVitals: boolean,
): FrontDeskWorkflowState {
  if (appointment.status === "completed") return "completed";
  if (paymentState !== "paid") return "payment_needed";
  if (missingVitals) return "needs_vitals";
  if (appointment.status === "in_progress") return "in_consultation";
  return "ready_for_doctor";
}

function getDoctorBlockingReason(
  appointment: Appointment,
  paymentState: WorkflowPaymentState,
  missingVitals: boolean,
) {
  if (paymentState !== "paid") return "Payment must be cleared first.";
  if (missingVitals) return "Patient vitals are missing.";
  if (appointment.status === "scheduled") {
    return "Front desk must confirm or start the appointment first.";
  }
  return null;
}

export function buildFrontDeskWorkflowRows(input: FrontDeskWorkflowInput) {
  const patientMap = new Map(input.patients.map((patient) => [patient.id, patient]));

  return input.appointments
    .filter((appointment) => isTodayAppointment(appointment, input.todayDateKey) && appointment.patientId)
    .filter(
      (appointment) =>
        appointment.status !== "cancelled" && appointment.status !== "no_show",
    )
    .toSorted((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
    .map<FrontDeskWorkflowRow>((appointment) => {
      const patient = patientMap.get(appointment.patientId!);
      const booking = findLinkedBooking(appointment, input.bookings);
      const { invoice, paymentState, receiptCode } = getPaymentStateForAppointment(
        appointment,
        input.invoices,
        input.bookings,
      );
      const missingVitals = !hasRecordedVitals(patient);

      return {
        id: appointment.id,
        appointmentId: appointment.id,
        appointmentSource: appointment.source,
        appointmentStatus: appointment.status,
        bookingId: booking?.id ?? appointment.bookingId ?? null,
        invoiceId: invoice?.id ?? null,
        invoiceNumber: invoice?.invoiceNumber ?? null,
        isWalkInPatient: patient?.intakeSource === "staff_walk_in",
        missingVitals,
        patientId: appointment.patientId!,
        patientIntakeSource: patient?.intakeSource ?? "online_registration",
        patientName: getPatientName(patient),
        paymentState,
        reason: appointment.reason,
        receiptCode,
        scheduledAt: appointment.scheduledAt,
        workflowState: getFrontDeskWorkflowState(
          appointment,
          paymentState,
          missingVitals,
        ),
      };
    });
}

export function buildDoctorWorkflowRows(input: DoctorWorkflowInput) {
  const patientMap = new Map(input.patients.map((patient) => [patient.id, patient]));

  return input.appointments
    .filter((appointment) => isTodayAppointment(appointment, input.todayDateKey) && appointment.patientId)
    .filter((appointment) =>
      input.doctorId ? appointment.doctorId === input.doctorId : true,
    )
    .filter(
      (appointment) =>
        appointment.status !== "cancelled" &&
        appointment.status !== "no_show" &&
        appointment.status !== "completed",
    )
    .toSorted((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
    .map<DoctorWorkflowRow>((appointment) => {
      const patient = patientMap.get(appointment.patientId!);
      const { paymentState } = getPaymentStateForAppointment(
        appointment,
        input.invoices,
      );
      const missingVitals = !hasRecordedVitals(patient);
      const blockingReason = getDoctorBlockingReason(
        appointment,
        paymentState,
        missingVitals,
      );
      const canStartConsultation =
        !blockingReason &&
        (appointment.status === "confirmed" || appointment.status === "in_progress");

      return {
        id: appointment.id,
        appointmentId: appointment.id,
        appointmentStatus: appointment.status,
        blockingReason,
        canStartConsultation,
        patientId: appointment.patientId!,
        patientName: getPatientName(patient),
        paymentState,
        reason: appointment.reason,
        visitType: appointment.visitType,
        scheduledAt: appointment.scheduledAt,
        workflowState:
          appointment.status === "in_progress"
            ? "in_consultation"
            : canStartConsultation
              ? "ready"
              : "blocked",
      };
    });
}
