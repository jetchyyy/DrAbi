import type { User } from "@supabase/supabase-js";

import { defaultClinicSettings } from "../config/clinic";
import { normalizeEnabledModules } from "../config/modules";
import { odcAccessConfig } from "../config/odc-access";
import {
  applyUserPermissionOverride,
  applyUserAccessRoleAssignment,
  clearUserAccessRoleAssignment,
  clearUserPermissionOverride,
  createAccessRole as createDemoAccessRole,
  claimWalkInPatientAccount,
  deleteAccessRoleRecord as deleteDemoAccessRoleRecord,
  getClinicSettings as getDemoClinicSettings,
  getDatabase,
  getWalkInPatientByUniqueLoginId,
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
  InventoryCategory,
  InventoryItem,
  BookingFeeType,
  BookingPaymentStatus,
  Invoice,
  InvoiceItem,
  LabRequestDocument,
  MedicalCertificate,
  Patient,
  PaymentStatus,
  PosPaymentMethod,
  PosSale,
  PosSaleItem,
  Prescription,
  Permission,
  Role,
  Service,
  ServiceDeliveryMode,
  ServiceType,
  Specialty,
  Supplier,
  UserProfile,
  InventoryUsageLog,
} from "../types/domain";
import type { Database } from "../types/database";
import {
  generateBookingReceiptCode,
  generatePatientQrCode,
  generateWalkInUniqueLoginId,
  toUtcIsoFromPhilippineDateTime,
} from "./utils";
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";

export interface DoctorDirectoryItem {
  id: string;
  profileId: string;
  fullName: string;
  title?: string | null;
  role: Role;
  specialtyId: string | null;
  specialtyName: string | null;
  licenseNumber: string | null;
  birNumber: string | null;
  ptrNumber: string | null;
  consultationFee: number;
  followUpFee: number;
}

export interface PatientMedicalHistoryEntryInput {
  patientId: string;
  providerId: string | null;
  actor: string | null;
  historyText?: string;
  findingsText?: string;
  diagnosesText?: string;
  treatmentSummaryText?: string;
  soapNotesText: string;
  supplementaryDocsText?: string;
  appointmentId?: string | null;
  consultationId?: string | null;
}

