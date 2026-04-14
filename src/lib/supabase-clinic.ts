import type { User } from "@supabase/supabase-js";

import { defaultClinicSettings } from "../config/clinic";
import { odcAccessConfig } from "../config/odc-access";
import {
  applyUserPermissionOverride,
  applyUserAccessRoleAssignment,
  clearUserAccessRoleAssignment,
  clearUserPermissionOverride,
  createAccessRole as createDemoAccessRole,
  deleteAccessRoleRecord as deleteDemoAccessRoleRecord,
  getClinicSettings as getDemoClinicSettings,
  getDatabase,
  listAccessRoles as listDemoAccessRoles,
  listDoctorAvailabilityByDoctor,
  replaceDoctorAvailability,
  saveUserAccessRoleAssignment,
  updateUserProfileRecord,
  updateAccessRoleRecord as updateDemoAccessRoleRecord,
  deleteUserProfileRecord,
  updatePatientProfileAccount,
} from "./local-db";
import { isSupabaseConfigured, supabase } from "./supabase";
import type {
  AccessRoleTemplate,
  AdminCreateUserInput,
  Appointment,
  Booking,
  ClinicSettings,
  Consultation,
  DoctorAvailability,
  DoctorFeeSettings,
  InventoryItem,
  BookingFeeType,
  BookingPaymentStatus,
  Invoice,
  Patient,
  PaymentStatus,
  Prescription,
  Permission,
  Role,
  Service,
  ServiceDeliveryMode,
  ServiceType,
  Specialty,
  Supplier,
  UserProfile,
} from "../types/domain";
import type { Database } from "../types/database";
import { generateBookingReceiptCode, generatePatientQrCode } from "./utils";
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";

export interface DoctorDirectoryItem {
  id: string;
  profileId: string;
  fullName: string;
  specialtyId: string | null;
  specialtyName: string | null;
  consultationFee: number;
  followUpFee: number;
}

export interface BookingListItem {
  id: string;
  patientId: string;
  serviceId: string;
  serviceName: string;
  doctorId: string | null;
  doctorName: string | null;
  preferredDate: string;
  preferredTime: string;
  status: string;
  intakeNotes: string;
  createdAt: string;
  feeType: BookingFeeType;
  feeAmount: number;
  receiptCode: string;
  paymentStatus: BookingPaymentStatus;
}

async function buildBookingListItemFromRow(
  row: BookingRow,
  maps?: {
    serviceMap?: Map<string, string>;
    doctorMap?: Map<string, string>;
  },
): Promise<BookingListItem> {
  let serviceMap = maps?.serviceMap;
  let doctorMap = maps?.doctorMap;

  if (!serviceMap) {
    const services = await getBookableServicesLiveOrDemo();
    serviceMap = new Map(services.map((service) => [service.id, service.name]));
  }

  if (!doctorMap) {
    const doctors = await getDoctorDirectoryLiveOrDemo();
    doctorMap = new Map(doctors.map((doctor) => [doctor.id, doctor.fullName]));
  }

  return {
    id: row.id,
    patientId: row.patient_id,
    serviceId: row.service_id,
    serviceName: serviceMap.get(row.service_id) ?? "Service",
    doctorId: row.doctor_id,
    doctorName: row.doctor_id ? (doctorMap.get(row.doctor_id) ?? null) : null,
    preferredDate: row.preferred_date,
    preferredTime: row.preferred_time,
    status: row.status,
    intakeNotes: row.intake_notes,
    createdAt: row.created_at,
    feeType: mapBookingFeeType(row.fee_type),
    feeAmount: Number(row.fee_amount ?? 0),
    receiptCode: row.receipt_code ?? "",
    paymentStatus: mapBookingPaymentStatus(row.payment_status),
  };
}

interface OdcVerifyResponse {
  valid?: boolean;
}

interface OdcUpdateResponse {
  clinicSettings?: ClinicSettingsRow;
}

