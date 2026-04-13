import { useState, useCallback, useEffect } from "react";
import { isSupabaseConfigured, supabase } from "../../../lib/supabase";

// ─── Domain Types ──────────────────────────────────────────────────────────────

export interface PatientWithReferral {
  appointmentId: string;
  patient: {
    id: string;
    fullName: string;
  };
  doctor: {
    id: string;
    fullName: string;
    specialtyName: string | null;
  };
  referralId: string;
}

export interface SpecialistSchedule {
  id: string;
  specialistId: string;
  recurrence: number[]; // 0=Mon, 6=Sun
  slotTemplate: SlotTemplate[];
  isActive: boolean;
  validFrom: string;
  practiceLocation: PracticeLocation | null;
  createdAt: string;
  updatedAt: string;
}

export interface SlotTemplate {
  start: string; // "09:00"
  end: string; // "10:00"
}

export interface PracticeLocation {
  name?: string;
  address?: string;
  [key: string]: unknown;
}

interface SpecialistScheduleRow {
  id: string;
  specialist_id: string;
  recurrence: unknown;
  slot_template: unknown;
  is_active: boolean;
  valid_from: string;
  practice_location: unknown;
  created_at: string;
  updated_at: string;
}

interface AppointmentRow {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  related_referral_id: string | null;
}

interface PatientRow {
  id: string;
  first_name: string;
  last_name: string;
}

interface ProfileRow {
  id: string;
  full_name: string;
}

interface DoctorRow {
  id: string;
  profile_id: string;
  specialty_id: string | null;
}

interface SpecialtyRow {
  id: string;
  name: string;
}

