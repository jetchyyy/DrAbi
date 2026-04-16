import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getDoctorAvailabilityByDoctorIdLiveOrDemo,
  listBlockedBookingSlotsLiveOrDemo,
} from "../../../lib/supabase-clinic";
import { isSupabaseConfigured, supabase } from "../../../lib/supabase";
import { getDatabase } from "../../../lib/local-db";
import { queryKeys } from "../../../lib/query-keys";
import type {
  BookingFeeType,
  BookingPaymentStatus,
} from "../../../types/domain";
import type { Database } from "../../../types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PatientBookingRow {
  id: string;
  patientId: string;
  patientFullName: string;
  intakeNotes: string;
  serviceId: string;
  serviceName: string;
  doctorId: string | null;
  doctorFullName: string | null;
  feeType: BookingFeeType;
  feeAmount: number;
  preferredDate: string;
  preferredTime: string;
  status: string;
  paymentStatus: BookingPaymentStatus;
  cancelledReason: string | null;
  rescheduledReason: string | null;
  receiptCode: string;
  createdAt: string;
}

export interface UpdateBookingStatusInput {
  bookingId: string;
  status: "confirmed" | "rescheduled" | "cancelled";
  cancelledReason?: string;
  rescheduledReason?: string;
  /** Required when status === "rescheduled" */
  newPreferredDate?: string;
  newPreferredTime?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapFeeType(value: string | null | undefined): BookingFeeType {
  switch (value) {
    case "consultation":
    case "follow_up":
    case "service_fee":
      return value;
    default:
      return "service_fee";
  }
}

function mapPaymentStatus(
  value: string | null | undefined,
): BookingPaymentStatus {
  return value === "paid" ? "paid" : "pending_cashier";
}

// ---------------------------------------------------------------------------
// Fetch all bookings (live + demo)
// ---------------------------------------------------------------------------

async function fetchAllPatientBookings(): Promise<PatientBookingRow[]> {
  // ── Demo mode ──────────────────────────────────────────────────────────
  if (!isSupabaseConfigured) {
    const db = getDatabase();
    return db.bookings.map((booking) => {
      const patient = db.patients.find((p) => p.id === booking.patientId);
      const doctor = booking.doctorId
        ? db.users.find((u) => u.id === booking.doctorId)
        : null;
      const service = db.services.find((s) => s.id === booking.serviceId);
      return {
        id: booking.id,
        patientId: booking.patientId,
        patientFullName: patient
          ? `${patient.firstName} ${patient.lastName}`
          : "Unknown Patient",
        intakeNotes: booking.intakeNotes,
        serviceId: booking.serviceId,
        serviceName: service?.name ?? "Service",
        doctorId: booking.doctorId || null,
        doctorFullName: doctor?.fullName ?? null,
        feeType: booking.feeType,
        feeAmount: booking.feeAmount,
        preferredDate: booking.preferredDate,
        preferredTime: booking.preferredTime,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        cancelledReason: null,
        rescheduledReason: null,
        receiptCode: booking.receiptCode,
        createdAt: booking.createdAt,
      };
    });
  }

  // ── Live mode ──────────────────────────────────────────────────────────
  const client = supabase!;

  const { data: bookings, error } = await client
    .from("bookings")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!bookings || bookings.length === 0) return [];

  type BookingRow = Database["public"]["Tables"]["bookings"]["Row"] & {
    cancelled_reason?: string | null;
    rescheduled_reason?: string | null;
  };

  const rows = bookings as BookingRow[];

  // Collect unique IDs for batch lookups
  const patientIds = [...new Set(rows.map((r) => r.patient_id))];
  const doctorIds = [
    ...new Set(rows.map((r) => r.doctor_id).filter(Boolean) as string[]),
  ];
  const serviceIds = [...new Set(rows.map((r) => r.service_id))];

  const [patientsResult, doctorsResult, servicesResult] = await Promise.all([
    client
      .from("patients")
      .select("id,first_name,last_name")
      .in("id", patientIds)
      .is("deleted_at", null),
    doctorIds.length > 0
      ? client
          .from("doctors")
          .select("id,profile_id,profiles!inner(full_name)")
          .in("id", doctorIds)
      : Promise.resolve({ data: [], error: null }),
    client
      .from("services")
      .select("id,name")
      .in("id", serviceIds)
      .is("deleted_at", null),
  ]);

  if (patientsResult.error) throw patientsResult.error;
  if (doctorsResult.error) throw doctorsResult.error;
  if (servicesResult.error) throw servicesResult.error;

  const patientMap = new Map(
    (
      patientsResult.data as Array<{
        id: string;
        first_name: string;
        last_name: string;
      }>
    ).map((p) => [p.id, `${p.first_name} ${p.last_name}`]),
  );

  const doctorMap = new Map(
    (
      doctorsResult.data as Array<{
        id: string;
        profile_id: string;
        profiles: { full_name: string } | { full_name: string }[];
      }>
    ).map((d) => [
      d.id,
      Array.isArray(d.profiles)
        ? (d.profiles[0]?.full_name ?? "Doctor")
        : d.profiles.full_name,
    ]),
  );

