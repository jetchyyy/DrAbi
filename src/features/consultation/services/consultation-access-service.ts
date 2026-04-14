import type { Appointment, Booking, Invoice } from '../../../types/domain';
import {
  getLatestInvoiceByPatientIdLiveOrDemo,
  listAppointmentsByPatientIdLiveOrDemo,
  listBookingsByPatientIdLiveOrDemo,
  updateAppointmentStatusAndNotesLiveOrDemo,
} from '../../../lib/supabase-clinic';
import { appointmentService } from './appointment-service';

export type ConsultationAccessFailureReason =
  | 'unpaid_balance'
  | 'no_invoice'
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

async function syncAppointmentAfterPaidValidation(patientId: string) {
  const [appointments, bookings] = await Promise.all([
    listAppointmentsByPatientIdLiveOrDemo(patientId),
    listBookingsByPatientIdLiveOrDemo(patientId),
  ]);

  const linkedAppointmentId = getLatestLinkedBookingAppointmentId(bookings);
  if (linkedAppointmentId) {
    const linkedAppointment = appointments.find((appointment) => appointment.id === linkedAppointmentId)
      ?? (await appointmentService.getAppointmentById(linkedAppointmentId));

    if (linkedAppointment) {
      const intakeNotes = getLatestIntakeNotes(bookings);
      const nextNotes = composeAppointmentNotes(linkedAppointment.notes ?? '', intakeNotes);
      const nextStatus = getNextAppointmentStatus(linkedAppointment.status);

      await updateAppointmentStatusAndNotesLiveOrDemo({
        appointmentId: linkedAppointment.id,
        status: nextStatus,
        notes: nextNotes,
      });

      return {
        appointmentId: linkedAppointment.id,
        intakeNotesApplied: Boolean(intakeNotes),
        message: 'Payment validated. Appointment is ready for SOAP documentation.',
      };
    }
  }

  const appointment = getLatestOpenAppointment(appointments);
  if (!appointment) {
    return {
      appointmentId: null,
      intakeNotesApplied: false,
      message:
        'Payment validated, but no open appointment was found to mark as confirmed.',
    };
  }

  const intakeNotes = getLatestIntakeNotes(bookings);
  const nextNotes = composeAppointmentNotes(appointment.notes ?? '', intakeNotes);
  const nextStatus = getNextAppointmentStatus(appointment.status);

  await updateAppointmentStatusAndNotesLiveOrDemo({
    appointmentId: appointment.id,
    status: nextStatus,
    notes: nextNotes,
  });

  return {
    appointmentId: appointment.id,
    intakeNotesApplied: Boolean(intakeNotes),
    message: 'Payment validated. Appointment is ready for SOAP documentation.',
  };
}

export async function validatePatientConsultationAccess(
  patientId: string,
): Promise<ConsultationAccessResult> {
  try {
    const latestInvoice = await getLatestInvoiceByPatientIdLiveOrDemo(patientId);

    if (!latestInvoice) {
      return {
        allowed: false,
        reason: 'no_invoice',
        latestInvoice: null,
        appointmentId: null,
        intakeNotesApplied: false,
        message:
          'Unpaid Balance. No invoice record exists for this patient yet.',
      };
    }

    if (latestInvoice.paymentStatus !== 'paid') {
      return {
        allowed: false,
        reason: 'unpaid_balance',
        latestInvoice,
        appointmentId: null,
        intakeNotesApplied: false,
        message: `Unpaid Balance. Latest invoice ${latestInvoice.invoiceNumber} is ${latestInvoice.paymentStatus}.`,
      };
    }

    const syncResult = await syncAppointmentAfterPaidValidation(patientId);

    return {
      allowed: true,
      reason: 'paid',
      latestInvoice,
      appointmentId: syncResult.appointmentId,
      intakeNotesApplied: syncResult.intakeNotesApplied,
      message: syncResult.message,
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
