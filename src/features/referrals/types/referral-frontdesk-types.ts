// ─── Specialist Schedules (from specialist_schedules table) ───────────────────

export interface SpecialistScheduleRow {
  id: string;
  specialist_id: string;
  recurrence: number[]; // 0=Mon … 6=Sun
  slot_template: SlotTemplate[];
  is_active: boolean;
  valid_from: string | null;
  practice_location: PracticeLocation | null;
  created_at: string;
  updated_at: string;
}

export interface SlotTemplate {
  start: string; // "09:00"
  end: string; // "10:00"
}

export interface PracticeLocation {
  name?: string;
  address?: string;
}

// ─── Specialist Appointments (from specialist_appointments table) ─────────────

export interface SpecialistAppointmentInsert {
  specialist_id: string;
  schedule_id: string;
  referral_id: string;
  patient_id: string;
  slot_date: string; // "YYYY-MM-DD"
  slot_time: string; // "HH:MM"
  is_booked: boolean;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

// ─── Domain models used inside the hook / UI ─────────────────────────────────

export interface ReferralPatientItem {
  /** appointments.id */
  appointmentId: string;
  /** referrals.id – the related referral */
  referralId: string;
  patient: {
    id: string; // patients.id
    fullName: string;
  };
  doctor: {
    id: string; // doctors.id
    fullName: string;
    specialtyName: string;
  };
  /** doctors.id == appointments.doctor_id (target specialist) */
  targetDoctorId: string;
}

export interface SpecialistSchedule {
  id: string;
  specialistId: string;
  recurrence: number[];
  slotTemplate: SlotTemplate[];
  isActive: boolean;
  validFrom: string | null;
  practiceLocation: PracticeLocation | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingPayload {
  referralId: string;
  specialistId: string;
  scheduleId: string;
  patientId: string;
  selectedDate: string; // "YYYY-MM-DD"
  selectedTime: string; // "HH:MM"
}

export const DAY_LABELS: Record<number, string> = {
  0: "Monday",
  1: "Tuesday",
  2: "Wednesday",
  3: "Thursday",
  4: "Friday",
  5: "Saturday",
  6: "Sunday",
};