  const serviceMap = new Map(
    (servicesResult.data as Array<{ id: string; name: string }>).map((s) => [
      s.id,
      s.name,
    ]),
  );

  return rows.map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    patientFullName: patientMap.get(row.patient_id) ?? "Unknown Patient",
    intakeNotes: row.intake_notes,
    serviceId: row.service_id,
    serviceName: serviceMap.get(row.service_id) ?? "Service",
    doctorId: row.doctor_id ?? null,
    doctorFullName: row.doctor_id
      ? (doctorMap.get(row.doctor_id) ?? null)
      : null,
    feeType: mapFeeType(row.fee_type),
    feeAmount: Number(row.fee_amount ?? 0),
    preferredDate: row.preferred_date,
    preferredTime: row.preferred_time,
    status: row.status,
    paymentStatus: mapPaymentStatus(row.payment_status),
    cancelledReason: row.cancelled_reason ?? null,
    rescheduledReason: row.rescheduled_reason ?? null,
    receiptCode: row.receipt_code ?? "",
    createdAt: row.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Update booking status (live + demo)
// ---------------------------------------------------------------------------

async function updateBookingStatus(
  input: UpdateBookingStatusInput,
): Promise<void> {
  if (input.status === "rescheduled") {
    if (!input.rescheduledReason?.trim()) {
      throw new Error("A reason is required when rescheduling.");
    }
    if (!input.newPreferredDate || !input.newPreferredTime) {
      throw new Error("A new date and time are required when rescheduling.");
    }

    // Validate slot availability
    const booking = await fetchSingleBooking(input.bookingId);
    const blocked = await listBlockedBookingSlotsLiveOrDemo({
      date: input.newPreferredDate,
      doctorId: booking?.doctorId ?? null,
      serviceId: booking?.serviceId ?? null,
    });

    const newTimeNormalized = input.newPreferredTime.slice(0, 5);
    if (blocked.includes(newTimeNormalized)) {
      throw new Error(
        "The selected time slot is already taken. Please choose a different time.",
      );
    }
  }

  if (input.status === "cancelled" && !input.cancelledReason?.trim()) {
    throw new Error("A reason is required when cancelling.");
  }

  // ── Live mode ──────────────────────────────────────────────────────────
  const client = supabase!;
  const payload: Record<string, unknown> = { status: input.status };

  if (input.status === "cancelled") {
    payload.cancelled_reason = input.cancelledReason;
  }

  if (input.status === "rescheduled") {
    payload.rescheduled_reason = input.rescheduledReason;
    payload.preferred_date = input.newPreferredDate;
    payload.preferred_time = input.newPreferredTime;
  }

  const { error } = await client
    .from("bookings")
    .update(payload as never)
    .eq("id", input.bookingId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Delete booking (live only)
// ---------------------------------------------------------------------------

async function deleteBooking(bookingId: string): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase client is not initialized.");
  }

  const { error } = await supabase
    .from("bookings")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", bookingId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

async function fetchSingleBooking(bookingId: string) {
  if (!isSupabaseConfigured) {
    return fetchSingleBookingFromDemo(bookingId);
  }
  const client = supabase!;
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
  const row = data as BookingRow;
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id ?? null,
    serviceId: row.service_id,
    preferredDate: row.preferred_date,
    preferredTime: row.preferred_time,
    status: row.status,
  };
}

function fetchSingleBookingFromDemo(bookingId: string) {
  const booking = getDatabase().bookings.find((b) => b.id === bookingId);
  if (!booking) return null;
  return {
    id: booking.id,
    patientId: booking.patientId,
    doctorId: booking.doctorId || null,
    serviceId: booking.serviceId,
    preferredDate: booking.preferredDate,
    preferredTime: booking.preferredTime,
    status: booking.status,
  };
}

// ---------------------------------------------------------------------------
// Public hooks
// ---------------------------------------------------------------------------

/** Fetch all bookings with resolved relational data. */
export function usePatientBookings() {
  return useQuery({
    queryKey: queryKeys.bookings,
    queryFn: fetchAllPatientBookings,
  });
}

/** Fetch doctor availability for reschedule flow. */
export function useDoctorAvailabilityForBooking(doctorId: string | null) {
  return useQuery({
    queryKey: queryKeys.doctorAvailability(doctorId),
    queryFn: () => getDoctorAvailabilityByDoctorIdLiveOrDemo(doctorId),
    enabled: !!doctorId,
  });
}

/** Fetch blocked slots for a given date/doctor/service combination. */
export function useBlockedBookingSlots(
  date: string | null,
  doctorId: string | null,
  serviceId: string | null,
) {
  return useQuery({
    queryKey: queryKeys.blockedBookingSlots(date, doctorId, serviceId),
    queryFn: () =>
      listBlockedBookingSlotsLiveOrDemo({ date: date!, doctorId, serviceId }),
    enabled: !!date,
  });
}

/** Mutation: update booking status (confirm / reschedule / cancel). */
export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateBookingStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    },
  });
}

/** Mutation: soft-delete a booking. */
export function useDeleteBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    },
  });
}