interface AdminCreateUserResponse {
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    phone: string;
  };
}

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AccessRoleRow = Database["public"]["Tables"]["access_roles"]["Row"];
type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
type SpecialtyRow = Database["public"]["Tables"]["specialties"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ClinicSettingsRow = Database["public"]["Tables"]["clinic_settings"]["Row"];
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type DoctorRow = Database["public"]["Tables"]["doctors"]["Row"];
type DoctorAvailabilityRow =
  Database["public"]["Tables"]["doctor_availability"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type ConsultationRow = Database["public"]["Tables"]["consultations"]["Row"];
type PrescriptionRow = Database["public"]["Tables"]["prescriptions"]["Row"];

export interface OdcCredentialInput {
  accessKey?: string;
  recoveryPassword?: string;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function splitFullName(fullName: string) {
  const [firstName, ...rest] = fullName.trim().split(" ");
  return {
    firstName: firstName || "Patient",
    lastName: rest.join(" ") || "Patient",
  };
}

function mapRole(value: string | null | undefined): Role {
  switch (value) {
    case "doctor":
    case "nurse_staff":
    case "front_desk_cashier":
    case "lab_staff":
    case "inventory_staff":
    case "patient":
    case "owner_admin":
      return value;
    default:
      return "patient";
  }
}

function mapServiceDeliveryMode(
  value: string | null | undefined,
): ServiceDeliveryMode {
  switch (value) {
    case "teleconsultation":
    case "hybrid":
    case "in_person":
      return value;
    default:
      return "in_person";
  }
}

function normalizeOdcCredential(input: OdcCredentialInput) {
  return {
    accessKey: input.accessKey?.trim() || undefined,
    recoveryPassword: input.recoveryPassword?.trim() || undefined,
  };
}

function resolveBookingScheduledAtIso(input: {
  preferredDate: string | null | undefined;
  preferredTime: string | null | undefined;
  fallbackIso?: string | null;
}) {
  const dateValue = input.preferredDate?.trim() ?? "";
  const timeValue = input.preferredTime?.trim() ?? "";

  if (dateValue && timeValue) {
    const timeMatch = timeValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2]);
      const second = Number(timeMatch[3] ?? "0");

      if (
        Number.isInteger(hour) &&
        Number.isInteger(minute) &&
        Number.isInteger(second) &&
        hour >= 0 &&
        hour <= 23 &&
        minute >= 0 &&
        minute <= 59 &&
        second >= 0 &&
        second <= 59
      ) {
        const normalizedTime = `${String(hour).padStart(2, "0")}:${String(
          minute,
        ).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
        const candidate = new Date(`${dateValue}T${normalizedTime}`);
        if (!Number.isNaN(candidate.getTime())) {
          return candidate.toISOString();
        }
      }
    }

    const rawCandidate = new Date(`${dateValue}T${timeValue}`);
    if (!Number.isNaN(rawCandidate.getTime())) {
      return rawCandidate.toISOString();
    }
  }

  if (input.fallbackIso) {
    const fallback = new Date(input.fallbackIso);
    if (!Number.isNaN(fallback.getTime())) {
      return fallback.toISOString();
    }
  }

  return new Date().toISOString();
}

function isMissingBookingAppointmentIdColumn(error: unknown) {
  const details = error as { code?: string; message?: string } | null;
  if (!details) {
    return false;
  }

  if (details.code !== "PGRST204") {
    return false;
  }

  const message = details.message ?? "";
  return message.includes("appointment_id") && message.includes("bookings");
}

function isMissingAccessRoleTableError(error: unknown) {
  const details = error as { code?: string; message?: string } | null;
  if (!details) {
    return false;
  }

  const message = (details.message ?? "").toLowerCase();
  return (
    details.code === "42P01" &&
    (message.includes("access_roles") || message.includes("profile_access_roles"))
  );
}

async function updateBookingPaymentStatusWithOptionalAppointmentLink(
  client: ReturnType<typeof requireSupabase>,
  input: {
    bookingId: string;
    paymentStatus: string;
    appointmentId: string | null;
  },
) {
  const nextPayload = {
    payment_status: input.paymentStatus,
    appointment_id: input.appointmentId,
  };

  const nextResult = await client
    .from("bookings")
    .update(nextPayload as never)
    .eq("id", input.bookingId);

  if (!nextResult.error) {
    return;
  }

  if (!isMissingBookingAppointmentIdColumn(nextResult.error)) {
    throw nextResult.error;
  }

  const fallbackResult = await client
    .from("bookings")
    .update({ payment_status: input.paymentStatus } as never)
    .eq("id", input.bookingId);

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }
}

async function invokeOdcFunction<T>(body: Record<string, unknown>) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke("odc-system-control", {
    body,
  });

  if (error) {
    throw error;
  }

  return (data ?? {}) as T;
}

async function invokeSupabaseFunction<T>(
  name: string,
  body: Record<string, unknown>,
) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke(name, {
    body,
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context;

      try {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (payload?.error) {
          throw new Error(payload.error);
        }
      } catch (payloadError) {
        if (payloadError instanceof Error && payloadError.message) {
          throw payloadError;
        }
      }

      const rawText = await response.text().catch(() => "");
      throw new Error(
        rawText || "Edge Function returned a non-2xx status code.",
      );
    }

    if (
      error instanceof FunctionsRelayError ||
      error instanceof FunctionsFetchError
    ) {
      throw new Error(error.message || "Unable to reach the Edge Function.");
    }

    throw error;
  }

  return (data ?? {}) as T;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read PRC ID file."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function mapAccessRole(row: AccessRoleRow): AccessRoleTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: (row.permission_codes ?? []) as Permission[],
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function applyAccessRoleToProfile(
  profile: UserProfile,
  accessRole: AccessRoleTemplate | null,
) {
  if (!accessRole) {
    return applyUserPermissionOverride(profile);
  }

  return applyUserPermissionOverride({
    ...profile,
    accessRoleId: accessRole.id,
    accessRoleName: accessRole.name,
    permissions: accessRole.permissions,
  });
}

export function mapProfile(
  row: ProfileRow,
  options?: { accessRole?: AccessRoleTemplate | null },
): UserProfile {
  const baseProfile: UserProfile = {
    id: row.id,
    authUserId: row.id,
    email: row.email,
    fullName: row.full_name,
    role: mapRole(row.role),
    phone: row.phone ?? "",
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };

  return applyAccessRoleToProfile(baseProfile, options?.accessRole ?? null);
}

export function mapPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    userId: row.user_id,
    qrCode: row.qr_code,
    intakeSource:
      row.intake_source === "staff_walk_in"
        ? "staff_walk_in"
        : "online_registration",
    visitStatus:
      row.visit_status === "visited_clinic"
        ? "visited_clinic"
        : "registered_no_visit",
    lastClinicVisitAt: row.last_clinic_visit_at,
    firstName: row.first_name,
    lastName: row.last_name,
    sex:
      row.sex === "male" || row.sex === "female" || row.sex === "other"
        ? row.sex
        : "other",
    birthDate: row.birth_date,
    mobileNumber: row.mobile_number ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    bloodType: row.blood_type ?? "",
    allergies: row.allergies,
    medicalHistory: row.medical_history,
    emergencyContactName: row.emergency_contact_name ?? "",
    emergencyContactPhone: row.emergency_contact_phone ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id ?? "",
    specialtyId: row.specialty_id ?? "",
    serviceId: row.service_id ?? "",
    bookingId: row.booking_id,
    scheduledAt: row.scheduled_at,
    status: mapAppointmentStatus(row.status),
    source: row.source === "portal" ? "portal" : "internal",
    visitType:
      row.visit_type === "teleconsultation" ? "teleconsultation" : "in_person",
    reason: row.reason,
    notes: row.notes,
    teleconsultationPlatform: row.teleconsultation_platform,
    teleconsultationUrl: row.teleconsultation_url,
    teleconsultationAccessInstructions:
      row.teleconsultation_access_instructions,
    consultationId: row.consultation_id,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapAppointmentStatus(value: string) {
  switch (value) {
    case "scheduled":
    case "in_progress":
    case "completed":
    case "cancelled":
    case "no_show":
      return value;
    default:
      return "scheduled" as const;
  }
}

function mapBookingStatus(value: string) {
  switch (value) {
    case "pending":
    case "confirmed":
    case "rescheduled":
    case "cancelled":
      return value;
    default:
      return "pending" as const;
  }
}

function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    patientId: row.patient_id,
    serviceId: row.service_id,
    doctorId: row.doctor_id ?? "",
    appointmentId: row.appointment_id,
    preferredDate: row.preferred_date,
    preferredTime: row.preferred_time,
    status: mapBookingStatus(row.status),
    intakeNotes: row.intake_notes,
    feeType: mapBookingFeeType(row.fee_type),
    feeAmount: Number(row.fee_amount ?? 0),
    receiptCode: row.receipt_code ?? "",
    paymentStatus: mapBookingPaymentStatus(row.payment_status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function hasConsultationBooking(status: string | null | undefined) {
  return status !== "cancelled";
}

function hasConsultationAppointment(status: string | null | undefined) {
  return status !== "cancelled" && status !== "no_show";
}

function mapServiceType(value: string | null | undefined): ServiceType {
  switch (value) {
    case "consultation":
    case "follow_up":
    case "medical_service":
      return value;
    default:
      return "medical_service";
  }
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

function mapBookingPaymentStatus(
  value: string | null | undefined,
): BookingPaymentStatus {
  return value === "paid" ? "paid" : "pending_cashier";
}

function mapInvoicePaymentStatus(
  value: string | null | undefined,
): PaymentStatus {
  switch (value) {
    case "unpaid":
    case "partial":
    case "paid":
    case "void":
      return value;
    default:
      return "unpaid";
  }
}

function mapConsultation(row: ConsultationRow) {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    consultationType: row.consultation_type ?? "",
    consultationDate: row.consultation_date ?? "",
    consultationTime: row.consultation_time ?? "",
    providerName: row.provider_name ?? "",
    clinicalSummary: row.clinical_summary ?? "",
    diagnosis: row.diagnosis ?? "",
    presentIllnessHistory: row.present_illness_history ?? "",
    reviewOfSymptoms: row.review_of_symptoms ?? "",
    allergies: row.allergies ?? "",
    vitals: row.vitals ?? "",
    treatmentPlan: row.treatment_plan ?? "",
    medications: row.medications ?? "",
    labResults: row.lab_results ?? "",
    differentialDiagnosis: row.differential_diagnosis ?? "",
    subjective: row.subjective,
    objective: row.objective,
    assessment: row.assessment,
    plan: row.plan,
    outcome: row.outcome,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPrescription(row: PrescriptionRow) {
  return {
    id: row.id,
    consultationId: row.consultation_id,
    patientId: row.patient_id,
    prescriptionName: row.prescription_name ?? row.medication,
    dosage: row.dosage,
    instruction: row.instruction ?? row.instructions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSpecialty(row: SpecialtyRow): Specialty {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapDoctorAvailability(row: DoctorAvailabilityRow): DoctorAvailability {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    slotMinutes: row.slot_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPatientsLiveOrDemo() {
  if (!isSupabaseConfigured) {
    const database = getDatabase();
    const patientIdsWithAppointment = new Set(
      database.appointments
        .filter((appointment) => hasConsultationAppointment(appointment.status))
        .map((appointment) => appointment.patientId),
    );
    const patientIdsWithBooking = new Set(
      database.bookings
        .filter((booking) => hasConsultationBooking(booking.status))
        .map((booking) => booking.patientId),
    );

    return database.patients.map((patient) => ({
      ...patient,
      visitStatus:
        patient.visitStatus === "visited_clinic" ||
        patientIdsWithAppointment.has(patient.id) ||
        patientIdsWithBooking.has(patient.id)
          ? ("visited_clinic" as const)
          : ("registered_no_visit" as const),
    }));
  }

  const client = requireSupabase();
  const [patientResult, appointmentResult, bookingResult] = await Promise.all([
    client
      .from("patients")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    client.from("appointments").select("patient_id,status").is("deleted_at", null),
    client.from("bookings").select("patient_id,status").is("deleted_at", null),
  ]);

  const { data, error } = patientResult;
  if (error) {
    throw error;
  }

  if (appointmentResult.error) {
    throw appointmentResult.error;
  }

  if (bookingResult.error) {
    throw bookingResult.error;
  }

  const patientIdsWithAppointment = new Set(
    ((appointmentResult.data ?? []) as Array<{ patient_id: string | null; status: string | null }>)
      .filter((appointment) => Boolean(appointment.patient_id) && hasConsultationAppointment(appointment.status))
      .map((appointment) => appointment.patient_id as string),
  );
  const patientIdsWithBooking = new Set(
    ((bookingResult.data ?? []) as Array<{ patient_id: string | null; status: string | null }>)
      .filter((booking) => Boolean(booking.patient_id) && hasConsultationBooking(booking.status))
      .map((booking) => booking.patient_id as string),
  );

  return (data ?? []).map((row) => {
    const patient = mapPatient(row);
    return {
      ...patient,
      visitStatus:
        patient.visitStatus === "visited_clinic" ||
        patientIdsWithAppointment.has(patient.id) ||
        patientIdsWithBooking.has(patient.id)
          ? ("visited_clinic" as const)
          : ("registered_no_visit" as const),
    };
  });
}

export async function createPatientLiveOrDemo(
  input: Omit<Patient, "id" | "createdAt" | "updatedAt">,
) {
  if (!isSupabaseConfigured) {
    const { upsertPatient } = await import("./local-db");
    return upsertPatient(input);
  }

  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["patients"]["Insert"] = {
    user_id: input.userId ?? null,
    qr_code: input.qrCode || generatePatientQrCode(),
    intake_source: input.intakeSource,
    visit_status: input.visitStatus,
    ...(input.lastClinicVisitAt !== undefined ? { last_clinic_visit_at: input.lastClinicVisitAt } : {}),
    first_name: input.firstName,
    last_name: input.lastName,
    sex: input.sex,
    birth_date: input.birthDate,
    mobile_number: input.mobileNumber || null,
    email: input.email || null,
    address: input.address || null,
    blood_type: input.bloodType || null,
    allergies: input.allergies,
    medical_history: input.medicalHistory,
    emergency_contact_name: input.emergencyContactName || null,
    emergency_contact_phone: input.emergencyContactPhone || null,
  };

  const { data, error } = await client
    .from("patients")
    .insert(payload as never)
    .select("*")
    .single();
  if (error) {
    throw error;
  }

  return mapPatient(data);
}

export async function updatePatientLiveOrDemo(
  patientId: string,
  input: Omit<Patient, "id" | "createdAt" | "updatedAt">,
) {
  if (!isSupabaseConfigured) {
    const { updatePatientRecord } = await import("./local-db");
    return updatePatientRecord(patientId, input);
  }

  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["patients"]["Update"] = {
    user_id: input.userId ?? null,
    qr_code: input.qrCode || generatePatientQrCode(),
    intake_source: input.intakeSource,
    visit_status: input.visitStatus,
    ...(input.lastClinicVisitAt !== undefined ? { last_clinic_visit_at: input.lastClinicVisitAt } : {}),
    first_name: input.firstName,
    last_name: input.lastName,
    sex: input.sex,
    birth_date: input.birthDate,
    mobile_number: input.mobileNumber || null,
    email: input.email || null,
    address: input.address || null,
    blood_type: input.bloodType || null,
    allergies: input.allergies,
    medical_history: input.medicalHistory,
    emergency_contact_name: input.emergencyContactName || null,
    emergency_contact_phone: input.emergencyContactPhone || null,
  };

  const { data, error } = await client
    .from("patients")
    .update(payload as never)
    .eq("id", patientId)
    .select("*")
    .single();
  if (error) {
    throw error;
  }

  return mapPatient(data);
}

export async function deletePatientLiveOrDemo(patientId: string) {
  if (!isSupabaseConfigured) {
    const { deletePatientRecord } = await import("./local-db");
    deletePatientRecord(patientId);
    return;
  }

  const client = requireSupabase();
  const { error } = await client
    .from("patients")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", patientId);
  if (error) {
    throw error;
  }
}

export async function getPatientByIdLiveOrDemo(patientId: string) {
  if (!isSupabaseConfigured) {
    const { getPatientById } = await import("./local-db");
    return getPatientById(patientId);
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();
  if (error) {
    throw error;
  }

  return data ? mapPatient(data) : null;
}

export async function listAppointmentsByPatientIdLiveOrDemo(
  patientId: string,
): Promise<Appointment[]> {
  if (!isSupabaseConfigured) {
    return getDatabase().appointments.filter(
      (appointment) => appointment.patientId === patientId,
    );
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("appointments")
    .select("*")
    .eq("patient_id", patientId)
    .order("scheduled_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as AppointmentRow[]).map(mapAppointment);
}

export async function listBookingsByPatientIdLiveOrDemo(
  patientId: string,
): Promise<Booking[]> {
  if (!isSupabaseConfigured) {
    return getDatabase().bookings
      .filter((booking) => booking.patientId === patientId)
      .sort((left, right) => {
        const leftDateTime = `${left.preferredDate}T${left.preferredTime}`;
        const rightDateTime = `${right.preferredDate}T${right.preferredTime}`;
        return rightDateTime.localeCompare(leftDateTime);
      });
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("preferred_date", { ascending: false })
    .order("preferred_time", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as BookingRow[]).map(mapBooking);
}

export async function getLatestInvoiceByPatientIdLiveOrDemo(
  patientId: string,
): Promise<Invoice | null> {
  if (!patientId) {
    return null;
  }

  if (!isSupabaseConfigured) {
    const latest = getDatabase().invoices
      .filter((invoice) => invoice.patientId === patientId)
      .sort((left, right) => {
        if (left.createdAt === right.createdAt) {
          return right.invoiceNumber.localeCompare(left.invoiceNumber);
        }
        return right.createdAt.localeCompare(left.createdAt);
      })[0];

    return latest ?? null;
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("invoices")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as {
    id: string;
    patient_id: string;
    appointment_id: string | null;
    invoice_number: string;
    payment_status: string | null;
    subtotal: number;
    total: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };

  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    invoiceNumber: row.invoice_number,
    paymentStatus: mapInvoicePaymentStatus(row.payment_status),
    subtotal: Number(row.subtotal ?? 0),
    total: Number(row.total ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export async function updateAppointmentStatusAndNotesLiveOrDemo(input: {
  appointmentId: string;
  status: Appointment["status"];
  notes: string;
}) {
  if (!isSupabaseConfigured) {
    const { updateAppointmentRecord } = await import("./local-db");
    const existing = getDatabase().appointments.find(
      (appointment) => appointment.id === input.appointmentId,
    );
    if (!existing) {
      throw new Error("Appointment not found.");
    }

    return updateAppointmentRecord(input.appointmentId, {
      patientId: existing.patientId,
      doctorId: existing.doctorId,
      specialtyId: existing.specialtyId,
      serviceId: existing.serviceId,
      scheduledAt: existing.scheduledAt,
      status: input.status,
      source: existing.source,
      visitType: existing.visitType,
      reason: existing.reason,
      notes: input.notes,
      teleconsultationPlatform: existing.teleconsultationPlatform ?? null,
      teleconsultationUrl: existing.teleconsultationUrl ?? null,
      teleconsultationAccessInstructions:
        existing.teleconsultationAccessInstructions ?? null,
      consultationId: existing.consultationId ?? null,
      completedBy: existing.completedBy ?? null,
      completedAt: existing.completedAt ?? null,
      deletedAt: existing.deletedAt ?? null,
    });
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("appointments")
    .update({ status: input.status, notes: input.notes } as never)
    .eq("id", input.appointmentId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapAppointment(data as AppointmentRow);
}

export async function listConsultationsByPatientIdLiveOrDemo(
  patientId: string,
): Promise<Consultation[]> {
  if (!isSupabaseConfigured) {
    return getDatabase().consultations.filter(
      (consultation) => consultation.patientId === patientId,
    );
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("consultations")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ConsultationRow[]).map(mapConsultation);
}

export async function listPrescriptionsByPatientIdLiveOrDemo(
  patientId: string,
): Promise<Prescription[]> {
  if (!isSupabaseConfigured) {
    return getDatabase().prescriptions.filter(
      (prescription) => prescription.patientId === patientId,
    );
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("prescriptions")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as PrescriptionRow[]).map(mapPrescription);
}

export async function createAppointmentLiveOrDemo(
  input: Omit<Appointment, "id" | "createdAt" | "updatedAt">,
) {
  if (!isSupabaseConfigured) {
    const { createAppointment } = await import("./local-db");
    return createAppointment(input);
  }

  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["appointments"]["Insert"] = {
    patient_id: input.patientId,
    doctor_id: input.doctorId || null,
    specialty_id: input.specialtyId || null,
    service_id: input.serviceId || null,
    scheduled_at: input.scheduledAt,
    status: input.status,
    source: input.source,
    visit_type: input.visitType,
    reason: input.reason,
    notes: input.notes,
    teleconsultation_platform: input.teleconsultationPlatform ?? null,
    teleconsultation_url: input.teleconsultationUrl ?? null,
    teleconsultation_access_instructions: input.teleconsultationAccessInstructions ?? null,
    consultation_id: input.consultationId ?? null,
    completed_by: input.completedBy ?? null,
    completed_at: input.completedAt ?? null,
  };

  const { data, error } = await client
    .from("appointments")
    .insert(payload as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapAppointment(data as AppointmentRow);
}

export async function createConsultationLiveOrDemo(
  input: Omit<Consultation, "id" | "createdAt" | "updatedAt">,
) {
  if (!isSupabaseConfigured) {
    const { createConsultation } = await import("./local-db");
    return createConsultation(input);
  }

  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["consultations"]["Insert"] = {
    appointment_id: input.appointmentId ?? null,
    patient_id: input.patientId,
    doctor_id: input.doctorId,
    consultation_type: input.consultationType,
    consultation_date: input.consultationDate,
    consultation_time: input.consultationTime,
    provider_name: input.providerName,
    clinical_summary: input.clinicalSummary,
    diagnosis: input.diagnosis,
    present_illness_history: input.presentIllnessHistory,
    review_of_symptoms: input.reviewOfSymptoms,
    allergies: input.allergies,
    vitals: input.vitals,
    treatment_plan: input.treatmentPlan,
    medications: input.medications,
    lab_results: input.labResults,
    differential_diagnosis: input.differentialDiagnosis,
    subjective: input.subjective,
    objective: input.objective,
    assessment: input.assessment,
    plan: input.plan,
    outcome: input.outcome,
  };

  const { data, error } = await client
    .from("consultations")
    .insert(payload as never)
    .select("*")
    .single();
  if (error) {
    throw error;
  }

  return mapConsultation(data as ConsultationRow);
}

export async function createPrescriptionLiveOrDemo(
  input: Omit<Prescription, "id" | "createdAt" | "updatedAt">,
) {
  if (!isSupabaseConfigured) {
    const { createPrescription } = await import("./local-db");
    return createPrescription(input);
  }

  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["prescriptions"]["Insert"] = {
    consultation_id: input.consultationId,
    patient_id: input.patientId,
    medication: input.prescriptionName,
    dosage: input.dosage,
    instructions: input.instruction,
    prescription_name: input.prescriptionName,
    instruction: input.instruction,
  };

  const { data, error } = await client
    .from("prescriptions")
    .insert(payload as never)
    .select("*")
    .single();
  if (error) {
    throw error;
  }

  return mapPrescription(data as PrescriptionRow);
}

function mapService(row: ServiceRow): Service {
  return {
    id: row.id,
    serviceType: mapServiceType(row.service_type),
    name: row.name,
    description: row.description,
    price: Number(row.price),
    durationMinutes: row.duration_minutes,
    specialtyId: row.specialty_id,
    isBookable: row.is_bookable,
    deliveryMode: mapServiceDeliveryMode(row.delivery_mode),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapClinicSettings(row: ClinicSettingsRow): ClinicSettings {
  return {
    id: row.id,
    clinicName: row.clinic_name,
    legalName: row.legal_name,
    shortCode: row.short_code,
    address: row.address,
    contactNumber: row.contact_number,
    email: row.email,
    website: row.website,
    logoUrl: row.logo_url ?? "",
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    bookingLeadDays: row.booking_lead_days,
    bookingCancellationHours: row.booking_cancellation_hours,
    appointmentSlotMinutes: row.appointment_slot_minutes,
    systemEnabled: row.system_enabled,
    systemMessage: row.system_message,
    operatingHours: Array.isArray(row.operating_hours)
      ? (row.operating_hours as ClinicSettings["operatingHours"])
      : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getClinicSettingsLiveOrDemo() {
  if (!isSupabaseConfigured) {
    return getDemoClinicSettings();
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("clinic_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapClinicSettings(data) : defaultClinicSettings;
}

export async function getBookableServicesLiveOrDemo() {
  if (!isSupabaseConfigured) {
    return getDatabase().services.filter((service) => service.isBookable);
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("services")
    .select("*")
    .eq("is_bookable", true)
    .is("deleted_at", null)
    .order("name");

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapService);
}

export async function listServicesLiveOrDemo() {
  if (!isSupabaseConfigured) {
    const { listServices } = await import("./local-db");
    return listServices();
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("services")
    .select("*")
    .is("deleted_at", null)
    .order("name");
  if (error) {
    throw error;
  }

  return ((data ?? []) as ServiceRow[]).map(mapService);
}

export async function createServiceLiveOrDemo(
  input: Omit<Service, "id" | "createdAt" | "updatedAt" | "deletedAt">,
) {
  if (!isSupabaseConfigured) {
    const { createService } = await import("./local-db");
    return createService(input);
  }

  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["services"]["Insert"] = {
    service_type: input.serviceType,
    name: input.name,
    description: input.description,
    price: input.price,
    duration_minutes: input.durationMinutes,
    specialty_id: input.specialtyId ?? null,
    is_bookable: input.isBookable,
    delivery_mode: input.deliveryMode,
  };

  const { data, error } = await client
    .from("services")
    .insert(payload as never)
    .select("*")
    .single();
  if (error) {
    throw error;
  }

  return mapService(data as ServiceRow);
}

export async function updateServiceLiveOrDemo(
  id: string,
  input: Omit<Service, "id" | "createdAt" | "updatedAt" | "deletedAt">,
) {
  if (!isSupabaseConfigured) {
    const { updateServiceRecord } = await import("./local-db");
    return updateServiceRecord(id, input);
  }

  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["services"]["Update"] = {
    service_type: input.serviceType,
    name: input.name,
    description: input.description,
    price: input.price,
    duration_minutes: input.durationMinutes,
    specialty_id: input.specialtyId ?? null,
    is_bookable: input.isBookable,
    delivery_mode: input.deliveryMode,
  };

  const { data, error } = await client.from("services").update(payload as never).eq("id", id).select("*").single();
  if (error) {
    throw error;
  }

  return mapService(data as ServiceRow);
}

export async function deleteServiceLiveOrDemo(id: string) {
  if (!isSupabaseConfigured) {
    const { deleteServiceRecord } = await import("./local-db");
    deleteServiceRecord(id);
    return;
  }

  const client = requireSupabase();
  const { error } = await client.from("services").update({ deleted_at: new Date().toISOString() } as never).eq("id", id);
  if (error) {
    throw error;
  }
}

export async function listSpecialtiesLiveOrDemo() {
  if (!isSupabaseConfigured) {
    const { listSpecialties } = await import("./local-db");
    return listSpecialties();
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("specialties")
    .select("*")
    .is("deleted_at", null)
    .order("name");
  if (error) {
    throw error;
  }

  return ((data ?? []) as SpecialtyRow[]).map(mapSpecialty);
}

export async function createSpecialtyLiveOrDemo(
  input: Omit<Specialty, "id" | "createdAt" | "updatedAt" | "deletedAt">,
) {
  if (!isSupabaseConfigured) {
    const { createSpecialty } = await import("./local-db");
    return createSpecialty(input);
  }

  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["specialties"]["Insert"] = {
    name: input.name,
    description: input.description,
  };

  const { data, error } = await client
    .from("specialties")
    .insert(payload as never)
    .select("*")
    .single();
  if (error) {
    throw error;
  }

  return mapSpecialty(data as SpecialtyRow);
}

export async function updateSpecialtyLiveOrDemo(
  id: string,
  input: Omit<Specialty, "id" | "createdAt" | "updatedAt" | "deletedAt">,
) {
  if (!isSupabaseConfigured) {
    const { updateSpecialtyRecord } = await import("./local-db");
    return updateSpecialtyRecord(id, input);
  }

  const client = requireSupabase();
  const { data, error } = await client.from("specialties").update({
    name: input.name,
    description: input.description,
  } as never).eq("id", id).select("*").single();
  if (error) {
    throw error;
  }

  return mapSpecialty(data as SpecialtyRow);
}

export async function deleteSpecialtyLiveOrDemo(id: string) {
  if (!isSupabaseConfigured) {
    const { deleteSpecialtyRecord } = await import("./local-db");
    deleteSpecialtyRecord(id);
    return;
  }

  const client = requireSupabase();
  const { error } = await client.from("specialties").update({ deleted_at: new Date().toISOString() } as never).eq("id", id);
  if (error) {
    throw error;
  }
}

export async function getDoctorDirectoryLiveOrDemo(): Promise<
  DoctorDirectoryItem[]
> {
  if (!isSupabaseConfigured) {
    const database = getDatabase();
    return database.users
      .filter((user) => user.role === "doctor")
      .map((user) => ({
        id: user.id,
        profileId: user.id,
        fullName: user.fullName,
        specialtyId: user.specialtyId ?? null,
        specialtyName:
          database.specialties.find(
            (specialty) => specialty.id === user.specialtyId,
          )?.name ?? null,
        consultationFee: 0,
        followUpFee: 0,
      }));
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("doctors")
    .select(
      "id, profile_id, specialty_id, consultation_fee, follow_up_fee, profiles!inner(full_name), specialties(name)",
    )
    .is("deleted_at", null)
    .order("created_at");

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
      id: string;
      profile_id: string;
      specialty_id: string | null;
      consultation_fee: number;
      follow_up_fee: number;
      profiles: { full_name: string } | { full_name: string }[];
      specialties: { name: string } | { name: string }[] | null;
    }>
  ).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    fullName: Array.isArray(row.profiles)
      ? (row.profiles[0]?.full_name ?? "Doctor")
      : row.profiles.full_name,
    specialtyId: row.specialty_id,
    specialtyName: Array.isArray(row.specialties)
      ? (row.specialties[0]?.name ?? null)
      : (row.specialties?.name ?? null),
    consultationFee: Number(row.consultation_fee ?? 0),
    followUpFee: Number(row.follow_up_fee ?? 0),
  }));
}

export async function getCurrentDoctor(userId: string) {
  if (!isSupabaseConfigured) {
    const user = getDatabase().users.find(
      (item) => item.id === userId || item.authUserId === userId,
    );
    if (!user || user.role !== "doctor") {
      return null;
    }

    return {
      id: user.id,
      profileId: user.id,
      specialtyId: user.specialtyId ?? null,
      consultationFee: 0,
      followUpFee: 0,
    };
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("doctors")
    .select("*")
    .eq("profile_id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }

  return data
    ? {
        id: (data as DoctorRow).id,
        profileId: (data as DoctorRow).profile_id,
        specialtyId: (data as DoctorRow).specialty_id,
        consultationFee: Number((data as DoctorRow).consultation_fee ?? 0),
        followUpFee: Number((data as DoctorRow).follow_up_fee ?? 0),
      }
    : null;
}

export async function ensureDoctorForUser(user: User) {
  const metadataRole = mapRole(
    (user.user_metadata as Record<string, string | undefined>).role,
  );
  const fallbackProfile = await getCurrentProfile(user.id);
  if (metadataRole !== "doctor" && fallbackProfile?.role !== "doctor") {
    return null;
  }

  if (!isSupabaseConfigured) {
    return getCurrentDoctor(user.id);
  }

  const client = requireSupabase();
  const existing = await getCurrentDoctor(user.id);
  if (existing) {
    return existing;
  }

  const { error } = await client
    .from("doctors")
    .insert({ profile_id: user.id } as never);
  if (error) {
    throw error;
  }

  return getCurrentDoctor(user.id);
}

export async function getDoctorAvailabilityByDoctorIdLiveOrDemo(
  doctorId: string | null,
) {
  if (!doctorId) {
    return [];
  }

  if (!isSupabaseConfigured) {
    return listDoctorAvailabilityByDoctor(doctorId);
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("doctor_availability")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("day_of_week")
    .order("start_time");

  if (error) {
    throw error;
  }

  return ((data ?? []) as DoctorAvailabilityRow[]).map(mapDoctorAvailability);
}

export async function saveDoctorAvailabilityForProfileLiveOrDemo(
  profileId: string,
  availability: Array<
    Omit<DoctorAvailability, "id" | "createdAt" | "updatedAt">
  >,
) {
  const doctor = await getCurrentDoctor(profileId);
  if (!doctor) {
    throw new Error("Doctor record not found for this profile.");
  }

  if (!isSupabaseConfigured) {
    return replaceDoctorAvailability(doctor.id, availability);
  }

  const client = requireSupabase();
  const { error: deleteError } = await client
    .from("doctor_availability")
    .delete()
    .eq("doctor_id", doctor.id);
  if (deleteError) {
    throw deleteError;
  }

  if (availability.length === 0) {
    return [];
  }

  const payload = availability.map((slot) => ({
    doctor_id: doctor.id,
    day_of_week: slot.dayOfWeek,
    start_time: slot.startTime,
    end_time: slot.endTime,
    slot_minutes: slot.slotMinutes,
  }));

  const { data, error } = await client
    .from("doctor_availability")
    .insert(payload as never)
    .select("*");
  if (error) {
    throw error;
  }

  return ((data ?? []) as DoctorAvailabilityRow[]).map(mapDoctorAvailability);
}

export async function saveDoctorFeeSettingsForProfileLiveOrDemo(
  profileId: string,
  input: DoctorFeeSettings,
) {
  const doctor = await getCurrentDoctor(profileId);
  if (!doctor) {
    throw new Error("Doctor record not found for this profile.");
  }

  if (!isSupabaseConfigured) {
    const { updateDoctorFeeSettings } = await import("./local-db");
    return updateDoctorFeeSettings(doctor.id, input);
  }

  const client = requireSupabase();
  const { error } = await client
    .from("doctors")
    .update({
      consultation_fee: input.consultationFee,
      follow_up_fee: input.followUpFee,
    } as never)
    .eq("id", doctor.id);

  if (error) {
    throw error;
  }

  return getCurrentDoctor(profileId);
}

export async function getCurrentProfile(userId: string) {
  if (!isSupabaseConfigured) {
    const profile =
      getDatabase().users.find(
        (user) => user.authUserId === userId || user.id === userId,
      ) ?? null;
    return profile ? applyUserAccessRoleAssignment(profile) : null;
  }

  const client = requireSupabase() as any;
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }

  const profileRow = (data ?? null) as ProfileRow | null;
  if (!profileRow) {
    return null;
  }

  const accessRoleMap = await getAccessRoleMapForProfiles([profileRow.id]);
  return mapProfile(profileRow, { accessRole: accessRoleMap.get(profileRow.id) ?? null });
}

export async function ensureProfileForUser(user: User) {
  if (!isSupabaseConfigured) {
    return (
      getDatabase().users.find((item) => item.email === user.email) ?? null
    );
  }

  const client = requireSupabase();
  const metadata = user.user_metadata as Record<string, string | undefined>;
  const role = mapRole(metadata.role);
  const payload: Database["public"]["Tables"]["profiles"]["Insert"] = {
    id: user.id,
    email: user.email ?? "",
    full_name:
      metadata.full_name ??
      metadata.name ??
      user.email?.split("@")[0] ??
      "User",
    role,
    phone: metadata.phone ?? null,
    title: metadata.title ?? null,
  };

  const { error } = await client
    .from("profiles")
    .upsert(payload as never, { onConflict: "id" });
  if (error) {
    throw error;
  }

  return getCurrentProfile(user.id);
}

export async function getCurrentPatient(userId: string) {
  if (!isSupabaseConfigured) {
    return (
      getDatabase().patients.find((patient) => patient.userId === userId) ??
      null
    );
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("patients")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapPatient(data) : null;
}

export async function getPatientByQrCodeLiveOrDemo(qrCode: string) {
  const normalizedCode = qrCode.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  if (!isSupabaseConfigured) {
    return (
      getDatabase().patients.find(
        (patient) => patient.qrCode.trim().toUpperCase() === normalizedCode,
      ) ?? null
    );
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("patients")
    .select("*")
    .eq("qr_code", normalizedCode)
    .maybeSingle();
  if (error) {
    throw error;
  }

  return data ? mapPatient(data) : null;
}

export async function ensurePatientForUser(user: User) {
  if (!isSupabaseConfigured) {
    return (
      getDatabase().patients.find((patient) => patient.userId === user.id) ??
      null
    );
  }

  const client = requireSupabase();
  const existing = await getCurrentPatient(user.id);
  if (existing) {
    return existing;
  }

  const metadata = user.user_metadata as Record<string, string | undefined>;
  const fullName =
    metadata.full_name ??
    metadata.name ??
    user.email?.split("@")[0] ??
    "Patient User";
  const name = splitFullName(fullName);
  const payload: Database["public"]["Tables"]["patients"]["Insert"] = {
    user_id: user.id,
    qr_code: generatePatientQrCode(),
    intake_source: "online_registration",
    visit_status: "registered_no_visit",
    first_name: name.firstName,
    last_name: name.lastName,
    sex: metadata.sex ?? "other",
    birth_date: metadata.birth_date ?? new Date().toISOString().slice(0, 10),
    mobile_number: metadata.phone ?? null,
    email: user.email ?? null,
    address: metadata.address ?? null,
    blood_type: metadata.blood_type ?? null,
    allergies: metadata.allergies ?? "",
    medical_history: metadata.medical_history ?? "",
    emergency_contact_name: metadata.emergency_contact_name ?? fullName,
    emergency_contact_phone:
      metadata.emergency_contact_phone ?? metadata.phone ?? null,
  };

  const { data, error } = await client
    .from("patients")
    .insert(payload as never)
    .select("*")
    .single();
  if (error) {
    throw error;
  }

  return mapPatient(data);
}

export async function getBookingListForUser(
  userId: string,
): Promise<BookingListItem[]> {
  if (!isSupabaseConfigured) {
    const database = getDatabase();
    const patient = database.patients.find(
      (item) => item.userId === userId || item.email === userId,
    );
    if (!patient) return [];
    return database.bookings
      .filter((booking) => booking.patientId === patient.id)
      .map((booking) => ({
        id: booking.id,
        patientId: booking.patientId,
        serviceId: booking.serviceId,
        serviceName:
          database.services.find((service) => service.id === booking.serviceId)
            ?.name ?? "Service",
        doctorId: booking.doctorId,
        doctorName:
          database.users.find((doctor) => doctor.id === booking.doctorId)
            ?.fullName ?? null,
        preferredDate: booking.preferredDate,
        preferredTime: booking.preferredTime,
        status: booking.status,
        intakeNotes: booking.intakeNotes,
        createdAt: booking.createdAt,
        feeType: booking.feeType,
        feeAmount: booking.feeAmount,
        receiptCode: booking.receiptCode,
        paymentStatus: booking.paymentStatus,
      }));
  }

  const client = requireSupabase();
  const patient = await getCurrentPatient(userId);
  if (!patient) {
    return [];
  }

  const [{ data: bookings, error }, services, doctors] = await Promise.all([
    client
      .from("bookings")
      .select("*")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false }),
    getBookableServicesLiveOrDemo(),
    getDoctorDirectoryLiveOrDemo(),
  ]);

  if (error) {
    throw error;
  }

  const serviceMap = new Map(
    services.map((service) => [service.id, service.name]),
  );
  const doctorMap = new Map(
    doctors.map((doctor) => [doctor.id, doctor.fullName]),
  );

  return Promise.all(
    ((bookings ?? []) as BookingRow[]).map((booking) =>
      buildBookingListItemFromRow(booking, {
        serviceMap,
        doctorMap,
      }),
    ),
  );
}

export async function createBookingLiveOrDemo(input: {
  patientId: string;
  serviceId: string;
  doctorId: string | null;
  preferredDate: string;
  preferredTime: string;
  intakeNotes: string;
  feeType: BookingFeeType;
  feeAmount: number;
  receiptCode?: string;
  paymentStatus?: BookingPaymentStatus;
}) {
  if (!isSupabaseConfigured) {
    const { createBooking } = await import("./local-db");
    return createBooking({
      patientId: input.patientId,
      serviceId: input.serviceId,
      doctorId: input.doctorId ?? "",
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime,
      intakeNotes: input.intakeNotes,
      feeType: input.feeType,
      feeAmount: input.feeAmount,
      receiptCode: input.receiptCode || generateBookingReceiptCode(),
      paymentStatus: input.paymentStatus || "pending_cashier",
    });
  }

  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["bookings"]["Insert"] = {
    patient_id: input.patientId,
    service_id: input.serviceId,
    doctor_id: input.doctorId,
    preferred_date: input.preferredDate,
    preferred_time: input.preferredTime,
    intake_notes: input.intakeNotes,
    status: "pending",
    fee_type: input.feeType,
    fee_amount: input.feeAmount,
    receipt_code: input.receiptCode ?? generateBookingReceiptCode(),
    payment_status: input.paymentStatus ?? "pending_cashier",
  };

  const { data, error } = await client
    .from("bookings")
    .insert(payload as never)
    .select("*")
    .single();
  if (error) {
    throw error;
  }

  return data;
}

export async function listBlockedBookingSlotsLiveOrDemo(input: {
  date: string;
  doctorId?: string | null;
  serviceId?: string | null;
}) {
  if (!input.date) {
    return [];
  }

  if (!isSupabaseConfigured) {
    const database = getDatabase();
    const bookingTimes = database.bookings
      .filter((booking) => {
        if (
          booking.preferredDate !== input.date ||
          booking.status === "cancelled"
        ) {
          return false;
        }

        if (input.doctorId) {
          return booking.doctorId === input.doctorId;
        }

        return booking.serviceId === input.serviceId && !booking.doctorId;
      })
      .map((booking) => booking.preferredTime);

    const appointmentTimes = database.appointments
      .filter((appointment) => {
        if (
          !appointment.scheduledAt.startsWith(input.date) ||
          appointment.status === "cancelled"
        ) {
          return false;
        }

        if (input.doctorId) {
          return appointment.doctorId === input.doctorId;
        }

        return (
          appointment.serviceId === input.serviceId && !appointment.doctorId
        );
      })
      .map((appointment) => appointment.scheduledAt.slice(11, 16));

    return [...new Set([...bookingTimes, ...appointmentTimes])].sort();
  }

  const client = requireSupabase();
  const { data, error } = await (client as any).rpc(
    "get_blocked_booking_slots",
    {
      booking_date: input.date,
      booking_doctor_id: input.doctorId ?? null,
      booking_service_id: input.serviceId ?? null,
    },
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ preferred_time: string }>).map((row) =>
    row.preferred_time.slice(0, 5),
  );
}

export async function getBookingByReceiptCodeLiveOrDemo(receiptCode: string) {
  if (!isSupabaseConfigured) {
    const { getBookingByReceiptCode } = await import("./local-db");
    const booking = getBookingByReceiptCode(receiptCode);
    if (!booking) {
      return null;
    }

    const database = getDatabase();
    return {
      id: booking.id,
      patientId: booking.patientId,
      serviceId: booking.serviceId,
      serviceName:
        database.services.find((service) => service.id === booking.serviceId)
          ?.name ?? "Service",
      doctorId: booking.doctorId || null,
      doctorName:
        database.users.find((doctor) => doctor.id === booking.doctorId)
          ?.fullName ?? null,
      preferredDate: booking.preferredDate,
      preferredTime: booking.preferredTime,
      status: booking.status,
      intakeNotes: booking.intakeNotes,
      createdAt: booking.createdAt,
      feeType: booking.feeType,
      feeAmount: booking.feeAmount,
      receiptCode: booking.receiptCode,
      paymentStatus: booking.paymentStatus,
    };
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("receipt_code", receiptCode)
    .maybeSingle();
  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const services = await getBookableServicesLiveOrDemo();
  const doctors = await getDoctorDirectoryLiveOrDemo();
  const serviceMap = new Map(
    services.map((service) => [service.id, service.name]),
  );
  const doctorMap = new Map(
    doctors.map((doctor) => [doctor.id, doctor.fullName]),
  );

  return buildBookingListItemFromRow(data as BookingRow, {
    serviceMap,
    doctorMap,
  });
}

export async function markBookingPaidAndCreateInvoiceLiveOrDemo(
  receiptCode: string,
) {
  if (!isSupabaseConfigured) {
    const { markBookingPaidAndCreateInvoice } = await import("./local-db");
    return markBookingPaidAndCreateInvoice(receiptCode);
  }

  const client = requireSupabase();
  const { data: bookingRow, error: bookingError } = await client
    .from("bookings")
    .select("*")
    .eq("receipt_code", receiptCode)
    .single();
  if (bookingError) {
    throw bookingError;
  }

  const booking = bookingRow as BookingRow;
  let invoice: { id: string; invoice_number?: string; total?: number } | null =
    null;
  const existingAppointmentId = booking.appointment_id ?? null;

  if (booking.payment_status !== "paid") {
    let createdAppointmentId: string | null = null;
    let createdInvoiceId: string | null = null;
    try {
      let appointmentId = existingAppointmentId;
      if (!appointmentId) {
        const scheduledAt = resolveBookingScheduledAtIso({
          preferredDate: booking.preferred_date,
          preferredTime: booking.preferred_time,
          fallbackIso: booking.created_at,
        });
        const appointmentPayload: Database["public"]["Tables"]["appointments"]["Insert"] = {
          patient_id: booking.patient_id,
          doctor_id: booking.doctor_id ?? null,
          specialty_id: null,
          service_id: booking.service_id,
          booking_id: booking.id,
          scheduled_at: scheduledAt,
          status: "scheduled",
          source: "internal",
          reason:
            booking.fee_type === "follow_up"
              ? "Follow-up Fee"
              : booking.fee_type === "consultation"
                ? "Consultation Fee"
                : "Medical Service Fee",
          notes: booking.intake_notes,
        };

        const { data: createdAppointmentRow, error: appointmentError } = await client
          .from("appointments")
          .insert(appointmentPayload as never)
          .select("*")
          .single();
        if (appointmentError) {
          throw appointmentError;
        }

        const createdAppointment = createdAppointmentRow as AppointmentRow;
        createdAppointmentId = createdAppointment.id;
        appointmentId = createdAppointment.id;
      }

      await updateBookingPaymentStatusWithOptionalAppointmentLink(client, {
        bookingId: booking.id,
        paymentStatus: "paid",
        appointmentId,
      });

      const invoicePayload = {
        patient_id: booking.patient_id,
        appointment_id: appointmentId,
        invoice_number: `INV-${Date.now()}`,
        payment_status: "paid",
        subtotal: booking.fee_amount,
        total: booking.fee_amount,
      };

      const { data: createdInvoiceRow, error: invoiceError } = await client
        .from("invoices")
        .insert(invoicePayload as never)
        .select("*")
        .single();
      if (invoiceError) {
        throw invoiceError;
      }
      const createdInvoice = createdInvoiceRow as {
        id: string;
        invoice_number?: string;
        total?: number;
      };
      createdInvoiceId = createdInvoice.id;
      invoice = createdInvoice;
    } catch (error) {
      if (createdAppointmentId) {
        await updateBookingPaymentStatusWithOptionalAppointmentLink(client, {
          bookingId: booking.id,
          paymentStatus: booking.payment_status,
          appointmentId: null,
        });
        await client.from("appointments").delete().eq("id", createdAppointmentId);
      }

      throw error;
    }

    try {
      const services = await getBookableServicesLiveOrDemo();
      const serviceName =
        services.find((service) => service.id === booking.service_id)?.name ??
        "Medical Service";
      const lineDescription =
        booking.fee_type === "follow_up"
          ? "Follow-up Fee"
          : booking.fee_type === "consultation"
            ? "Consultation Fee"
            : serviceName;
      const category =
        booking.fee_type === "service_fee" ? "other" : "consultation";

      const { error: itemError } = await client.from("invoice_items").insert({
        invoice_id: createdInvoiceId ?? invoice?.id ?? '',
        description: lineDescription,
        quantity: 1,
        unit_price: booking.fee_amount,
        category,
      } as never);

      if (itemError) {
        throw itemError;
      }
    } catch (error) {
      if (createdInvoiceId) {
        await client.from("invoice_items").delete().eq("invoice_id", createdInvoiceId);
        await client.from("invoices").delete().eq("id", createdInvoiceId);
        await updateBookingPaymentStatusWithOptionalAppointmentLink(client, {
          bookingId: booking.id,
          paymentStatus: booking.payment_status,
          appointmentId: null,
        });
        await client.from("appointments").delete().eq("id", createdAppointmentId ?? '');
      }

      throw error;
    }
  }

  return {
    booking: await getBookingByReceiptCodeLiveOrDemo(receiptCode),
    invoice,
  };
}

export async function listUsersLiveOrDemo() {
  if (!isSupabaseConfigured) {
    return getDatabase().users.map(applyUserAccessRoleAssignment);
  }

  const client = requireSupabase() as any;
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }

  const profiles = (data ?? []) as ProfileRow[];
  const profileIds = profiles.map((profile) => profile.id);
  const accessRoleMap = await getAccessRoleMapForProfiles(profileIds);

  return profiles.map((profile) =>
    mapProfile(profile, { accessRole: accessRoleMap.get(profile.id) ?? null }),
  );
}

async function getAccessRoleMapForProfiles(profileIds: string[]) {
  const nextMap = new Map<string, AccessRoleTemplate>();
  if (!isSupabaseConfigured || profileIds.length === 0) {
    return nextMap;
  }

  const client = requireSupabase() as any;
  const { data: assignments, error: assignmentError } = await client
    .from("profile_access_roles")
    .select("profile_id, access_role_id")
    .in("profile_id", profileIds);

  if (assignmentError) {
    if (isMissingAccessRoleTableError(assignmentError)) {
      return nextMap;
    }
    throw assignmentError;
  }

  const typedAssignments = (assignments ?? []) as Array<Pick<Database["public"]["Tables"]["profile_access_roles"]["Row"], "profile_id" | "access_role_id">>;
  const roleIds = Array.from(new Set(typedAssignments.map((assignment) => assignment.access_role_id)));

  if (roleIds.length === 0) {
    return nextMap;
  }

  const { data: roles, error: roleError } = await client
    .from("access_roles")
    .select("*")
    .in("id", roleIds);

  if (roleError) {
    if (isMissingAccessRoleTableError(roleError)) {
      return nextMap;
    }
    throw roleError;
  }

  const typedRoles = (roles ?? []) as AccessRoleRow[];
  const rolesById = new Map(typedRoles.map((role) => [role.id, mapAccessRole(role)]));
  for (const assignment of typedAssignments) {
    const accessRole = rolesById.get(assignment.access_role_id);
    if (accessRole) {
      nextMap.set(assignment.profile_id, accessRole);
    }
  }

  return nextMap;
}

export async function listAccessRolesLiveOrDemo() {
  if (!isSupabaseConfigured) {
    return listDemoAccessRoles();
  }

  const client = requireSupabase() as any;
  const { data, error } = await client
    .from("access_roles")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    if (isMissingAccessRoleTableError(error)) {
      return listDemoAccessRoles();
    }
    throw error;
  }

  return ((data ?? []) as AccessRoleRow[]).map(mapAccessRole);
}

export async function createAccessRoleLiveOrDemo(
  input: Omit<AccessRoleTemplate, "id" | "createdAt" | "updatedAt" | "isSystem">,
) {
  if (!isSupabaseConfigured) {
    return createDemoAccessRole(input);
  }

  const client = requireSupabase() as any;
  const { data, error } = await client
    .from("access_roles")
    .insert({
      name: input.name.trim(),
      description: input.description.trim(),
      permission_codes: input.permissions,
      is_system: false,
    } as Database["public"]["Tables"]["access_roles"]["Insert"])
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapAccessRole(data as AccessRoleRow);
}

export async function updateAccessRoleLiveOrDemo(
  id: string,
  input: Omit<AccessRoleTemplate, "id" | "createdAt" | "updatedAt" | "isSystem">,
) {
  if (!isSupabaseConfigured) {
    return updateDemoAccessRoleRecord(id, input);
  }

  const client = requireSupabase() as any;
  const { data: existingRole, error: existingRoleError } = await client
    .from("access_roles")
    .select("id, is_system")
    .eq("id", id)
    .maybeSingle();

  if (existingRoleError) {
    throw existingRoleError;
  }

  const typedExistingRole = (existingRole ?? null) as Pick<AccessRoleRow, "id" | "is_system"> | null;
  if (!typedExistingRole) {
    throw new Error("Access role not found.");
  }

  if (typedExistingRole.is_system) {
    throw new Error("System roles cannot be edited here.");
  }

  const { data, error } = await client
    .from("access_roles")
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      permission_codes: input.permissions,
    } as Database["public"]["Tables"]["access_roles"]["Update"])
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapAccessRole(data as AccessRoleRow);
}

export async function deleteAccessRoleLiveOrDemo(id: string) {
  if (!isSupabaseConfigured) {
    return deleteDemoAccessRoleRecord(id);
  }

  const client = requireSupabase() as any;
  const { data: existingRole, error: existingRoleError } = await client
    .from("access_roles")
    .select("id, is_system")
    .eq("id", id)
    .maybeSingle();

  if (existingRoleError) {
    throw existingRoleError;
  }

  const typedExistingRole = (existingRole ?? null) as Pick<AccessRoleRow, "id" | "is_system"> | null;
  if (!typedExistingRole) {
    return;
  }

  if (typedExistingRole.is_system) {
    throw new Error("Built-in system roles cannot be deleted.");
  }

  const { error } = await client.from("access_roles").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function assignAccessRoleToProfileLiveOrDemo(input: {
  userId?: string;
  email: string;
  accessRoleId: string;
}) {
  if (!isSupabaseConfigured) {
    saveUserAccessRoleAssignment(input);
    return;
  }

  if (!input.userId) {
    throw new Error("A live access role assignment requires a user id.");
  }

  const client = requireSupabase() as any;
  const { error } = await client
    .from("profile_access_roles")
    .upsert(
      {
        profile_id: input.userId,
        access_role_id: input.accessRoleId,
      } as Database["public"]["Tables"]["profile_access_roles"]["Insert"],
      { onConflict: "profile_id" },
    );

  if (error) {
    throw error;
  }
}

export async function createAdminUserLiveOrDemo(input: AdminCreateUserInput) {
  if (!isSupabaseConfigured) {
    const { createUserProfile } = await import("./local-db");
    const fullName =
      `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
    return createUserProfile({
      authUserId: `demo_${input.email}`,
      email: input.email,
      fullName,
      role: input.role,
      phone: input.contactNumber,
      title: null,
      specialtyId: null,
      consultationFee:
        input.role === "doctor" ? (input.consultationFee ?? 0) : null,
      followUpFee: input.role === "doctor" ? (input.followUpFee ?? 0) : null,
    });
  }

  const payload: Record<string, unknown> = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    contactNumber: input.contactNumber.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    role: input.role,
  };

  if (input.role === "doctor") {
    payload.prcLicenseNumber = input.prcLicenseNumber?.trim() ?? "";
    payload.prcLicenseExpiry = input.prcLicenseExpiry?.trim() ?? "";
    payload.birNumber = input.birNumber?.trim() ?? "";
    payload.consultationFee = input.consultationFee ?? 0;
    payload.followUpFee = input.followUpFee ?? 0;
    if (input.prcIdFile) {
      payload.prcIdFile = {
        name: input.prcIdFile.name,
        type: input.prcIdFile.type || "application/octet-stream",
        dataUrl: await readFileAsDataUrl(input.prcIdFile),
      };
    }
  }

  const data = await invokeSupabaseFunction<AdminCreateUserResponse>(
    "admin-create-user",
    payload,
  );
  if (!data.user) {
    throw new Error("Account creation did not return the created user.");
  }

  return data.user;
}

export interface AdminUpdateUserInput {
  firstName: string;
  lastName: string;
  contactNumber: string;
  email: string;
  role: Exclude<Role, "patient">;
  permissions?: AdminCreateUserInput["permissions"];
  prcLicenseNumber?: string;
  prcLicenseExpiry?: string;
  birNumber?: string;
  consultationFee?: number;
  followUpFee?: number;
}

export async function updateAdminUserLiveOrDemo(
  userId: string,
  input: AdminUpdateUserInput,
) {
  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

  if (!isSupabaseConfigured) {
    const updatedUser = updateUserProfileRecord(userId, {
      authUserId: userId,
      email: input.email.trim().toLowerCase(),
      fullName,
      role: input.role,
      permissions: input.permissions,
      phone: input.contactNumber.trim(),
      title: null,
      specialtyId: null,
      consultationFee:
        input.role === "doctor" ? (input.consultationFee ?? 0) : null,
      followUpFee: input.role === "doctor" ? (input.followUpFee ?? 0) : null,
    });

    if (!updatedUser) {
      throw new Error("Updated user could not be loaded.");
    }

    return applyUserPermissionOverride(updatedUser);
  }

  const existingProfile = await getCurrentProfile(userId);
  if (!existingProfile) {
    throw new Error("User profile not found.");
  }

  if (existingProfile.role !== input.role) {
    throw new Error(
      "Changing the role of a live account is not supported from this screen yet.",
    );
  }

  const client = requireSupabase();
  const { error: profileError } = await client
    .from("profiles")
    .update({
      full_name: fullName,
      phone: input.contactNumber.trim() || null,
    } as never)
    .eq("id", userId);

  if (profileError) {
    throw profileError;
  }

  if (input.role === "doctor") {
    await saveDoctorFeeSettingsForProfileLiveOrDemo(userId, {
      consultationFee: input.consultationFee ?? 0,
      followUpFee: input.followUpFee ?? 0,
    });
  }

  const refreshedProfile = await getCurrentProfile(userId);
  if (!refreshedProfile) {
    throw new Error("Updated user profile could not be loaded.");
  }

  return refreshedProfile;
}

export async function deleteAdminUserLiveOrDemo(
  userId: string,
  options?: { email?: string },
) {
  if (!isSupabaseConfigured) {
    deleteUserProfileRecord(userId);
    clearUserAccessRoleAssignment({ userId, email: options?.email });
    clearUserPermissionOverride({ userId, email: options?.email });
    return;
  }

  throw new Error(
    "Deleting live user accounts is not available yet because the auth account also needs an admin-side delete flow.",
  );
}

  export async function updateCurrentStaffProfileLiveOrDemo(
    userId: string,
    input: { phone?: string; title?: string | null },
  ) {
    if (!isSupabaseConfigured) {
      const currentUser = getDatabase().users.find((profile) => profile.id === userId || profile.authUserId === userId);
      if (!currentUser) {
        throw new Error("Updated user could not be loaded.");
      }

      const updatedUser = updateUserProfileRecord(userId, {
        ...currentUser,
        phone: input.phone?.trim() || '',
        title: input.title?.trim() || null,
      });

      if (!updatedUser) {
        throw new Error("Updated user could not be loaded.");
      }

      return updatedUser;
    }

    const client = requireSupabase();
    const { error } = await client
      .from("profiles")
      .update({
        phone: input.phone?.trim() || '',
        title: input.title?.trim() || null,
      } as never)
      .eq("id", userId);

    if (error) {
      throw error;
    }

    const refreshedProfile = await getCurrentProfile(userId);
    if (!refreshedProfile) {
      throw new Error("Updated user profile could not be loaded.");
    }

    return refreshedProfile;
  }

export async function updatePatientAccountLiveOrDemo(
  userId: string,
  input: Pick<
    Patient,
    | "mobileNumber"
    | "address"
    | "allergies"
    | "medicalHistory"
    | "emergencyContactName"
    | "emergencyContactPhone"
  >,
) {
  if (!isSupabaseConfigured) {
    return updatePatientProfileAccount(userId, input);
  }

  const client = requireSupabase();
  const { error: patientError } = await client
    .from("patients")
    .update({
      mobile_number: input.mobileNumber || null,
      address: input.address || null,
      allergies: input.allergies,
      medical_history: input.medicalHistory,
      emergency_contact_name: input.emergencyContactName || null,
      emergency_contact_phone: input.emergencyContactPhone || null,
    } as never)
    .eq("user_id", userId);

  if (patientError) {
    throw patientError;
  }

  const { error: profileError } = await client
    .from("profiles")
    .update({
      phone: input.mobileNumber || null,
    } as never)
    .eq("id", userId);

  if (profileError) {
    throw profileError;
  }

  const refreshedPatient = await getCurrentPatient(userId);
  if (!refreshedPatient) {
    throw new Error("Updated patient profile could not be loaded.");
  }

  return refreshedPatient;
}

export async function updateCurrentUserPasswordLiveOrDemo(newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  if (!isSupabaseConfigured) {
    return;
  }

  const client = requireSupabase();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    throw error;
  }
}

