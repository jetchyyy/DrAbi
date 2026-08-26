import type { Appointment, Booking, Invoice } from '../../../types/domain';
import {
  getPatientByIdLiveOrDemo,
  getLatestInvoiceByPatientIdLiveOrDemo,
  listAppointmentsByPatientIdLiveOrDemo,
  listBookingsByPatientIdLiveOrDemo,
  updateAppointmentStatusAndNotesLiveOrDemo,
} from '../../../lib/supabase-clinic';
import { appointmentService } from './appointment-service';

export type ConsultationAccessFailureReason =
  | 'unpaid_balance'
  | 'no_invoice'
  | 'missing_vitals'
  | 'query_error';

export interface ConsultationAccessResult {
  allowed: boolean;
  reason: 'paid' | ConsultationAccessFailureReason;
  latestInvoice: Invoice | null;
  appointmentId: string | null;
  intakeNotesApplied: boolean;
  message: string;
}

const OPEN_APPOINTMENT_STATUSES: Appointment['status'][] = [
  'scheduled',
  'confirmed',
  'in_progress',
];

function getLatestOpenAppointment(
  appointments: Appointment[],
): Appointment | null {
  const openAppointments = appointments
    .filter((appointment) =>
      OPEN_APPOINTMENT_STATUSES.includes(appointment.status),
    )
    .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt));

  return openAppointments[0] ?? null;
}

/**
 * Get today's soonest appointment for invoice validation.
 * Returns the next upcoming appointment scheduled for today (by time).
 * This ensures we validate against the correct appointment when a patient has
 * multiple appointments on the same day.
 */
function getTodaysSoonestAppointment(
  appointments: Appointment[],
): Appointment | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const inProgressAppointment = appointments.find(
    (appointment) => appointment.status === "in_progress",
  );
  if (inProgressAppointment) {
    return inProgressAppointment;
  }

  const todayAppointments = appointments
    .filter((appointment) => {
      const scheduledDate = new Date(appointment.scheduledAt);
      return (
        scheduledDate >= today &&
        scheduledDate < tomorrow &&
        !['cancelled', 'completed', 'no_show'].includes(appointment.status)
      );
    })
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));

  return todayAppointments[0] ?? null;
}

function getLatestLinkedBookingAppointmentId(bookings: Booking[]): string | null {
  const latestLinkedBooking = bookings
    .filter((booking) => booking.status !== 'cancelled' && booking.paymentStatus === 'paid' && Boolean(booking.appointmentId))
    .sort((left, right) => {
      const leftDate = `${left.preferredDate}T${left.preferredTime}`;
      const rightDate = `${right.preferredDate}T${right.preferredTime}`;
      return rightDate.localeCompare(leftDate);
    })[0];

  return latestLinkedBooking?.appointmentId ?? null;
}

function getLatestIntakeNotes(bookings: Booking[]): string {
  const latestBookingWithNotes = bookings
    .filter((booking) => booking.status !== 'cancelled' && booking.intakeNotes.trim())
    .sort((left, right) => {
      const leftDate = `${left.preferredDate}T${left.preferredTime}`;
      const rightDate = `${right.preferredDate}T${right.preferredTime}`;
      return rightDate.localeCompare(leftDate);
    })[0];

  return latestBookingWithNotes?.intakeNotes.trim() ?? '';
}

function composeAppointmentNotes(existingNotes: string, intakeNotes: string) {
  const baseNotes = existingNotes.trim();
  if (!intakeNotes) {
    return baseNotes;
  }

  if (baseNotes.includes(intakeNotes)) {
    return baseNotes;
  }

  const intakeBlock = `[QR Intake Notes]\n${intakeNotes}`;
  return baseNotes ? `${baseNotes}\n\n${intakeBlock}` : intakeBlock;
}

function getNextAppointmentStatus(
  status: Appointment['status'],
): Appointment['status'] {
  if (status === 'in_progress') {
    return status;
  }

  if (status === 'scheduled' || status === 'confirmed') {
    return 'confirmed';
  }

  return status;
}

