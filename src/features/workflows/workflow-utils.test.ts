import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDoctorWorkflowRows,
  buildFrontDeskWorkflowRows,
} from "./workflow-utils.ts";
import type { Appointment, Booking, Invoice, Patient } from "../../types/domain.ts";

const patient: Patient = {
  id: "patient-1",
  userId: null,
  qrCode: "QR-001",
  intakeSource: "staff_walk_in",
  visitStatus: "visited_clinic",
  firstName: "Mara",
  lastName: "Santos",
  sex: "female",
  birthDate: "1998-01-01",
  mobileNumber: "09170000000",
  email: "mara@example.com",
  address: "Manila",
  bloodType: "O+",
  allergies: "None",
  medicalHistory: "None",
  emergencyContactName: "Ana Santos",
  emergencyContactPhone: "09171111111",
  temperature: "36.8",
  bloodPressure: "120/80",
  heartRate: "76",
  o2Sat: "99",
  respiratoryRate: "16",
  weight: "55",
  height: "160",
  vitalsRecordedAt: "2026-05-10T01:00:00.000Z",
  createdAt: "2026-05-10T00:00:00.000Z",
  updatedAt: "2026-05-10T00:00:00.000Z",
};

const appointment: Appointment = {
  id: "appointment-1",
  patientId: patient.id,
  doctorId: "doctor-1",
  specialtyId: "specialty-1",
  serviceId: "service-1",
  bookingId: "booking-1",
  scheduledAt: "2026-05-10T02:00:00.000Z",
  status: "confirmed",
  source: "internal",
  visitType: "in_person",
  reason: "Consultation",
  notes: "",
  createdAt: "2026-05-10T00:00:00.000Z",
  updatedAt: "2026-05-10T00:00:00.000Z",
};

const paidInvoice: Invoice = {
  id: "invoice-1",
  patientId: patient.id,
  appointmentId: appointment.id,
  invoiceNumber: "INV-001",
  paymentStatus: "paid",
  subtotal: 500,
  total: 500,
  createdAt: "2026-05-10T00:05:00.000Z",
  updatedAt: "2026-05-10T00:05:00.000Z",
};

const booking: Booking = {
  id: "booking-1",
  patientId: patient.id,
  serviceId: "service-1",
  doctorId: "doctor-1",
  appointmentId: appointment.id,
  preferredDate: "2026-05-10",
  preferredTime: "10:00",
  status: "confirmed",
  intakeNotes: "Initial visit",
  feeType: "consultation",
  feeAmount: 500,
  receiptCode: "BOOK-001",
  paymentStatus: "paid",
  createdAt: "2026-05-10T00:00:00.000Z",
  updatedAt: "2026-05-10T00:00:00.000Z",
};

describe("workflow utils", () => {
  it("marks front desk rows as ready when today's appointment is paid and vitals exist", () => {
    const rows = buildFrontDeskWorkflowRows({
      appointments: [appointment],
      bookings: [booking],
      invoices: [paidInvoice],
      patients: [patient],
      todayDateKey: "2026-05-10",
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.patientName, "Mara Santos");
    assert.equal(rows[0]?.paymentState, "paid");
    assert.equal(rows[0]?.workflowState, "ready_for_doctor");
  });

  it("only lets doctors start cleared appointments assigned to them", () => {
    const rows = buildDoctorWorkflowRows({
      appointments: [appointment],
      invoices: [paidInvoice],
      patients: [patient],
      todayDateKey: "2026-05-10",
      doctorId: "doctor-1",
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.canStartConsultation, true);
    assert.equal(rows[0]?.blockingReason, null);
  });
});