export async function verifyOdcCredentialLiveOrDemo(input: OdcCredentialInput) {
  const normalized = normalizeOdcCredential(input);
  if (!normalized.accessKey && !normalized.recoveryPassword) {
    return false;
  }

  if (!isSupabaseConfigured) {
    return normalized.accessKey === odcAccessConfig.demoAccessKey;
  }

  const data = await invokeOdcFunction<OdcVerifyResponse>({
    mode: "verify",
    ...normalized,
  });

  return data.valid === true;
}

export async function updateSystemControlLiveOrDemo(
  input: OdcCredentialInput & {
    systemEnabled: boolean;
    systemMessage: string;
  },
) {
  const normalized = normalizeOdcCredential(input);

  if (!isSupabaseConfigured) {
    if (normalized.accessKey !== odcAccessConfig.demoAccessKey) {
      throw new Error("Invalid ODC credential.");
    }

    const { updateClinicSettings } = await import("./local-db");
    return updateClinicSettings({
      systemEnabled: input.systemEnabled,
      systemMessage: input.systemMessage,
    });
  }

  const data = await invokeOdcFunction<OdcUpdateResponse>({
    mode: "update",
    ...normalized,
    systemEnabled: input.systemEnabled,
    systemMessage: input.systemMessage,
  });

  if (!data.clinicSettings) {
    throw new Error("System control update did not return clinic settings.");
  }

  return mapClinicSettings(data.clinicSettings);
}