async function resolveAppointmentForConsultation(patientId: string, invoiceAppointmentId: string | null) {
  if (invoiceAppointmentId) {
    const linkedAppointment = await appointmentService.getAppointmentById(invoiceAppointmentId);
    if (linkedAppointment) {
      return linkedAppointment;
    }
  }

  const [appointments, bookings] = await Promise.all([
    listAppointmentsByPatientIdLiveOrDemo(patientId),
    listBookingsByPatientIdLiveOrDemo(patientId),
  ]);

  const linkedAppointmentId = getLatestLinkedBookingAppointmentId(bookings);
  if (linkedAppointmentId) {
    const linkedAppointment = appointments.find((appointment) => appointment.id === linkedAppointmentId)
      ?? (await appointmentService.getAppointmentById(linkedAppointmentId));
    if (linkedAppointment) {
      return linkedAppointment;
    }
  }

  return getLatestOpenAppointment(appointments);
}

async function applyIntakeNotesAndConfirmAppointment(appointmentId: string, patientId: string) {
  const [appointment, bookings] = await Promise.all([
    appointmentService.getAppointmentById(appointmentId),
    listBookingsByPatientIdLiveOrDemo(patientId),
  ]);

  if (!appointment) {
    throw new Error('Appointment not found while finalizing intake.');
  }

  const intakeNotes = getLatestIntakeNotes(bookings);
  const nextNotes = composeAppointmentNotes(appointment.notes ?? '', intakeNotes);
  const nextStatus = getNextAppointmentStatus(appointment.status);

  await updateAppointmentStatusAndNotesLiveOrDemo({
    appointmentId: appointment.id,
    status: nextStatus,
    notes: nextNotes,
  });

  return { intakeNotesApplied: Boolean(intakeNotes) };
}

export async function validatePatientConsultationAccess(
  patientId: string,
): Promise<ConsultationAccessResult> {
  try {
    // Get today's appointments to identify the current active appointment
    const appointments = await listAppointmentsByPatientIdLiveOrDemo(patientId);
    const currentAppointment = getTodaysSoonestAppointment(appointments);

    if (!currentAppointment) {
      return {
        allowed: false,
        reason: 'no_invoice',
        latestInvoice: null,
        appointmentId: null,
        intakeNotesApplied: false,
        message:
          "No appointment found for today's session. Please schedule or select an appointment before proceeding.",
      };
    }

    // Get the invoice for this specific appointment only (no fallback).
    // This prevents old paid invoices from masking new pending ones for returning patients.
    const latestInvoice = await getLatestInvoiceByPatientIdLiveOrDemo(
      patientId,
      currentAppointment.id,
    );

    if (!latestInvoice) {
      return {
        allowed: false,
        reason: 'no_invoice',
        latestInvoice: null,
        appointmentId: null,
        intakeNotesApplied: false,
        message:
          'No invoice generated for this session. A new invoice must be created and paid before consultation can proceed.',
      };
    }

    if (latestInvoice.paymentStatus !== 'paid') {
      return {
        allowed: false,
        reason: 'unpaid_balance',
        latestInvoice,
        appointmentId: null,
        intakeNotesApplied: false,
        message: `Payment Required for today's session. Invoice ${latestInvoice.invoiceNumber} is ${latestInvoice.paymentStatus}.`,
      };
    }

    const appointment = await resolveAppointmentForConsultation(
      patientId,
      latestInvoice.appointmentId ?? currentAppointment?.id ?? null,
    );

    if (!appointment) {
      return {
        allowed: false,
        reason: 'no_invoice',
        latestInvoice,
        appointmentId: null,
        intakeNotesApplied: false,
        message:
          'Payment is already marked paid, but no open appointment was found for this patient.',
      };
    }

    const patient = await getPatientByIdLiveOrDemo(patientId);
    const bloodPressure = patient?.bloodPressure?.trim() ?? '';
    const weightValue = Number(patient?.weight ?? '');
    const hasWeight = Number.isFinite(weightValue) && weightValue > 0;

    if (!bloodPressure || !hasWeight) {
      return {
        allowed: false,
        reason: 'missing_vitals',
        latestInvoice,
        appointmentId: appointment.id,
        intakeNotesApplied: false,
        message:
          'Front Desk vitals are required before consultation. Please record blood pressure and weight in intake first.',
      };
    }

    const syncResult = await applyIntakeNotesAndConfirmAppointment(appointment.id, patientId);

    return {
      allowed: true,
      reason: 'paid',
      latestInvoice,
      appointmentId: appointment.id,
      intakeNotesApplied: syncResult.intakeNotesApplied,
      message: 'Payment and front-desk vitals verified. Appointment confirmed for consultation.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to validate payment status.';
    return {
      allowed: false,
      reason: 'query_error',
      latestInvoice: null,
      appointmentId: null,
      intakeNotesApplied: false,
      message,
    };
  }
}