export interface BookingListItem {
  id: string;
  patientId: string;
  patientName: string | null;
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

export interface PatientTeleconsultationSummary {
  id: string;
  scheduledAt: string;
  status: Appointment["status"];
  doctorName: string;
  serviceName: string;
  teleconsultationPlatform: string;
  teleconsultationAccessInstructions: string;
  joinPath: string;
}

export interface WalkInUniqueLoginProfile {
  patientId: string;
  uniqueLoginId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  mobileNumber: string;
  email: string;
  address: string;
  bloodType: string;
  allergies: string;
  medicalHistory: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  accountLinked: boolean;
}

async function buildBookingListItemFromRow(
  row: BookingRow,
  maps?: {
    serviceMap?: Map<string, string>;
    doctorMap?: Map<string, string>;
    patientName?: string | null;
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
    patientName: maps?.patientName ?? null,
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
  clinicSettings?: ClinicSettingsRow;
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
type SpecialistScheduleRow =
  Database["public"]["Tables"]["specialist_schedules"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type ConsultationRow = Database["public"]["Tables"]["consultations"]["Row"];
type PrescriptionRow = Database["public"]["Tables"]["prescriptions"]["Row"];
type MedicalCertificateRow =
  Database["public"]["Tables"]["medical_certificates"]["Row"];
type LabRequestDocumentRow =
  Database["public"]["Tables"]["lab_request_documents"]["Row"];

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
    case "specialist":
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
    const candidate = toUtcIsoFromPhilippineDateTime(
      `${dateValue}T${timeValue}`,
    );
    if (candidate) {
      return candidate;
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
    (message.includes("access_roles") ||
      message.includes("profile_access_roles"))
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
    uniqueLoginId: row.unique_login_id,
    walkInAccountClaimedAt: row.walk_in_account_claimed_at,
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
    temperature: row.temperature ?? undefined,
    bloodPressure: row.blood_pressure ?? undefined,
    heartRate: row.heart_rate ?? undefined,
    o2Sat: row.o2_sat ?? undefined,
    respiratoryRate: row.respiratory_rate ?? undefined,
    weight: row.weight ?? undefined,
    height: row.height ?? undefined,
    vitalsRecordedAt: row.vitals_recorded_at ?? undefined,
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
    additionalDoctorIds: row.additional_doctor_ids ?? [],
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

function mapTeleconsultationStatus(
  value: string | null | undefined,
): Appointment["status"] {
  switch (value) {
    case "scheduled":
    case "confirmed":
    case "in_progress":
    case "completed":
    case "cancelled":
    case "no_show":
      return value;
    default:
      return "scheduled";
  }
}

function getTeleconsultationPlatformLabel(value: string | null | undefined) {
  return value?.trim() || "Jitsi Meet";
}

function getTeleconsultationAccessInstructions(
  value: string | null | undefined,
) {
  return (
    value?.trim() ||
    "Use the in-app Join teleconsult button a few minutes before your scheduled appointment."
  );
}

function mapBookingStatus(value: string) {
  switch (value) {
    case "pending":
    case "confirmed":
    case "rescheduled":
    case "cancelled":
    case "completed":
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
    promoCodeId: (row as any).promo_code_id ?? null,
    discountAmount: (row as any).discount_amount ? Number((row as any).discount_amount) : 0,
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

function mapInvoiceRow(row: {
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
}): Invoice {
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

function mapInvoiceItemCategory(
  value: string | null | undefined,
): InvoiceItem["category"] {
  switch (value) {
    case "consultation":
    case "laboratory":
    case "medicine":
    case "other":
      return value;
    default:
      return "other";
  }
}

function mapInvoiceItemRow(row: {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  category: string | null;
  created_at: string;
  updated_at: string;
}): InvoiceItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    description: row.description,
    quantity: Number(row.quantity ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    category: mapInvoiceItemCategory(row.category),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPosPaymentMethod(
  value: string | null | undefined,
): PosPaymentMethod {
  switch (value) {
    case "cash":
    case "gcash":
    case "card":
      return value;
    default:
      return "cash";
  }
}

function mapPosSaleRow(row: {
  id: string;
  sale_number: string;
  patient_id: string | null;
  cashier_id: string;
  payment_method: string | null;
  payment_reference: string | null;
  payment_notes: string | null;
  subtotal: number;
  total: number;
  created_at: string;
  updated_at: string;
}): PosSale {
  return {
    id: row.id,
    saleNumber: row.sale_number,
    patientId: row.patient_id,
    cashierId: row.cashier_id,
    paymentMethod: mapPosPaymentMethod(row.payment_method),
    paymentReference: row.payment_reference,
    paymentNotes: row.payment_notes,
    subtotal: Number(row.subtotal ?? 0),
    total: Number(row.total ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPosSaleItemRow(row: {
  id: string;
  sale_id: string;
  inventory_item_id: string;
  item_name: string;
  item_sku: string;
  item_unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
  updated_at: string;
}): PosSaleItem {
  return {
    id: row.id,
    saleId: row.sale_id,
    inventoryItemId: row.inventory_item_id,
    itemName: row.item_name,
    itemSku: row.item_sku,
    itemUnit: row.item_unit,
    quantity: Number(row.quantity ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    lineTotal: Number(row.line_total ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
    brandName: row.brand_name ?? null,
    dosage: row.dosage,
    instruction: row.instruction ?? row.instructions,
    numberOfMedications: row.number_of_medications ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMedicalCertificate(row: MedicalCertificateRow): MedicalCertificate {
  return {
    id: row.id,
    consultationId: row.consultation_id,
    patientId: row.patient_id,
    checkFinancial: row.check_financial ?? false,
    checkSchool: row.check_school ?? false,
    checkWork: row.check_work ?? false,
    certificatePurpose: row.certificate_purpose,
    diagnosis: row.diagnosis,
    recommendation: row.recommendation,
    restFrom: row.rest_from,
    restUntil: row.rest_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function buildMedicalCertificateNumberMap(
  client: ReturnType<typeof requireSupabase>,
) {
  const { data, error } = await client
    .from("medical_certificates")
    .select("id,created_at")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  const numberById = new Map<string, number>();
  (data ?? []).forEach((row, index) => {
    const typedRow = row as { id: string };
    numberById.set(typedRow.id, index + 1);
  });

  return numberById;
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

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function mapSpecialistRecurrenceDayToJsDay(day: number) {
  return (day + 1) % 7;
}

function mapJsDayToSpecialistRecurrenceDay(day: number) {
  return (day + 6) % 7;
}

function mapSpecialistScheduleRowsToAvailability(
  specialistId: string,
  schedules: SpecialistScheduleRow[],
): DoctorAvailability[] {
  return schedules.flatMap((row) => {
    const recurrence = parseJsonArray<number>(row.recurrence).map(
      mapSpecialistRecurrenceDayToJsDay,
    );
    const slotTemplate = parseJsonArray<{ start?: string; end?: string }>(
      row.slot_template,
    );

    return recurrence.flatMap((dayOfWeek) =>
      slotTemplate
        .filter((slot): slot is { start: string; end: string } =>
          Boolean(slot.start && slot.end),
        )
        .map((slot) => ({
          id: `${row.id}:${dayOfWeek}:${slot.start}`,
          doctorId: specialistId,
          dayOfWeek,
          startTime: slot.start,
          endTime: slot.end,
          slotMinutes:
            Math.max(
              15,
              Math.round(
                (new Date(`1970-01-01T${slot.end}`).getTime() -
                  new Date(`1970-01-01T${slot.start}`).getTime()) /
                  60000,
              ),
            ) || 30,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
    );
  });
}

export async function listPatientsLiveOrDemo() {
  if (!isSupabaseConfigured) {
    const database = getDatabase();
    const patientIdsWithAppointment = new Set(
      database.appointments
        .filter((appointment) => appointment.patientId && hasConsultationAppointment(appointment.status))
        .map((appointment) => appointment.patientId as string),
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
    client
      .from("appointments")
      .select("patient_id,status")
      .is("deleted_at", null),
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
    (
      (appointmentResult.data ?? []) as Array<{
        patient_id: string | null;
        status: string | null;
      }>
    )
      .filter(
        (appointment) =>
          Boolean(appointment.patient_id) &&
          hasConsultationAppointment(appointment.status),
      )
      .map((appointment) => appointment.patient_id as string),
  );
  const patientIdsWithBooking = new Set(
    (
      (bookingResult.data ?? []) as Array<{
        patient_id: string | null;
        status: string | null;
      }>
    )
      .filter(
        (booking) =>
          Boolean(booking.patient_id) && hasConsultationBooking(booking.status),
      )
      .map((booking) => booking.patient_id as string),
  );

  const patientRows = (data ?? []) as PatientRow[];
  const linkedUserIds = Array.from(
    new Set(
      patientRows
        .map((row) => row.user_id)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );

  const allowedUserIds = new Set<string>();
  if (linkedUserIds.length > 0) {
    const { data: profileRows, error: profileError } = await client
      .from("profiles")
      .select("id, role")
      .in("id", linkedUserIds);

    if (profileError) {
      throw profileError;
    }

    for (const profile of (profileRows ?? []) as Array<{
      id: string;
      role: string | null;
    }>) {
      if (profile.role === "patient") {
        allowedUserIds.add(profile.id);
      }
    }
  }

  return patientRows
    .filter((row) => !row.user_id || allowedUserIds.has(row.user_id))
    .map((row) => {
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
  const intakeSource = input.intakeSource;
  const uniqueLoginId =
    input.uniqueLoginId ??
    (intakeSource === "staff_walk_in" ? generateWalkInUniqueLoginId() : null);
  const payload: Database["public"]["Tables"]["patients"]["Insert"] = {
    user_id: input.userId ?? null,
    qr_code: input.qrCode || generatePatientQrCode(),
    unique_login_id: uniqueLoginId,
    walk_in_account_claimed_at: input.walkInAccountClaimedAt ?? null,
    intake_source: intakeSource,
    visit_status: input.visitStatus,
    ...(input.lastClinicVisitAt !== undefined
      ? { last_clinic_visit_at: input.lastClinicVisitAt }
      : {}),
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
    temperature: input.temperature || null,
    blood_pressure: input.bloodPressure || null,
    heart_rate: input.heartRate || null,
    o2_sat: input.o2Sat || null,
    respiratory_rate: input.respiratoryRate || null,
    weight: input.weight || null,
    height: input.height || null,
    vitals_recorded_at: input.vitalsRecordedAt ?? null,
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

export async function createPatientMedicalHistoryEntryLiveOrDemo(
  input: PatientMedicalHistoryEntryInput,
) {
  if (!isSupabaseConfigured) {
    const { createPatientMedicalHistoryEntry } = await import("./local-db");
    return createPatientMedicalHistoryEntry({
      patientId: input.patientId,
      providerId: input.providerId ?? null,
      actor: input.actor ?? null,
      historyText: input.historyText ?? "",
      findingsText: input.findingsText ?? "",
      diagnosesText: input.diagnosesText ?? "",
      treatmentSummaryText: input.treatmentSummaryText ?? "",
      soapNotesText: input.soapNotesText,
      supplementaryDocsText: input.supplementaryDocsText ?? "",
      appointmentId: input.appointmentId ?? null,
      consultationId: input.consultationId ?? null,
    });
  }

  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["patient_medical_history_entries"]["Insert"] =
    {
      patient_id: input.patientId,
      consultation_id: input.consultationId ?? null,
      appointment_id: input.appointmentId ?? null,
      provider_id: input.providerId ?? null,
      history_text: input.historyText ?? "",
      findings_text: input.findingsText ?? "",
      diagnoses_text: input.diagnosesText ?? "",
      treatment_summary_text: input.treatmentSummaryText ?? "",
      soap_notes_text: input.soapNotesText,
      supplementary_docs_text: input.supplementaryDocsText ?? "",
      actor: input.actor ?? null,
    };

  const { data, error } = await client
    .from("patient_medical_history_entries")
    .insert(payload as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
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
    ...(input.uniqueLoginId !== undefined
      ? { unique_login_id: input.uniqueLoginId }
      : {}),
    ...(input.walkInAccountClaimedAt !== undefined
      ? { walk_in_account_claimed_at: input.walkInAccountClaimedAt }
      : {}),
    intake_source: input.intakeSource,
    visit_status: input.visitStatus,
    ...(input.lastClinicVisitAt !== undefined
      ? { last_clinic_visit_at: input.lastClinicVisitAt }
      : {}),
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
    temperature: input.temperature || null,
    blood_pressure: input.bloodPressure || null,
    heart_rate: input.heartRate || null,
    o2_sat: input.o2Sat || null,
    respiratory_rate: input.respiratoryRate || null,
    weight: input.weight || null,
    height: input.height || null,
    vitals_recorded_at: input.vitalsRecordedAt ?? null,
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
    return getDatabase()
      .bookings.filter((booking) => booking.patientId === patientId)
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

export async function listBookingsLiveOrDemo(): Promise<Booking[]> {
  if (!isSupabaseConfigured) {
    return getDatabase()
      .bookings.slice()
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
    .is("deleted_at", null)
    .order("preferred_date", { ascending: false })
    .order("preferred_time", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as BookingRow[]).map(mapBooking);
}

export async function listInvoicesLiveOrDemo(): Promise<Invoice[]> {
  if (!isSupabaseConfigured) {
    return getDatabase()
      .invoices.slice()
      .sort((left, right) => {
        if (left.createdAt === right.createdAt) {
          return right.invoiceNumber.localeCompare(left.invoiceNumber);
        }
        return right.createdAt.localeCompare(left.createdAt);
      });
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("invoices")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("invoice_number", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
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
    }>
  ).map(mapInvoiceRow);
}

export async function listInvoiceItemsLiveOrDemo(): Promise<InvoiceItem[]> {
  if (!isSupabaseConfigured) {
    return getDatabase()
      .invoiceItems.slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("invoice_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
      id: string;
      invoice_id: string;
      description: string;
      quantity: number;
      unit_price: number;
      category: string | null;
      created_at: string;
      updated_at: string;
    }>
  ).map(mapInvoiceItemRow);
}

export async function createInvoiceLiveOrDemo(
  invoice: Omit<Invoice, "id" | "createdAt" | "updatedAt">,
  items: Array<
    Omit<InvoiceItem, "id" | "createdAt" | "updatedAt" | "invoiceId">
  >,
) {
  if (!isSupabaseConfigured) {
    const { createInvoice } = await import("./local-db");
    return createInvoice(invoice, items);
  }

  const client = requireSupabase();
  const invoicePayload = {
    patient_id: invoice.patientId,
    appointment_id: invoice.appointmentId ?? null,
    invoice_number: invoice.invoiceNumber,
    payment_status: invoice.paymentStatus,
    subtotal: invoice.subtotal,
    total: invoice.total,
  };

  const { data, error } = await client
    .from("invoices")
    .insert(invoicePayload as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const createdInvoice = mapInvoiceRow(
    data as {
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
    },
  );

  if (items.length > 0) {
    const { error: itemError } = await client.from("invoice_items").insert(
      items.map((item) => ({
        invoice_id: createdInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        category: item.category,
      })) as never,
    );

    if (itemError) {
      await client.from("invoices").delete().eq("id", createdInvoice.id);
      throw itemError;
    }
  }

  return createdInvoice;
}

export async function updateInvoiceLiveOrDemo(
  invoiceId: string,
  invoice: Omit<Invoice, "id" | "createdAt" | "updatedAt">,
  items: Array<
    Omit<InvoiceItem, "id" | "createdAt" | "updatedAt" | "invoiceId">
  >,
) {
  if (!isSupabaseConfigured) {
    const { updateInvoiceRecord } = await import("./local-db");
    return updateInvoiceRecord(invoiceId, invoice, items);
  }

  const client = requireSupabase();
  const invoicePayload = {
    patient_id: invoice.patientId,
    appointment_id: invoice.appointmentId ?? null,
    invoice_number: invoice.invoiceNumber,
    payment_status: invoice.paymentStatus,
    subtotal: invoice.subtotal,
    total: invoice.total,
  };

  const { data, error } = await client
    .from("invoices")
    .update(invoicePayload as never)
    .eq("id", invoiceId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const { error: deleteItemsError } = await client
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoiceId);

  if (deleteItemsError) {
    throw deleteItemsError;
  }

  if (items.length > 0) {
    const { error: itemError } = await client.from("invoice_items").insert(
      items.map((item) => ({
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        category: item.category,
      })) as never,
    );

    if (itemError) {
      throw itemError;
    }
  }

  return mapInvoiceRow(
    data as {
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
    },
  );
}

export async function deleteInvoiceLiveOrDemo(invoiceId: string) {
  if (!isSupabaseConfigured) {
    const { deleteInvoiceRecord } = await import("./local-db");
    return deleteInvoiceRecord(invoiceId);
  }

  const client = requireSupabase();
  const { error } = await client.from("invoices").delete().eq("id", invoiceId);

  if (error) {
    throw error;
  }
}

export async function getLatestInvoiceByPatientIdLiveOrDemo(
  patientId: string,
  appointmentId?: string,
): Promise<Invoice | null> {
  if (!patientId) {
    return null;
  }

  if (!isSupabaseConfigured) {
    let invoices = getDatabase().invoices.filter(
      (invoice) => invoice.patientId === patientId,
    );

    // If appointmentId is provided, filter to that specific appointment
    if (appointmentId) {
      invoices = invoices.filter(
        (invoice) => invoice.appointmentId === appointmentId,
      );
    }

    const latest = invoices.sort((left, right) => {
      if (left.createdAt === right.createdAt) {
        return right.invoiceNumber.localeCompare(left.invoiceNumber);
      }
      return right.createdAt.localeCompare(left.createdAt);
    })[0];

    return latest ?? null;
  }

  const client = requireSupabase();
  let query = client.from("invoices").select("*").eq("patient_id", patientId);

  // If appointmentId is provided, filter to that specific appointment
  if (appointmentId) {
    query = query.eq("appointment_id", appointmentId);
  }

  const { data, error } = await query
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

  return mapInvoiceRow(row);
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

export async function listMedicalCertificatesByPatientIdLiveOrDemo(
  patientId: string,
): Promise<MedicalCertificate[]> {
  if (!isSupabaseConfigured) {
    const { listMedicalCertificatesByPatient } = await import("./local-db");
    return listMedicalCertificatesByPatient(patientId);
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("medical_certificates")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const certificateNumberById = await buildMedicalCertificateNumberMap(client);

  return ((data ?? []) as MedicalCertificateRow[]).map((row) => {
    const mapped = mapMedicalCertificate(row);
    return {
      ...mapped,
      certificateNumber: certificateNumberById.get(mapped.id) ?? null,
    };
  });
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
    teleconsultation_access_instructions:
      input.teleconsultationAccessInstructions ?? null,
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
    brand_name: input.brandName ?? null,
    instruction: input.instruction,
    number_of_medications: input.numberOfMedications ?? null,
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

export async function updatePrescriptionLiveOrDemo(input: {
  prescriptionId: string;
  prescriptionName: string;
  brandName?: string | null;
  dosage: string;
  instruction: string;
  numberOfMedications?: number | null;
}) {
  if (!isSupabaseConfigured) {
    const { updatePrescriptionRecord } = await import("./local-db");
    return updatePrescriptionRecord(input.prescriptionId, {
      prescriptionName: input.prescriptionName,
      brandName: input.brandName ?? null,
      dosage: input.dosage,
      instruction: input.instruction,
      numberOfMedications: input.numberOfMedications ?? null,
    });
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("prescriptions")
    .update({
      medication: input.prescriptionName,
      dosage: input.dosage,
      instructions: input.instruction,
      prescription_name: input.prescriptionName,
      brand_name: input.brandName ?? null,
      instruction: input.instruction,
      number_of_medications: input.numberOfMedications ?? null,
    } as never)
    .eq("id", input.prescriptionId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapPrescription(data as PrescriptionRow);
}

export async function createMedicalCertificateLiveOrDemo(
  input: Omit<MedicalCertificate, "id" | "createdAt" | "updatedAt">,
) {
  if (!isSupabaseConfigured) {
    const { createMedicalCertificate } = await import("./local-db");
    return createMedicalCertificate(input);
  }

  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["medical_certificates"]["Insert"] =
    {
      consultation_id: input.consultationId,
      patient_id: input.patientId,
      check_financial: input.checkFinancial ?? false,
      check_school: input.checkSchool ?? false,
      check_work: input.checkWork ?? false,
      certificate_purpose: input.certificatePurpose,
      diagnosis: input.diagnosis,
      recommendation: input.recommendation,
      rest_from: input.restFrom ?? null,
      rest_until: input.restUntil ?? null,
    };

  const { data, error } = await client
    .from("medical_certificates")
    .insert(payload as never)
    .select("*")
    .single();
  if (error) {
    throw error;
  }

  const mapped = mapMedicalCertificate(data as MedicalCertificateRow);
  const certificateNumberById = await buildMedicalCertificateNumberMap(client);

  return {
    ...mapped,
    certificateNumber: certificateNumberById.get(mapped.id) ?? null,
  };
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

function mapLabRequestDocument(row: LabRequestDocumentRow): LabRequestDocument {
  return {
    id: row.id,
    patientId: row.patient_id,
    consultationId: row.consultation_id ?? null,
    requestedBy: row.requested_by ?? null,
    targetLaboratory: row.target_laboratory,
    requestedTests: row.requested_tests,
    clinicalNotes: row.clinical_notes,
    documentHtml: row.document_html ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listLabRequestDocumentsByPatientIdLiveOrDemo(
  patientId: string,
): Promise<LabRequestDocument[]> {
  if (!isSupabaseConfigured) {
    const { listLabRequestDocumentsByPatient } = await import("./local-db");
    return listLabRequestDocumentsByPatient(patientId);
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("lab_request_documents")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as LabRequestDocumentRow[]).map(mapLabRequestDocument);
}

export async function createLabRequestDocumentLiveOrDemo(
  input: Omit<LabRequestDocument, "id" | "createdAt" | "updatedAt">,
): Promise<LabRequestDocument> {
  if (!isSupabaseConfigured) {
    const { createLabRequestDocument } = await import("./local-db");
    return createLabRequestDocument(input);
  }

  const client = requireSupabase();
  const payload: Database["public"]["Tables"]["lab_request_documents"]["Insert"] =
    {
      patient_id: input.patientId,
      consultation_id: input.consultationId ?? null,
      requested_by: input.requestedBy ?? null,
      target_laboratory: input.targetLaboratory,
      requested_tests: input.requestedTests,
      clinical_notes: input.clinicalNotes,
      document_html: input.documentHtml ?? null,
    };

  const { data, error } = await client
    .from("lab_request_documents")
    .insert(payload as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapLabRequestDocument(data as LabRequestDocumentRow);
}

function mapClinicSettings(row: ClinicSettingsRow): ClinicSettings {
  const rawRow = row as ClinicSettingsRow & { system_status_type?: string };
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
    systemStatusType: (rawRow.system_status_type === "restricted"
      ? "restricted"
      : "maintenance") as "maintenance" | "restricted",
    enabledModules: normalizeEnabledModules(row.enabled_modules),
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

export async function updateClinicSettingsLiveOrDemo(
  input: Partial<ClinicSettings>,
): Promise<ClinicSettings> {
  if (!isSupabaseConfigured) {
    const { updateClinicSettings } = await import("./local-db");
    return updateClinicSettings(input) as ClinicSettings;
  }

  const client = requireSupabase();

  // Fetch the current row id (singleton — only one row exists)
  const { data: existing, error: fetchError } = (await client
    .from("clinic_settings")
    .select("id")
    .limit(1)
    .maybeSingle()) as { data: { id: string } | null; error: any };

  if (fetchError) throw fetchError;
  if (!existing) throw new Error("Clinic settings row not found in Supabase.");

  const payload: Database["public"]["Tables"]["clinic_settings"]["Update"] = {};
  if (input.clinicName !== undefined) payload.clinic_name = input.clinicName;
  if (input.legalName !== undefined) payload.legal_name = input.legalName;
  if (input.shortCode !== undefined) payload.short_code = input.shortCode;
  if (input.address !== undefined) payload.address = input.address;
  if (input.contactNumber !== undefined)
    payload.contact_number = input.contactNumber;
  if (input.email !== undefined) payload.email = input.email;
  if (input.website !== undefined) payload.website = input.website;
  if (input.logoUrl !== undefined) payload.logo_url = input.logoUrl;
  if (input.primaryColor !== undefined)
    payload.primary_color = input.primaryColor;
  if (input.accentColor !== undefined) payload.accent_color = input.accentColor;
  if (input.bookingLeadDays !== undefined)
    payload.booking_lead_days = input.bookingLeadDays;
  if (input.bookingCancellationHours !== undefined)
    payload.booking_cancellation_hours = input.bookingCancellationHours;
  if (input.appointmentSlotMinutes !== undefined)
    payload.appointment_slot_minutes = input.appointmentSlotMinutes;
  if (input.systemEnabled !== undefined)
    payload.system_enabled = input.systemEnabled;
  if (input.systemMessage !== undefined)
    payload.system_message = input.systemMessage;
  if (input.enabledModules !== undefined)
    payload.enabled_modules = input.enabledModules;
  if (input.operatingHours !== undefined)
    payload.operating_hours = input.operatingHours;
  if (input.systemStatusType !== undefined)
    (payload as Record<string, unknown>).system_status_type =
      input.systemStatusType;

  const { data, error } = await client
    .from("clinic_settings")
    .update(payload as never)
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error) throw error;

  return mapClinicSettings(data);
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

  const { data, error } = await client
    .from("services")
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single();
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
  const { error } = await client
    .from("services")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
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
  const { data, error } = await client
    .from("specialties")
    .update({
      name: input.name,
      description: input.description,
    } as never)
    .eq("id", id)
    .select("*")
    .single();
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
  const { error } = await client
    .from("specialties")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
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
      .filter((user) => user.role === "doctor" || user.role === "specialist")
      .map((user) => ({
        id: user.id,
        profileId: user.id,
        fullName: user.fullName,
        title: user.title ?? null,
        role: user.role,
        specialtyId: user.specialtyId ?? null,
        specialtyName:
          database.specialties.find(
            (specialty) => specialty.id === user.specialtyId,
          )?.name ?? null,
        licenseNumber: null,
        birNumber: null,
        ptrNumber: null,
        consultationFee: 0,
        followUpFee: 0,
      }));
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("doctors")
    .select(
      "id, profile_id, specialty_id, license_number, bir_number, ptr_number, consultation_fee, follow_up_fee, profiles!inner(full_name, role, is_active, title), specialties(name)",
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
      license_number: string | null;
      bir_number: string | null;
      ptr_number: string | null;
      consultation_fee: number;
      follow_up_fee: number;
      profiles:
        | {
            full_name: string;
            role: string;
            is_active: boolean | null;
            title: string | null;
          }
        | {
            full_name: string;
            role: string;
            is_active: boolean | null;
            title: string | null;
          }[];
      specialties: { name: string } | { name: string }[] | null;
    }>
  )
    .filter((row) => {
      const profile = Array.isArray(row.profiles)
        ? row.profiles[0]
        : row.profiles;

      return (
        profile?.is_active !== false &&
        (profile?.role === "doctor" || profile?.role === "specialist")
      );
    })
    .map((row) => {
      const profile = Array.isArray(row.profiles)
        ? row.profiles[0]
        : row.profiles;

      return {
        id: row.id,
        profileId: row.profile_id,
        fullName: profile?.full_name ?? "Doctor",
        title: profile?.title ?? null,
        role: mapRole(profile?.role),
        specialtyId: row.specialty_id,
        specialtyName: Array.isArray(row.specialties)
          ? (row.specialties[0]?.name ?? null)
          : (row.specialties?.name ?? null),
        licenseNumber: row.license_number,
        birNumber: row.bir_number,
        ptrNumber: row.ptr_number,
        consultationFee: Number(row.consultation_fee ?? 0),
        followUpFee: Number(row.follow_up_fee ?? 0),
      };
    });
}

export async function getGeneralistDirectoryLiveOrDemo(): Promise<
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
        title: user.title ?? null,
        role: user.role,
        specialtyId: user.specialtyId ?? null,
        specialtyName:
          database.specialties.find(
            (specialty) => specialty.id === user.specialtyId,
          )?.name ?? null,
        licenseNumber: null,
        birNumber: null,
        ptrNumber: null,
        consultationFee: 0,
        followUpFee: 0,
      }));
  }

  const providers = await getDoctorDirectoryLiveOrDemo();
  return providers.filter((provider) => provider.role === "doctor");
}

export async function getCurrentDoctor(userId: string) {
  if (!isSupabaseConfigured) {
    const user = getDatabase().users.find(
      (item) => item.id === userId || item.authUserId === userId,
    );
    if (!user || (user.role !== "doctor" && user.role !== "specialist")) {
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
  if (
    metadataRole !== "doctor" &&
    metadataRole !== "specialist" &&
    fallbackProfile?.role !== "doctor" &&
    fallbackProfile?.role !== "specialist"
  ) {
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

export async function getSpecialistAvailabilityByDoctorIdLiveOrDemo(
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
    .from("specialist_schedules")
    .select("*")
    .eq("specialist_id", doctorId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return mapSpecialistScheduleRowsToAvailability(
    doctorId,
    (data ?? []) as SpecialistScheduleRow[],
  ).sort(
    (left, right) =>
      left.dayOfWeek - right.dayOfWeek ||
      left.startTime.localeCompare(right.startTime),
  );
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

  const normalizedAvailability = availability.map((slot) => ({
    ...slot,
    doctorId: doctor.id,
  }));

  if (!isSupabaseConfigured) {
    return replaceDoctorAvailability(doctor.id, normalizedAvailability);
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

  const payload = normalizedAvailability.map((slot) => ({
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

export async function saveSpecialistAvailabilityForProfileLiveOrDemo(
  profileId: string,
  availability: Array<
    Omit<DoctorAvailability, "id" | "createdAt" | "updatedAt">
  >,
) {
  const doctor = await getCurrentDoctor(profileId);
  if (!doctor) {
    throw new Error("Specialist record not found for this profile.");
  }

  const normalizedAvailability = availability.map((slot) => ({
    ...slot,
    doctorId: doctor.id,
  }));

  if (!isSupabaseConfigured) {
    return replaceDoctorAvailability(doctor.id, normalizedAvailability);
  }

  const groupedByDay = new Map<
    number,
    Array<Omit<DoctorAvailability, "id" | "createdAt" | "updatedAt">>
  >();

  for (const slot of normalizedAvailability) {
    const entries = groupedByDay.get(slot.dayOfWeek) ?? [];
    entries.push(slot);
    groupedByDay.set(slot.dayOfWeek, entries);
  }

  const client = requireSupabase();
  const { error: deleteError } = await client
    .from("specialist_schedules")
    .delete()
    .eq("specialist_id", doctor.id);

  if (deleteError) {
    throw deleteError;
  }

  if (normalizedAvailability.length === 0) {
    return [];
  }

  const payload = Array.from(groupedByDay.entries()).map(
    ([dayOfWeek, slots]) => ({
      specialist_id: doctor.id,
      recurrence: [mapJsDayToSpecialistRecurrenceDay(dayOfWeek)],
      slot_template: slots
        .sort((left, right) => left.startTime.localeCompare(right.startTime))
        .map((slot) => ({
          start: slot.startTime,
          end: slot.endTime,
        })),
      is_active: true,
      valid_from: new Date().toISOString().slice(0, 10),
      practice_location: {},
    }),
  );

  const { data, error } = await client
    .from("specialist_schedules")
    .insert(payload as never)
    .select("*");

  if (error) {
    throw error;
  }

  const savedSchedules = (data ?? []) as SpecialistScheduleRow[];
  if (normalizedAvailability.length > 0 && savedSchedules.length === 0) {
    throw new Error(
      "Specialist availability save did not return any stored schedule rows.",
    );
  }

  return mapSpecialistScheduleRowsToAvailability(
    doctor.id,
    savedSchedules,
  ).sort(
    (left, right) =>
      left.dayOfWeek - right.dayOfWeek ||
      left.startTime.localeCompare(right.startTime),
  );
}

export async function saveDoctorFeeSettingsForProfileLiveOrDemo(
  profileId: string,
  input: DoctorFeeSettings,
) {
  let doctor = await getCurrentDoctor(profileId);
  if (!doctor) {
    if (!isSupabaseConfigured) {
      throw new Error("Doctor record not found for this profile.");
    }

    const client = requireSupabase();
    const { error: bootstrapDoctorError } = await client
      .from("doctors")
      .upsert({ profile_id: profileId } as never, {
        onConflict: "profile_id",
      });
    if (bootstrapDoctorError) {
      throw bootstrapDoctorError;
    }

    doctor = await getCurrentDoctor(profileId);
    if (!doctor) {
      throw new Error("Doctor record not found for this profile.");
    }
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
  return mapProfile(profileRow, {
    accessRole: accessRoleMap.get(profileRow.id) ?? null,
  });
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
  if (!data) {
    return null;
  }

  const profile = await getCurrentProfile(userId);
  if (profile && profile.role !== "patient") {
    return null;
  }

  return mapPatient(data);
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

export async function getWalkInPatientByUniqueLoginIdLiveOrDemo(
  uniqueLoginId: string,
): Promise<WalkInUniqueLoginProfile | null> {
  const normalizedUniqueId = uniqueLoginId.trim().toUpperCase();
  if (!normalizedUniqueId) {
    return null;
  }

  if (!isSupabaseConfigured) {
    const patient = getWalkInPatientByUniqueLoginId(normalizedUniqueId);
    if (!patient) {
      return null;
    }

    return {
      patientId: patient.id,
      uniqueLoginId: patient.uniqueLoginId ?? normalizedUniqueId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      birthDate: patient.birthDate,
      mobileNumber: patient.mobileNumber,
      email: patient.email,
      address: patient.address,
      bloodType: patient.bloodType,
      allergies: patient.allergies,
      medicalHistory: patient.medicalHistory,
      emergencyContactName: patient.emergencyContactName,
      emergencyContactPhone: patient.emergencyContactPhone,
      accountLinked: Boolean(patient.userId),
    };
  }

  const client = requireSupabase();
  const { data, error } = await (client as any).rpc(
    "portal_get_walk_in_patient_by_unique_id",
    {
      input_unique_id: normalizedUniqueId,
    },
  );

  if (error) {
    throw error;
  }

  const row = (
    (data ?? []) as Array<{
      patient_id: string;
      unique_login_id: string;
      first_name: string;
      last_name: string;
      birth_date: string;
      mobile_number: string | null;
      email: string | null;
      address: string | null;
      blood_type: string | null;
      allergies: string | null;
      medical_history: string | null;
      emergency_contact_name: string | null;
      emergency_contact_phone: string | null;
      account_linked: boolean;
    }>
  )[0];

  if (!row) {
    return null;
  }

  return {
    patientId: row.patient_id,
    uniqueLoginId: row.unique_login_id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: row.birth_date,
    mobileNumber: row.mobile_number ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    bloodType: row.blood_type ?? "",
    allergies: row.allergies ?? "",
    medicalHistory: row.medical_history ?? "",
    emergencyContactName: row.emergency_contact_name ?? "",
    emergencyContactPhone: row.emergency_contact_phone ?? "",
    accountLinked: row.account_linked === true,
  };
}

export async function claimWalkInPatientAccountLiveOrDemo(input: {
  uniqueLoginId: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  allergies: string;
  medicalHistory: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}) {
  const normalizedUniqueId = input.uniqueLoginId.trim().toUpperCase();
  if (!normalizedUniqueId) {
    throw new Error("Unique ID is required.");
  }

  if (!isSupabaseConfigured) {
    const patient = claimWalkInPatientAccount({
      uniqueLoginId: normalizedUniqueId,
      email: input.email,
      phone: input.phone,
      address: input.address,
      allergies: input.allergies,
      medicalHistory: input.medicalHistory,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
    });

    if (!patient?.userId) {
      throw new Error("Unable to claim this walk-in patient account.");
    }

    return {
      userId: patient.userId,
      email: input.email.trim().toLowerCase(),
    };
  }

  const response = await invokeSupabaseFunction<{
    success?: boolean;
    user?: {
      id: string;
      email: string;
      fullName: string;
    };
  }>("claim-walk-in-patient", {
    uniqueLoginId: normalizedUniqueId,
    email: input.email,
    password: input.password,
    phone: input.phone,
    address: input.address,
    allergies: input.allergies,
    medicalHistory: input.medicalHistory,
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: input.emergencyContactPhone,
  });

  if (!response.user?.id || !response.user.email) {
    throw new Error("Unable to claim this walk-in patient account.");
  }

  return {
    userId: response.user.id,
    email: response.user.email,
  };
}

export async function ensurePatientForUser(user: User) {
  if (!isSupabaseConfigured) {
    return (
      getDatabase().patients.find((patient) => patient.userId === user.id) ??
      null
    );
  }

  const client = requireSupabase();
  const profile = await getCurrentProfile(user.id);
  const metadata = user.user_metadata as Record<string, string | undefined>;
  const resolvedRole = profile?.role ?? mapRole(metadata.role);

  if (resolvedRole !== "patient") {
    return null;
  }

  const existing = await getCurrentPatient(user.id);
  if (existing) {
    return existing;
  }

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
    const patientName = `${patient.firstName} ${patient.lastName}`;
    return database.bookings
      .filter((booking) => booking.patientId === patient.id)
      .map((booking) => ({
        id: booking.id,
        patientId: booking.patientId,
        patientName,
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

  const patientName = `${patient.firstName} ${patient.lastName}`;
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
        patientName,
      }),
    ),
  );
}

export async function listPatientTeleconsultAppointmentsForCurrentUserLiveOrDemo(input: {
  userId: string | null;
  email?: string | null;
}): Promise<PatientTeleconsultationSummary[]> {
  if (!input.userId && !input.email) {
    return [];
  }

  if (!isSupabaseConfigured) {
    const database = getDatabase();
    const normalizedEmail = input.email?.trim().toLowerCase() ?? null;
    const linkedPatient =
      database.patients.find(
        (patient) => Boolean(input.userId) && patient.userId === input.userId,
      ) ??
      database.patients.find(
        (patient) =>
          Boolean(normalizedEmail) &&
          patient.email?.trim().toLowerCase() === normalizedEmail,
      ) ??
      null;

    if (!linkedPatient) {
      return [];
    }

    const doctorMap = new Map(
      database.users.map((doctor) => [doctor.id, doctor.fullName]),
    );
    const serviceMap = new Map(
      database.services.map((service) => [service.id, service.name]),
    );

    return database.appointments
      .filter(
        (appointment) =>
          appointment.patientId === linkedPatient.id &&
          appointment.visitType === "teleconsultation" &&
          !appointment.deletedAt,
      )
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
      .map((appointment) => ({
        id: appointment.id,
        scheduledAt: appointment.scheduledAt,
        status: appointment.status,
        doctorName: doctorMap.get(appointment.doctorId) ?? "Doctor",
        serviceName: serviceMap.get(appointment.serviceId) ?? "Consultation",
        teleconsultationPlatform: getTeleconsultationPlatformLabel(
          appointment.teleconsultationPlatform,
        ),
        teleconsultationAccessInstructions:
          getTeleconsultationAccessInstructions(
            appointment.teleconsultationAccessInstructions,
          ),
        joinPath: `/portal/teleconsult/${appointment.id}`,
      }));
  }

  if (!input.userId) {
    return [];
  }

  const linkedPatient = await getCurrentPatient(input.userId);
  if (!linkedPatient) {
    return [];
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("appointments")
    .select("*")
    .eq("patient_id", linkedPatient.id)
    .eq("visit_type", "teleconsultation")
    .is("deleted_at", null)
    .order("scheduled_at", { ascending: true });

  if (error) {
    throw error;
  }

  const appointments = (data ?? []) as AppointmentRow[];
  if (appointments.length === 0) {
    return [];
  }

  const doctorIds = [
    ...new Set(
      appointments
        .map((appointment) => appointment.doctor_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const serviceIds = [
    ...new Set(
      appointments
        .map((appointment) => appointment.service_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const doctorQuery = doctorIds.length
    ? client.from("doctors").select("id, profile_id").in("id", doctorIds)
    : Promise.resolve({
        data: [] as Array<{ id: string; profile_id: string }>,
        error: null,
      });
  const serviceQuery = serviceIds.length
    ? client.from("services").select("id, name").in("id", serviceIds)
    : Promise.resolve({
        data: [] as Array<{ id: string; name: string }>,
        error: null,
      });

  const [
    { data: doctorsData, error: doctorsError },
    { data: servicesData, error: servicesError },
  ] = await Promise.all([doctorQuery, serviceQuery]);

  if (doctorsError) {
    throw doctorsError;
  }
  if (servicesError) {
    throw servicesError;
  }

  const typedDoctors = (doctorsData ?? []) as Array<{
    id: string;
    profile_id: string;
  }>;
  const profileIds = typedDoctors
    .map((doctor) => doctor.profile_id)
    .filter(Boolean);
  const { data: profilesData, error: profilesError } = profileIds.length
    ? await client.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [] as Array<{ id: string; full_name: string }>, error: null };

  if (profilesError) {
    throw profilesError;
  }

  const profileMap = new Map(
    ((profilesData ?? []) as Array<{ id: string; full_name: string }>).map(
      (profile) => [profile.id, profile.full_name],
    ),
  );
  const doctorMap = new Map(
    typedDoctors.map((doctor) => [
      doctor.id,
      profileMap.get(doctor.profile_id) ?? "Doctor",
    ]),
  );
  const serviceMap = new Map(
    ((servicesData ?? []) as Array<{ id: string; name: string }>).map(
      (service) => [service.id, service.name],
    ),
  );

  return appointments.map((appointment) => ({
    id: appointment.id,
    scheduledAt: appointment.scheduled_at,
    status: mapTeleconsultationStatus(appointment.status),
    doctorName: doctorMap.get(appointment.doctor_id ?? "") ?? "Doctor",
    serviceName: serviceMap.get(appointment.service_id ?? "") ?? "Consultation",
    teleconsultationPlatform: getTeleconsultationPlatformLabel(
      appointment.teleconsultation_platform,
    ),
    teleconsultationAccessInstructions: getTeleconsultationAccessInstructions(
      appointment.teleconsultation_access_instructions,
    ),
    joinPath: `/portal/teleconsult/${appointment.id}`,
  }));
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
  promoCodeId?: string | null;
  discountAmount?: number;
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
  const payload: any = {
    patient_id: input.patientId,
    service_id: input.serviceId,
    doctor_id: input.doctorId,
    preferred_date: input.preferredDate,
    preferred_time: input.preferredTime,
    intake_notes: input.intakeNotes,
    status: "pending",
    fee_type: input.feeType ?? undefined,
    fee_amount: input.feeAmount,
    receipt_code: input.receiptCode ?? generateBookingReceiptCode(),
    payment_status: input.paymentStatus ?? "pending_cashier",
    promo_code_id: input.promoCodeId ?? null,
    discount_amount: input.discountAmount ?? 0,
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
        if (appointment.status === "cancelled") return false;

        // ✅ Convert to PH time (UTC+8) before comparing date
        const phDate = new Date(
          new Date(appointment.scheduledAt).getTime() + 8 * 60 * 60 * 1000,
        );
        const phDateStr = phDate.toISOString().slice(0, 10); // "YYYY-MM-DD" in PH time

        if (phDateStr !== input.date) return false;

        if (input.doctorId) {
          return appointment.doctorId === input.doctorId;
        }

        return (
          appointment.serviceId === input.serviceId && !appointment.doctorId
        );
      })
      .map((appointment) => {
        // ✅ Extract PH local time, not raw UTC
        const phDate = new Date(
          new Date(appointment.scheduledAt).getTime() + 8 * 60 * 60 * 1000,
        );
        return `${String(phDate.getUTCHours()).padStart(2, "0")}:${String(phDate.getUTCMinutes()).padStart(2, "0")}`;
      });

    const referralTimes = input.doctorId
      ? database.referrals
          .filter((referral) => {
            if (
              referral.appointmentDate !== input.date ||
              !referral.appointmentTime ||
              referral.status === "cancelled" ||
              referral.status === "declined"
            ) {
              return false;
            }

            return referral.targetDoctorId === input.doctorId;
          })
          .map((referral) => referral.appointmentTime?.slice(0, 5) ?? "")
      : [];

    return [
      ...new Set([...bookingTimes, ...appointmentTimes, ...referralTimes]),
    ].sort();
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

  // Query appointments table for blocked times (using PH timezone UTC+8)
  // Query appointments table for blocked times (using PH timezone UTC+8)
  let appointmentTimes: string[] = [];
  {
    const startUTC = new Date(`${input.date}T00:00:00+08:00`).toISOString();
    const endUTC = new Date(`${input.date}T23:59:59+08:00`).toISOString();

    const apptBase = (client as any)
      .from("appointments")
      .select("scheduled_at, estimated_end") // ← add estimated_end
      .gte("scheduled_at", startUTC)
      .lt("scheduled_at", endUTC)
      .neq("status", "cancelled");

    const apptQuery = input.doctorId
      ? apptBase.eq("doctor_id", input.doctorId)
      : input.serviceId
        ? apptBase.eq("service_id", input.serviceId).is("doctor_id", null)
        : apptBase;

    const { data: apptData, error: apptError } = await apptQuery;
    if (apptError) throw apptError;

    appointmentTimes = (
      (apptData ?? []) as Array<{
        scheduled_at: string;
        estimated_end: string | null;
      }>
    )
      .flatMap((appt) => {
        const utcDate = new Date(appt.scheduled_at);
        if (isNaN(utcDate.getTime())) return [];

        const phStart = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
        const startMinutes =
          phStart.getUTCHours() * 60 + phStart.getUTCMinutes();

        // If no estimated_end, just block the scheduled_at slot
        if (!appt.estimated_end) {
          const hh = String(phStart.getUTCHours()).padStart(2, "0");
          const mm = String(phStart.getUTCMinutes()).padStart(2, "0");
          return [`${hh}:${mm}`];
        }

        // estimated_end is a plain TIME string e.g. "16:30:00"
        const [endHh, endMm] = appt.estimated_end.split(":").map(Number);
        const endMinutes = endHh * 60 + endMm;

        // Generate every 30-min slot from scheduled_at up to (not including) estimated_end
        const slots: string[] = [];
        for (let m = startMinutes; m <= endMinutes; m += 30) {
          const hh = String(Math.floor(m / 60)).padStart(2, "0");
          const mm = String(m % 60).padStart(2, "0");
          slots.push(`${hh}:${mm}`);
        }
        return slots;
      })
      .filter(Boolean);
  }

  let referralTimes: string[] = [];
  if (input.doctorId) {
    const { data: referralData, error: referralError } = await client
      .from("referrals")
      .select("appointment_time, status")
      .eq("appointment_date", input.date)
      .or(
        `assigned_specialist_id.eq.${input.doctorId},target_doctor_id.eq.${input.doctorId}`,
      );

    if (referralError) {
      throw referralError;
    }

    referralTimes = (
      (referralData ?? []) as Array<{
        appointment_time: string | null;
        status: string;
      }>
    )
      .filter(
        (referral) =>
          !!referral.appointment_time &&
          referral.status !== "cancelled" &&
          referral.status !== "declined",
      )
      .map((referral) => referral.appointment_time?.slice(0, 5) ?? "");
  }

  return [
    ...new Set([
      ...(
        (data ?? []) as Array<{
          blocked_time?: string;
          preferred_time?: string;
        }>
      ).map((row) =>
        (row.blocked_time ?? row.preferred_time ?? "").slice(0, 5),
      ),
      ...appointmentTimes,
      ...referralTimes,
    ]),
  ].filter(Boolean);
}

export async function getBookingByReceiptCodeLiveOrDemo(receiptCode: string) {
  if (!isSupabaseConfigured) {
    const { getBookingByReceiptCode } = await import("./local-db");
    const booking = getBookingByReceiptCode(receiptCode);
    if (!booking) {
      return null;
    }

    const database = getDatabase();
    const patient = database.patients.find((p) => p.id === booking.patientId);
    const patientName = patient
      ? `${patient.firstName} ${patient.lastName}`
      : null;
    return {
      id: booking.id,
      patientId: booking.patientId,
      patientName,
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

  const bookingRow = data as BookingRow;
  const [services, doctors, patient] = await Promise.all([
    getBookableServicesLiveOrDemo(),
    getDoctorDirectoryLiveOrDemo(),
    getPatientByIdLiveOrDemo(bookingRow.patient_id),
  ]);
  const serviceMap = new Map(
    services.map((service) => [service.id, service.name]),
  );
  const doctorMap = new Map(
    doctors.map((doctor) => [doctor.id, doctor.fullName]),
  );
  const patientName = patient
    ? `${patient.firstName} ${patient.lastName}`
    : null;

  return buildBookingListItemFromRow(bookingRow, {
    serviceMap,
    doctorMap,
    patientName,
  });
}

export async function searchPendingBookingsByPatientNameLiveOrDemo(
  nameQuery: string,
): Promise<BookingListItem[]> {
  const trimmed = nameQuery.trim();
  if (!trimmed) {
    return [];
  }

  if (!isSupabaseConfigured) {
    const database = getDatabase();
    const lowerQuery = trimmed.toLowerCase();
    const matchingPatients = database.patients.filter((patient) => {
      const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
      return fullName.includes(lowerQuery);
    });
    const matchingPatientIds = new Set(matchingPatients.map((p) => p.id));
    const patientNameById = new Map(
      matchingPatients.map((p) => [p.id, `${p.firstName} ${p.lastName}`]),
    );

    return database.bookings
      .filter(
        (booking) =>
          matchingPatientIds.has(booking.patientId) &&
          booking.paymentStatus === "pending_cashier",
      )
      .sort((a, b) => {
        const aDateTime = `${a.preferredDate}T${a.preferredTime}`;
        const bDateTime = `${b.preferredDate}T${b.preferredTime}`;
        return bDateTime.localeCompare(aDateTime);
      })
      .map((booking) => ({
        id: booking.id,
        patientId: booking.patientId,
        patientName: patientNameById.get(booking.patientId) ?? null,
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
  const words = trimmed.split(/\s+/);
  const firstWord = words[0];
  const lastWord = words.length > 1 ? words[words.length - 1] : null;

  let patientsQuery = client
    .from("patients")
    .select("id, first_name, last_name")
    .is("deleted_at", null);

  if (lastWord) {
    patientsQuery = patientsQuery
      .ilike("first_name", `%${firstWord}%`)
      .ilike("last_name", `%${lastWord}%`);
  } else {
    patientsQuery = patientsQuery.or(
      `first_name.ilike.%${firstWord}%,last_name.ilike.%${firstWord}%`,
    );
  }

  const { data: patientRows, error: patientError } =
    await patientsQuery.limit(20);
  if (patientError) {
    throw patientError;
  }

  if (!patientRows || patientRows.length === 0) {
    return [];
  }

  const patientIds = (
    patientRows as Array<{ id: string; first_name: string; last_name: string }>
  ).map((p) => p.id);
  const patientNameById = new Map(
    (
      patientRows as Array<{
        id: string;
        first_name: string;
        last_name: string;
      }>
    ).map((p) => [p.id, `${p.first_name} ${p.last_name}`]),
  );

  const { data: bookingRows, error: bookingError } = await client
    .from("bookings")
    .select("*")
    .in("patient_id", patientIds)
    .eq("payment_status", "pending_cashier")
    .is("deleted_at", null)
    .order("preferred_date", { ascending: false })
    .order("preferred_time", { ascending: false });

  if (bookingError) {
    throw bookingError;
  }

  if (!bookingRows || bookingRows.length === 0) {
    return [];
  }

  const [services, doctors] = await Promise.all([
    getBookableServicesLiveOrDemo(),
    getDoctorDirectoryLiveOrDemo(),
  ]);
  const serviceMap = new Map(services.map((s) => [s.id, s.name]));
  const doctorMap = new Map(doctors.map((d) => [d.id, d.fullName]));

  return Promise.all(
    (bookingRows as BookingRow[]).map((row) =>
      buildBookingListItemFromRow(row, {
        serviceMap,
        doctorMap,
        patientName: patientNameById.get(row.patient_id) ?? null,
      }),
    ),
  );
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
        const appointmentPayload: Database["public"]["Tables"]["appointments"]["Insert"] =
          {
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

        const { data: createdAppointmentRow, error: appointmentError } =
          await client
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
        await client
          .from("appointments")
          .delete()
          .eq("id", createdAppointmentId);
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
        invoice_id: createdInvoiceId ?? invoice?.id ?? "",
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
        await client
          .from("invoice_items")
          .delete()
          .eq("invoice_id", createdInvoiceId);
        await client.from("invoices").delete().eq("id", createdInvoiceId);
        await updateBookingPaymentStatusWithOptionalAppointmentLink(client, {
          bookingId: booking.id,
          paymentStatus: booking.payment_status,
          appointmentId: null,
        });
        await client
          .from("appointments")
          .delete()
          .eq("id", createdAppointmentId ?? "");
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

  const typedAssignments = (assignments ?? []) as Array<
    Pick<
      Database["public"]["Tables"]["profile_access_roles"]["Row"],
      "profile_id" | "access_role_id"
    >
  >;
  const roleIds = Array.from(
    new Set(typedAssignments.map((assignment) => assignment.access_role_id)),
  );

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
  const rolesById = new Map(
    typedRoles.map((role) => [role.id, mapAccessRole(role)]),
  );
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
  input: Omit<
    AccessRoleTemplate,
    "id" | "createdAt" | "updatedAt" | "isSystem"
  >,
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
  input: Omit<
    AccessRoleTemplate,
    "id" | "createdAt" | "updatedAt" | "isSystem"
  >,
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

  const typedExistingRole = (existingRole ?? null) as Pick<
    AccessRoleRow,
    "id" | "is_system"
  > | null;
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

  const typedExistingRole = (existingRole ?? null) as Pick<
    AccessRoleRow,
    "id" | "is_system"
  > | null;
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
  const { error } = await client.from("profile_access_roles").upsert(
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
      title:
        input.role === "doctor" || input.role === "specialist"
          ? input.title?.trim() || null
          : null,
      specialtyId: null,
      consultationFee:
        input.role === "doctor" || input.role === "specialist"
          ? (input.consultationFee ?? 0)
          : null,
      followUpFee:
        input.role === "doctor" || input.role === "specialist"
          ? (input.followUpFee ?? 0)
          : null,
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

  if (input.role === "doctor" || input.role === "specialist") {
    payload.title = input.title?.trim() ?? "";
    payload.prcLicenseNumber = input.prcLicenseNumber?.trim() ?? "";
    payload.prcLicenseExpiry = input.prcLicenseExpiry?.trim() ?? "";
    payload.birNumber = input.birNumber?.trim() ?? "";
    payload.ptrNumber = input.ptrNumber?.trim() ?? "";
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

  let data: AdminCreateUserResponse;
  try {
    data = await invokeSupabaseFunction<AdminCreateUserResponse>(
      "admin-create-user",
      payload,
    );
  } catch (error) {
    if (
      input.role === "specialist" &&
      error instanceof Error &&
      error.message === "Unsupported role."
    ) {
      throw new Error(
        "The live admin-create-user Edge Function is outdated and does not support the specialist role yet. Redeploy the function, then try creating the specialist account again.",
      );
    }

    throw error;
  }

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
  title?: string | null;
  prcLicenseNumber?: string;
  prcLicenseExpiry?: string;
  birNumber?: string;
  ptrNumber?: string;
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
      title:
        input.role === "doctor" || input.role === "specialist"
          ? input.title?.trim() || null
          : null,
      specialtyId: null,
      consultationFee:
        input.role === "doctor" || input.role === "specialist"
          ? (input.consultationFee ?? 0)
          : null,
      followUpFee:
        input.role === "doctor" || input.role === "specialist"
          ? (input.followUpFee ?? 0)
          : null,
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
      title:
        input.role === "doctor" || input.role === "specialist"
          ? input.title?.trim() || null
          : null,
    } as never)
    .eq("id", userId);

  if (profileError) {
    throw profileError;
  }

  if (input.role === "doctor" || input.role === "specialist") {
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
    const currentUser = getDatabase().users.find(
      (profile) => profile.id === userId || profile.authUserId === userId,
    );
    if (!currentUser) {
      throw new Error("Updated user could not be loaded.");
    }

    const updatedUser = updateUserProfileRecord(userId, {
      ...currentUser,
      phone: input.phone?.trim() || "",
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
      phone: input.phone?.trim() || "",
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
    systemStatusType: ClinicSettings["systemStatusType"];
    enabledModules: ClinicSettings["enabledModules"];
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
      systemStatusType: input.systemStatusType,
      enabledModules: input.enabledModules,
    });
  }

  const data = await invokeOdcFunction<OdcUpdateResponse>({
    mode: "update",
    ...normalized,
    systemEnabled: input.systemEnabled,
    systemMessage: input.systemMessage,
    systemStatusType: input.systemStatusType,
    enabledModules: input.enabledModules,
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

  return (
    (data ?? []) as Array<{
      id: string;
      name: string;
      contact_person: string;
      phone: string;
      email: string;
      created_at: string;
      updated_at: string;
    }>
  ).map((row) => ({
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
  values: {
    name: string;
    contact_person: string;
    phone: string;
    email: string;
  },
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

export async function getCategories(): Promise<
  Array<{ id: string; name: string }>
> {
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

export async function createInventoryCategory(values: { name: string }) {
  if (!isSupabaseConfigured) {
    const { createInventoryCategory: createInventoryCategoryLocal } =
      await import("./local-db");
    return createInventoryCategoryLocal(values);
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("inventory_categories")
    .insert({ name: values.name } as never)
    .select("id,name,created_at,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data as InventoryCategory;
}

export async function updateInventoryCategory(
  id: string,
  values: { name: string },
) {
  if (!isSupabaseConfigured) {
    const { updateInventoryCategoryRecord } = await import("./local-db");
    return updateInventoryCategoryRecord(id, values);
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("inventory_categories")
    .update({ name: values.name } as never)
    .eq("id", id)
    .select("id,name,created_at,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data as InventoryCategory;
}

export async function deleteInventoryCategory(id: string) {
  if (!isSupabaseConfigured) {
    const { deleteInventoryCategoryRecord } = await import("./local-db");
    deleteInventoryCategoryRecord(id);
    return;
  }

  const client = requireSupabase();
  const { error } = await client
    .from("inventory_categories")
    .delete()
    .eq("id", id);
  if (error) {
    throw error;
  }
}

export async function listInventoryItemsLiveOrDemo(): Promise<InventoryItem[]> {
  if (!isSupabaseConfigured) {
    const { listInventoryItems } = await import("./local-db");
    return listInventoryItems();
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("inventory_items")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
      id: string;
      category_id: string;
      supplier_id: string | null;
      brand_name: string | null;
      qr_code: string;
      name: string;
      sku: string;
      unit: string;
      stock_on_hand: number;
      reorder_level: number;
      cost_price: number | null;
      selling_price: number | null;
      created_at: string;
      updated_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    category_id: row.category_id,
    supplier_id: row.supplier_id,
    brandName: row.brand_name,
    qrCode: row.qr_code,
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    stockOnHand: Number(row.stock_on_hand ?? 0),
    reorderLevel: Number(row.reorder_level ?? 0),
    costPrice: Number(row.cost_price ?? 0),
    sellingPrice: Number(row.selling_price ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createInventoryItem(values: {
  categoryId: string;
  supplierId: string;
  brandName?: string;
  name: string;
  sku: string;
  unit: string;
  stockOnHand: number;
  reorderLevel: number;
  costPrice: number;
  sellingPrice: number;
}) {
  if (!isSupabaseConfigured) {
    const { createInventoryItem: createInventoryItemLocal } =
      await import("./local-db");
    return createInventoryItemLocal({
      category_id: values.categoryId,
      supplier_id: values.supplierId || null,
      brandName: values.brandName,
      name: values.name,
      sku: values.sku,
      unit: values.unit,
      stockOnHand: values.stockOnHand,
      reorderLevel: values.reorderLevel,
      costPrice: values.costPrice,
      sellingPrice: values.sellingPrice,
    });
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("inventory_items")
    .insert({
      category_id: values.categoryId,
      supplier_id: values.supplierId || null,
      brand_name: values.brandName?.trim() || null,
      name: values.name,
      sku: values.sku,
      unit: values.unit,
      stock_on_hand: values.stockOnHand,
      reorder_level: values.reorderLevel,
      cost_price: values.costPrice,
      selling_price: values.sellingPrice,
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
    brandName?: string;
    name: string;
    sku: string;
    unit: string;
    stockOnHand: number;
    reorderLevel: number;
    costPrice: number;
    sellingPrice: number;
  },
) {
  if (!isSupabaseConfigured) {
    const { updateInventoryItemRecord } = await import("./local-db");
    return updateInventoryItemRecord(itemId, {
      category_id: values.categoryId,
      supplier_id: values.supplierId || null,
      brandName: values.brandName,
      name: values.name,
      sku: values.sku,
      unit: values.unit,
      stockOnHand: values.stockOnHand,
      reorderLevel: values.reorderLevel,
      costPrice: values.costPrice,
      sellingPrice: values.sellingPrice,
    });
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("inventory_items")
    .update({
      category_id: values.categoryId,
      supplier_id: values.supplierId || null,
      brand_name: values.brandName?.trim() || null,
      name: values.name,
      sku: values.sku,
      unit: values.unit,
      stock_on_hand: values.stockOnHand,
      reorder_level: values.reorderLevel,
      cost_price: values.costPrice,
      selling_price: values.sellingPrice,
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

export async function getInventoryItems(
  page: number,
): Promise<InventoryItem[]> {
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

  return (
    (data ?? []) as Array<{
      id: string;
      category_id: string;
      supplier_id: string | null;
      brand_name: string | null;
      qr_code: string;
      name: string;
      sku: string;
      unit: string;
      stock_on_hand: number;
      reorder_level: number;
      cost_price: number | null;
      selling_price: number | null;
      created_at: string;
      updated_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    category_id: row.category_id,
    supplier_id: row.supplier_id,
    brandName: row.brand_name,
    qrCode: row.qr_code,
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    stockOnHand: Number(row.stock_on_hand ?? 0),
    reorderLevel: Number(row.reorder_level ?? 0),
    costPrice: Number(row.cost_price ?? 0),
    sellingPrice: Number(row.selling_price ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getInventoryItemsCount(): Promise<number> {
  if (!isSupabaseConfigured) {
    const { listInventoryItems } = await import("./local-db");
    const items = listInventoryItems();
    return items.length;
  }

  const client = requireSupabase();
  const { count, error } = await client
    .from("inventory_items")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getInventoryLogs(
  page: number,
): Promise<InventoryUsageLog[]> {
  const limit = 10;
  const from = Math.max(0, (page - 1) * limit);
  const to = from + limit - 1;
  const client = requireSupabase();

  const { data, error } = await client
    .from("inventory_usage_logs")
    .select(
      `
      id,
      created_at,
      updated_at,
      quantity,
      notes,
      scanned_code,
      profiles(full_name),
      patients:patients(first_name,last_name),
      inventory_items(name),
      appointments(reason)
    `,
    )
    .range(from, to);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    patientId: `${row.patients?.first_name} ${row.patients?.last_name}`,
    appointmentId: row.appointments?.reason,
    itemId: row.inventory_items?.name,
    quantity: row.quantity,
    notes: row.notes,
    scannedCode: row.scanned_code,
    recordedBy: row.profiles?.full_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getInventoryLogsCount(): Promise<number> {
  const client = requireSupabase();
  const { count, error } = await client
    .from("inventory_usage_logs")
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

export async function createInventoryLogs(values: {
  patientId: string | null;
  appointmentId: string | null;
  itemId: string;
  quantity: number;
  notes: string | null;
  scannedCode: string;
  recordedBy: string;
}) {
  const client = requireSupabase();

  const { data, error } = await client
    .from("inventory_usage_logs")
    .insert({
      patient_id: values.patientId,
      appointment_id: values.appointmentId,
      item_id: values.itemId,
      quantity: values.quantity,
      notes: values.notes,
      scanned_code: values.scannedCode,
      recorded_by: values.recordedBy,
    } as never)
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return data;
}

export async function listPosSalesLiveOrDemo(): Promise<PosSale[]> {
  if (!isSupabaseConfigured) {
    const { listPosSales } = await import("./local-db");
    return listPosSales();
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("pos_sales")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
      id: string;
      sale_number: string;
      patient_id: string | null;
      cashier_id: string;
      payment_method: string | null;
      payment_reference: string | null;
      payment_notes: string | null;
      subtotal: number;
      total: number;
      created_at: string;
      updated_at: string;
    }>
  ).map(mapPosSaleRow);
}

export async function listPosSaleItemsLiveOrDemo(): Promise<PosSaleItem[]> {
  if (!isSupabaseConfigured) {
    const { listPosSaleItems } = await import("./local-db");
    return listPosSaleItems();
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("pos_sale_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
      id: string;
      sale_id: string;
      inventory_item_id: string;
      item_name: string;
      item_sku: string;
      item_unit: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      created_at: string;
      updated_at: string;
    }>
  ).map(mapPosSaleItemRow);
}

export async function checkoutPosSaleLiveOrDemo(input: {
  patientId?: string | null;
  cashierId: string;
  paymentMethod: PosPaymentMethod;
  paymentReference?: string | null;
  paymentNotes?: string | null;
  items: Array<{
    inventoryItemId: string;
    quantity: number;
    unitPrice?: number;
  }>;
}): Promise<{ sale: PosSale | null; items: PosSaleItem[] }> {
  if (!isSupabaseConfigured) {
    const { checkoutPosSale } = await import("./local-db");
    return checkoutPosSale(input);
  }

  const client = requireSupabase();
  const { data, error } = await (client as any).rpc("checkout_pos_sale", {
    p_patient_id: input.patientId ?? null,
    p_cashier_id: input.cashierId,
    p_payment_method: input.paymentMethod,
    p_payment_reference: input.paymentReference ?? null,
    p_payment_notes: input.paymentNotes ?? null,
    p_items: input.items.map((item) => ({
      inventory_item_id: item.inventoryItemId,
      quantity: item.quantity,
      unit_price: item.unitPrice ?? null,
    })),
  });

  if (error) {
    throw error;
  }

  const payload = data as {
    sale?: {
      id: string;
      sale_number: string;
      patient_id: string | null;
      cashier_id: string;
      payment_method: string | null;
      payment_reference: string | null;
      payment_notes: string | null;
      subtotal: number;
      total: number;
      created_at: string;
      updated_at: string;
    } | null;
    items?: Array<{
      id: string;
      sale_id: string;
      inventory_item_id: string;
      item_name: string;
      item_sku: string;
      item_unit: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      created_at: string;
      updated_at: string;
    }>;
  } | null;

  return {
    sale: payload?.sale ? mapPosSaleRow(payload.sale) : null,
    items: (payload?.items ?? []).map(mapPosSaleItemRow),
  };
}

export async function getPromoCodes(): Promise<PromoCode[]> {
  if (!isSupabaseConfigured) {
    return [];
  }
  const client = requireSupabase();
  const { data, error } = await client
    .from("promo_codes")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    code: row.code,
    description: row.description,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value ?? 0),
    applicableServiceId: row.applicable_service_id,
    active: row.active,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createPromoCode(values: {
  code: string;
  description: string;
  maxUses: number;
  discountType: "percentage" | "fixed" | "free";
  discountValue: number;
  applicableServiceId?: string | null;
  active: boolean;
  expiresAt?: string | null;
}): Promise<PromoCode> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("promo_codes")
    .insert({
      code: values.code.trim().toUpperCase(),
      description: values.description.trim(),
      max_uses: values.maxUses,
      discount_type: values.discountType,
      discount_value: values.discountValue,
      applicable_service_id: values.applicableServiceId ?? null,
      active: values.active,
      expires_at: values.expiresAt ?? null,
    } as any)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const row = data as any;
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value ?? 0),
    applicableServiceId: row.applicable_service_id,
    active: row.active,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updatePromoCode(
  id: string,
  values: {
    code: string;
    description: string;
    maxUses: number;
    discountType: "percentage" | "fixed" | "free";
    discountValue: number;
    applicableServiceId?: string | null;
    active: boolean;
    expiresAt?: string | null;
  }
): Promise<PromoCode> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("promo_codes")
    .update({
      code: values.code.trim().toUpperCase(),
      description: values.description.trim(),
      max_uses: values.maxUses,
      discount_type: values.discountType,
      discount_value: values.discountValue,
      applicable_service_id: values.applicableServiceId ?? null,
      active: values.active,
      expires_at: values.expiresAt ?? null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const row = data as any;
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value ?? 0),
    applicableServiceId: row.applicable_service_id,
    active: row.active,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deletePromoCode(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from("promo_codes")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function validatePromoCode(
  code: string,
  serviceId: string
): Promise<PromoCode> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("promo_codes")
    .select("*")
    .ilike("code", code.trim())
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    throw new Error("Promo code not found.");
  }

  const row = data as any;
  if (!row.active) {
    throw new Error("This promo code is inactive.");
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    throw new Error("This promo code has expired.");
  }

  if (row.used_count >= row.max_uses) {
    throw new Error("This promo code has reached its usage limit.");
  }

  if (row.applicable_service_id && row.applicable_service_id !== serviceId) {
    throw new Error("This promo code is not applicable to the selected service.");
  }

  return {
    id: row.id,
    code: row.code,
    description: row.description,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value ?? 0),
    applicableServiceId: row.applicable_service_id,
    active: row.active,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