export async function getSupplier(): Promise<Supplier[]> {
  if (!isSupabaseConfigured) {
    const { listSuppliers } = await import("./local-db");
    return listSuppliers();
  }

  const client = requireSupabase();
  const { data, error } = await client.from("suppliers").select("*");
  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    id: string;
    name: string;
    contact_person: string;
    phone: string;
    email: string;
    created_at: string;
    updated_at: string;
  }>).map((row) => ({
    id: row.id,
    name: row.name,
    contact_person: row.contact_person,
    phone: row.phone,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createSupplier(values: {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
}) {
  if (!isSupabaseConfigured) {
    const { createSupplier: createSupplierLocal } = await import("./local-db");
    return createSupplierLocal(values);
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("suppliers")
    .insert({
      name: values.name,
      contact_person: values.contact_person,
      phone: values.phone,
      email: values.email,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateSupplier(
  id: string,
  values: { name: string; contact_person: string; phone: string; email: string },
) {
  if (!isSupabaseConfigured) {
    const { updateSupplierRecord } = await import("./local-db");
    return updateSupplierRecord(id, values);
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("suppliers")
    .update({
      name: values.name,
      contact_person: values.contact_person,
      phone: values.phone,
      email: values.email,
    } as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteSupplier(id: string) {
  if (!isSupabaseConfigured) {
    const { deleteSupplierRecord } = await import("./local-db");
    deleteSupplierRecord(id);
    return;
  }

  const client = requireSupabase();
  const { error } = await client.from("suppliers").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function getCategories(): Promise<Array<{ id: string; name: string }>> {
  if (!isSupabaseConfigured) {
    return getDatabase().inventoryCategories.map((category) => ({
      id: category.id,
      name: category.name,
    }));
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("inventory_categories")
    .select("id,name");

  if (error) {
    throw error;
  }

  return (data ?? []) as Array<{ id: string; name: string }>;
}

export async function getInventoryItems(page: number): Promise<InventoryItem[]> {
  if (!isSupabaseConfigured) {
    const { listInventoryItems } = await import("./local-db");
    return listInventoryItems();
  }

  const limit = 10;
  const from = Math.max(0, (page - 1) * limit);
  const to = from + limit - 1;
  const client = requireSupabase();
  const { data, error } = await client
    .from("inventory_items")
    .select("*")
    .range(from, to);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    id: string;
    category_id: string;
    supplier_id: string | null;
    qr_code: string;
    name: string;
    sku: string;
    unit: string;
    stock_on_hand: number;
    reorder_level: number;
    created_at: string;
    updated_at: string;
  }>).map((row) => ({
    id: row.id,
    category_id: row.category_id,
    supplier_id: row.supplier_id,
    qrCode: row.qr_code,
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    stockOnHand: Number(row.stock_on_hand ?? 0),
    reorderLevel: Number(row.reorder_level ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createInventoryItem(values: {
  categoryId: string;
  supplierId: string;
  name: string;
  sku: string;
  unit: string;
  stockOnHand: number;
  reorderLevel: number;
}) {
  if (!isSupabaseConfigured) {
    const { createInventoryItem: createInventoryItemLocal } = await import("./local-db");
    return createInventoryItemLocal({
      category_id: values.categoryId,
      supplier_id: values.supplierId || null,
      name: values.name,
      sku: values.sku,
      unit: values.unit,
      stockOnHand: values.stockOnHand,
      reorderLevel: values.reorderLevel,
    });
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("inventory_items")
    .insert({
      category_id: values.categoryId,
      supplier_id: values.supplierId || null,
      name: values.name,
      sku: values.sku,
      unit: values.unit,
      stock_on_hand: values.stockOnHand,
      reorder_level: values.reorderLevel,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateInventoryItems(
  itemId: string,
  values: {
    categoryId: string;
    supplierId: string;
    name: string;
    sku: string;
    unit: string;
    stockOnHand: number;
    reorderLevel: number;
  },
) {
  if (!isSupabaseConfigured) {
    const { updateInventoryItemRecord } = await import("./local-db");
    return updateInventoryItemRecord(itemId, {
      category_id: values.categoryId,
      supplier_id: values.supplierId || null,
      name: values.name,
      sku: values.sku,
      unit: values.unit,
      stockOnHand: values.stockOnHand,
      reorderLevel: values.reorderLevel,
    });
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("inventory_items")
    .update({
      category_id: values.categoryId,
      supplier_id: values.supplierId || null,
      name: values.name,
      sku: values.sku,
      unit: values.unit,
      stock_on_hand: values.stockOnHand,
      reorder_level: values.reorderLevel,
    } as never)
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteInventoryItem(id: string) {
  if (!isSupabaseConfigured) {
    const { deleteInventoryItemRecord } = await import("./local-db");
    deleteInventoryItemRecord(id);
    return;
  }

  const client = requireSupabase();
  const { error } = await client.from("inventory_items").delete().eq("id", id);
  if (error) {
    throw error;
  }
}
