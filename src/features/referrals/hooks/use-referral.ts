import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isSupabaseConfigured, supabase } from "../../../lib/supabase";
import { queryKeys } from "../../../lib/query-keys";
import type {
  BookingFeeType,
  BookingPaymentStatus,
} from "../../../types/domain";
import type { Database } from "../../../types/database";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ReferralRow = Database["public"]["Tables"]["referrals"]["Row"];
type DoctorRow = Database["public"]["Tables"]["doctors"]["Row"];

type SpecialistJoinRow = Pick<
  DoctorRow,
  "id" | "profile_id" | "specialty_id" | "consultation_fee" | "follow_up_fee"
> & {
  profiles:
    | { full_name: string; role: string }
    | Array<{ full_name: string; role: string }>;
  specialties: { name: string } | Array<{ name: string }> | null;
};

export interface SpecialistItem {
  id: string;
  profileId: string;
  fullName: string;
  specialtyId: string | null;
  specialtyName: string | null;
  consultationFee: number;
  followUpFee: number;
}

export interface PatientBookingItem {
  bookingId: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientFullName: string;
  serviceId: string;
  serviceName: string;
  preferredDate: string;
  preferredTime: string;
  status: string;
  feeType: BookingFeeType;
  feeAmount: number;
  receiptCode: string;
  paymentStatus: BookingPaymentStatus;
  referralId: string | null;
}

export interface LinkReferralInput {
  bookingId: string;
  referralId: string;
  scheduledAt: string;
}

function mapBookingPaymentStatus(
  value: string | null | undefined,
): BookingPaymentStatus {
  return value === "paid" ? "paid" : "pending_cashier";
}

function mapBookingFeeType(value: string | null | undefined): BookingFeeType {
  switch (value) {
    case "consultation":
    case "follow_up":
    case "service_fee":
      return value;
    default:
      return "service_fee";
  }
}

async function fetchSpecialists(): Promise<SpecialistItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("doctors")
    .select(
      "id, profile_id, specialty_id, consultation_fee, follow_up_fee, profiles!inner(full_name, role), specialties(name)",
    )
    .is("deleted_at", null)
    .eq("profiles.role", "specialist")
    .order("created_at");

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as SpecialistJoinRow[]).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    fullName: Array.isArray(row.profiles)
      ? (row.profiles[0]?.full_name ?? "Specialist")
      : row.profiles.full_name,
    specialtyId: row.specialty_id,
    specialtyName: Array.isArray(row.specialties)
      ? (row.specialties[0]?.name ?? null)
      : (row.specialties?.name ?? null),
    consultationFee: Number(row.consultation_fee ?? 0),
    followUpFee: Number(row.follow_up_fee ?? 0),
  }));
}

async function fetchPatientBookings(): Promise<PatientBookingItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data: bookingsData, error: bookingsError } = await supabase
    .from("bookings")
    .select("*")
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (bookingsError) {
    throw bookingsError;
  }

  const bookings = (bookingsData ?? []) as BookingRow[];

  if (bookings.length === 0) {
    return [];
  }

  const patientIds = [...new Set(bookings.map((b) => b.patient_id))];
  const serviceIds = [...new Set(bookings.map((b) => b.service_id))];

  const [
    { data: patientsData, error: patientsError },
    { data: servicesData, error: servicesError },
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .in("id", patientIds),
    supabase.from("services").select("id, name").in("id", serviceIds),
  ]);

  if (patientsError) throw patientsError;
  if (servicesError) throw servicesError;

  const patients = (patientsData ?? []) as Array<
    Pick<PatientRow, "id" | "first_name" | "last_name">
  >;
  const services = (servicesData ?? []) as Array<
    Pick<ServiceRow, "id" | "name">
  >;

  const patientMap = new Map(
    patients.map((p) => [
      p.id,
      { firstName: p.first_name, lastName: p.last_name },
    ]),
  );
  const serviceMap = new Map(services.map((s) => [s.id, s.name]));

  const referralIds = bookings
    .map((b) => b.relatedReferral_id)
    .filter((id): id is string => Boolean(id));

  const referralSet = new Set<string>();

  if (referralIds.length > 0) {
    const { data: referralsData, error: referralsError } = await supabase
      .from("referrals")
      .select("id")
      .in("id", referralIds);

    if (referralsError) throw referralsError;

    ((referralsData ?? []) as Array<Pick<ReferralRow, "id">>).forEach((r) =>
      referralSet.add(r.id),
    );
  }

  return bookings.map((booking) => {
    const patient = patientMap.get(booking.patient_id);
    const firstName = patient?.firstName ?? "";
    const lastName = patient?.lastName ?? "";
    const rawReferralId = booking.relatedReferral_id ?? null;
    const referralId =
      rawReferralId && referralSet.has(rawReferralId) ? rawReferralId : null;

    return {
      bookingId: booking.id,
      patientId: booking.patient_id,
      patientFirstName: firstName,
      patientLastName: lastName,
      patientFullName: `${firstName} ${lastName}`.trim(),
      serviceId: booking.service_id,
      serviceName: serviceMap.get(booking.service_id) ?? "Service",
      preferredDate: booking.preferred_date,
      preferredTime: booking.preferred_time,
      status: booking.status,
      feeType: mapBookingFeeType(booking.fee_type),
      feeAmount: Number(booking.fee_amount ?? 0),
      receiptCode: booking.receipt_code ?? "",
      paymentStatus: mapBookingPaymentStatus(booking.payment_status),
      referralId,
    };
  });
}

async function linkReferral(input: LinkReferralInput): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const bookingUpdate: Partial<BookingRow> = {
    relatedReferral_id: input.referralId,
  };
  const { error: bookingError } = await supabase
    .from("bookings")
    .update(bookingUpdate as never)
    .eq("id", input.bookingId);

  if (bookingError) {
    throw bookingError;
  }

  const referralUpdate: Partial<ReferralRow> = {
    referred_at: input.scheduledAt,
  };
  const { error: referralError } = await supabase
    .from("referrals")
    .update(referralUpdate as never)
    .eq("id", input.referralId);

  if (referralError) {
    throw referralError;
  }
}

export function useSpecialists() {
  return useQuery({
    queryKey: ["specialists"],
    queryFn: fetchSpecialists,
  });
}

export function usePatientBookings() {
  return useQuery({
    queryKey: ["patient-bookings-with-referrals"],
    queryFn: fetchPatientBookings,
  });
}

export function useLinkReferralMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: linkReferral,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["patient-bookings-with-referrals"],
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    },
  });
}