interface ReferralRow {
  id: string;
  target_doctor_id: string | null;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export interface UseReferralFrontdeskReturn {
  patients: PatientWithReferral[];
  selectedPatient: PatientWithReferral | null;
  schedules: SpecialistSchedule[];
  selectedSchedule: SpecialistSchedule | null;
  selectedDate: string;
  selectedTime: string;
  loading: boolean;
  schedulesLoading: boolean;
  bookingLoading: boolean;
  error: string | null;
  bookingError: string | null;
  bookingSuccess: boolean;
  selectPatient: (patient: PatientWithReferral) => void;
  selectSchedule: (schedule: SpecialistSchedule) => void;
  setSelectedDate: (date: string) => void;
  setSelectedTime: (time: string) => void;
  bookAppointment: () => Promise<void>;
  resetBooking: () => void;
}

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject<T>(value: unknown): T | null {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as T;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function mapScheduleRow(row: SpecialistScheduleRow): SpecialistSchedule {
  return {
    id: row.id,
    specialistId: row.specialist_id,
    recurrence: parseJsonArray<number>(row.recurrence),
    slotTemplate: parseJsonArray<SlotTemplate>(row.slot_template),
    isActive: row.is_active,
    validFrom: row.valid_from,
    practiceLocation: parseJsonObject<PracticeLocation>(row.practice_location),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function getDayNamesFromRecurrence(recurrence: number[]): string {
  return recurrence.map((d) => DAY_NAMES[d] ?? `Day ${d}`).join(", ");
}

export function useReferralFrontdesk(): UseReferralFrontdeskReturn {
  const [patients, setPatients] = useState<PatientWithReferral[]>([]);
  const [selectedPatient, setSelectedPatient] =
    useState<PatientWithReferral | null>(null);
  const [schedules, setSchedules] = useState<SpecialistSchedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] =
    useState<SpecialistSchedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // ── Fetch patients with referrals ──────────────────────────────────────────
  useEffect(() => {
    async function fetchPatients() {
      setLoading(true);
      setError(null);
      try {
        if (!isSupabaseConfigured) {
          setPatients([]);
          return;
        }
        const client = requireSupabase();

        // 1. Get appointments with related_referral_id
        const { data: apptData, error: apptError } = await client
          .from("appointments")
          .select("id, patient_id, doctor_id, related_referral_id")
          .not("related_referral_id", "is", null)
          .is("deleted_at", null);

        if (apptError) throw apptError;
        const appts = (apptData ?? []) as AppointmentRow[];
        if (appts.length === 0) {
          setPatients([]);
          return;
        }

        // 2. Collect unique IDs
        const patientIds = [...new Set(appts.map((a) => a.patient_id))];
        const referralIds = [
          ...new Set(appts.map((a) => a.related_referral_id!)),
        ];

        // 3. Fetch patients
        const { data: patientsData, error: patientsError } = await client
          .from("patients")
          .select("id, first_name, last_name")
          .in("id", patientIds);
        if (patientsError) throw patientsError;
        const patientMap = new Map(
          (patientsData ?? ([] as PatientRow[])).map((p: PatientRow) => [
            p.id,
            p,
          ]),
        );

        // 4. Fetch referrals to get target_doctor_id
        const { data: referralsData, error: referralsError } = await client
          .from("referrals")
          .select("id, target_doctor_id")
          .in("id", referralIds);
        if (referralsError) throw referralsError;
        const referralMap = new Map(
          (referralsData ?? ([] as ReferralRow[])).map((r: ReferralRow) => [
            r.id,
            r,
          ]),
        );

        // 5. Collect doctor IDs from referrals
        const doctorIds = [
          ...new Set(
            (referralsData ?? [])
              .map((r: ReferralRow) => r.target_doctor_id)
              .filter(Boolean) as string[],
          ),
        ];

        // 6. Fetch doctors
        const { data: doctorsData, error: doctorsError } = await client
          .from("doctors")
          .select("id, profile_id, specialty_id")
          .in("id", doctorIds);
        if (doctorsError) throw doctorsError;
        const doctorMap = new Map(
          (doctorsData ?? ([] as DoctorRow[])).map((d: DoctorRow) => [d.id, d]),
        );

        // 7. Fetch profiles for doctors
        const doctorProfileIds = (doctorsData ?? []).map(
          (d: DoctorRow) => d.profile_id,
        );
        const { data: profilesData, error: profilesError } = await client
          .from("profiles")
          .select("id, full_name")
          .in("id", doctorProfileIds);
        if (profilesError) throw profilesError;
        const profileMap = new Map(
          (profilesData ?? ([] as ProfileRow[])).map((p: ProfileRow) => [
            p.id,
            p,
          ]),
        );

        // 8. Fetch specialties
        const specialtyIds = [
          ...new Set(
            (doctorsData ?? [])
              .map((d: DoctorRow) => d.specialty_id)
              .filter(Boolean) as string[],
          ),
        ];
        let specialtyMap = new Map<string, string>();
        if (specialtyIds.length > 0) {
          const { data: specialtiesData, error: specialtiesError } =
            await client
              .from("specialties")
              .select("id, name")
              .in("id", specialtyIds);
          if (specialtiesError) throw specialtiesError;
          specialtyMap = new Map(
            (specialtiesData ?? ([] as SpecialtyRow[])).map(
              (s: SpecialtyRow) => [s.id, s.name],
            ),
          );
        }

        // 9. Build mapped output – dedupe by referral_id
        const seen = new Set<string>();
        const result: PatientWithReferral[] = [];

        for (const appt of appts) {
          const referralId = appt.related_referral_id!;
          if (seen.has(referralId)) continue;
          seen.add(referralId);

          const patientRow = patientMap.get(appt.patient_id);
          if (!patientRow) continue;

          const referral = referralMap.get(referralId);
          if (!referral?.target_doctor_id) continue;

          const doctor = doctorMap.get(referral.target_doctor_id);
          if (!doctor) continue;

          const doctorProfile = profileMap.get(doctor.profile_id);
          const specialtyName = doctor.specialty_id
            ? (specialtyMap.get(doctor.specialty_id) ?? null)
            : null;

          result.push({
            appointmentId: appt.id,
            patient: {
              id: patientRow.id,
              fullName:
                `${patientRow.first_name} ${patientRow.last_name}`.trim(),
            },
            doctor: {
              id: doctor.id,
              fullName: doctorProfile?.full_name ?? "Unknown Doctor",
              specialtyName,
            },
            referralId,
          });
        }

        setPatients(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load patients.",
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchPatients();
  }, []);

  // ── Fetch schedules when patient selected ─────────────────────────────────
  const selectPatient = useCallback((patient: PatientWithReferral) => {
    setSelectedPatient(patient);
    setSelectedSchedule(null);
    setSelectedDate("");
    setSelectedTime("");
    setBookingError(null);
    setBookingSuccess(false);

    async function fetchSchedules() {
      setSchedulesLoading(true);
      try {
        if (!isSupabaseConfigured) {
          setSchedules([]);
          return;
        }
        const client = requireSupabase();
        const { data, error: schedError } = await client
          .from("specialist_schedules")
          .select("*")
          .eq("specialist_id", patient.doctor.id)
          .eq("is_active", true);
        if (schedError) throw schedError;
        setSchedules(
          ((data ?? []) as SpecialistScheduleRow[]).map(mapScheduleRow),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load schedules.",
        );
      } finally {
        setSchedulesLoading(false);
      }
    }

    void fetchSchedules();
  }, []);

  const selectSchedule = useCallback((schedule: SpecialistSchedule) => {
    setSelectedSchedule(schedule);
    setSelectedDate("");
    setSelectedTime("");
    setBookingError(null);
  }, []);

  // ── Book appointment ───────────────────────────────────────────────────────
  const bookAppointment = useCallback(async () => {
    if (
      !selectedPatient ||
      !selectedSchedule ||
      !selectedDate ||
      !selectedTime
    ) {
      setBookingError("Please select a schedule, date, and time.");
      return;
    }

    setBookingLoading(true);
    setBookingError(null);

    try {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase is not configured.");
      }
      const client = requireSupabase();

      // Check for double booking
      const { data: existing, error: checkError } = await client
        .from("specialist_appointments")
        .select("id")
        .eq("schedule_id", selectedSchedule.id)
        .eq("slot_date", selectedDate)
        .eq("slot_time", selectedTime)
        .eq("is_booked", true)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing) {
        setBookingError(
          "This slot is already booked. Please choose another time.",
        );
        return;
      }

      const now = new Date().toISOString();

      // Step 1: Update referral
      const { error: referralError } = await client
        .from("referrals")
        .update({
          appointment_date: selectedDate,
          appointment_time: selectedTime,
        } as never)
        .eq("id", selectedPatient.referralId);

      if (referralError) throw referralError;

      // Step 2: Insert specialist appointment
      const { error: insertError } = await client
        .from("specialist_appointments")
        .insert({
          specialist_id: selectedPatient.doctor.id,
          schedule_id: selectedSchedule.id,
          referral_id: selectedPatient.referralId,
          patient_id: selectedPatient.patient.id,
          slot_date: selectedDate,
          slot_time: selectedTime,
          is_booked: true,
          status: "pending",
          created_at: now,
          updated_at: now,
        } as never);

      if (insertError) throw insertError;

      setBookingSuccess(true);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Booking failed.");
    } finally {
      setBookingLoading(false);
    }
  }, [selectedPatient, selectedSchedule, selectedDate, selectedTime]);

  const resetBooking = useCallback(() => {
    setSelectedPatient(null);
    setSelectedSchedule(null);
    setSelectedDate("");
    setSelectedTime("");
    setBookingError(null);
    setBookingSuccess(false);
    setSchedules([]);
  }, []);

  return {
    patients,
    selectedPatient,
    schedules,
    selectedSchedule,
    selectedDate,
    selectedTime,
    loading,
    schedulesLoading,
    bookingLoading,
    error,
    bookingError,
    bookingSuccess,
    selectPatient,
    selectSchedule,
    setSelectedDate,
    setSelectedTime,
    bookAppointment,
    resetBooking,
  };
}
