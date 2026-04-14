export type Role =
  | "owner_admin"
  | "doctor"
  | "nurse_staff"
  | "front_desk_cashier"
  | "lab_staff"
  | "inventory_staff"
  | "patient";

export type Permission =
  | "dashboard.view"
  | "patients.view"
  | "patients.manage"
  | "appointments.view"
  | "appointments.manage"
  | "consultations.manage"
  | "billing.view"
  | "billing.manage"
  | "inventory.view"
  | "inventory.manage"
  | "laboratory.view"
  | "laboratory.manage"
  | "settings.view"
  | "settings.manage"
  | "booking.view"
  | "booking.manage"
  | "users.manage";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "rescheduled"
  | "cancelled";
export type BookingFeeType = "consultation" | "follow_up" | "service_fee";
export type BookingPaymentStatus = "pending_cashier" | "paid";
export type ServiceType = "medical_service" | "consultation" | "follow_up";
export type ReferralStatus =
  | "draft"
  | "sent"
  | "pending"
  | "accepted"
  | "confirmed"
  | "completed"
  | "declined"
  | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "void";
export type LabOrderStatus =
  | "requested"
  | "collected"
  | "processing"
  | "ready"
  | "released";
export type StockTransactionType = "stock_in" | "stock_out" | "adjustment";
export type VisitType = "in_person" | "teleconsultation";
export type ServiceDeliveryMode = "in_person" | "teleconsultation" | "hybrid";
export type PatientIntakeSource = "online_registration" | "staff_walk_in";
export type PatientVisitStatus = "registered_no_visit" | "visited_clinic";

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ClinicSettings extends BaseRecord {
  clinicName: string;
  legalName: string;
  shortCode: string;
  address: string;
  contactNumber: string;
  email: string;
  website: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  bookingLeadDays: number;
  bookingCancellationHours: number;
  appointmentSlotMinutes: number;
  systemEnabled: boolean;
  systemMessage: string;
  operatingHours: Array<{
    day: string;
    open: string;
    close: string;
    enabled: boolean;
  }>;
}

export interface UserProfile extends BaseRecord {
  authUserId: string;
  email: string;
  fullName: string;
  role: Role;
  permissions?: Permission[];
  accessRoleId?: string | null;
  accessRoleName?: string | null;
  phone: string;
  specialtyId?: string | null;
  title?: string | null;
  consultationFee?: number | null;
  followUpFee?: number | null;
}

export interface AccessRoleTemplate extends BaseRecord {
  name: string;
  description: string;
  baseRole: Exclude<Role, 'patient'>;
  permissions: Permission[];
  isSystem?: boolean;
}

export interface AdminCreateUserInput {
  firstName: string;
  lastName: string;
  contactNumber: string;
  email: string;
  password: string;
  role: Exclude<Role, "patient">;
  permissions?: Permission[];
  prcLicenseNumber?: string;
  prcLicenseExpiry?: string;
  birNumber?: string;
  prcIdFile?: File | null;
  consultationFee?: number;
  followUpFee?: number;
}

export interface DoctorFeeSettings {
  consultationFee: number;
  followUpFee: number;
}

export interface Specialty extends BaseRecord {
  name: string;
  description: string;
}

export interface Service extends BaseRecord {
  serviceType: ServiceType;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  specialtyId?: string | null;
  isBookable: boolean;
  deliveryMode: ServiceDeliveryMode;
}

export interface Patient extends BaseRecord {
  userId?: string | null;
  qrCode: string;
  intakeSource: PatientIntakeSource;
  visitStatus: PatientVisitStatus;
  lastClinicVisitAt?: string | null;
  firstName: string;
  lastName: string;
  sex: "male" | "female" | "other";
  birthDate: string;
  mobileNumber: string;
  email: string;
  address: string;
  bloodType: string;
  allergies: string;
  medicalHistory: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface Appointment extends BaseRecord {
  patientId: string;
  doctorId: string;
  specialtyId: string;
  serviceId: string;
  bookingId?: string | null;
  scheduledAt: string;
  status: AppointmentStatus;
  source: "internal" | "portal";
  visitType: VisitType;
  reason: string;
  notes: string;
  teleconsultationPlatform?: string | null;
  teleconsultationUrl?: string | null;
  teleconsultationAccessInstructions?: string | null;
  consultationId?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;
}

export interface DoctorAvailability extends BaseRecord {
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

export interface Consultation extends BaseRecord {
  appointmentId: string | null;
  patientId: string;
  doctorId: string;
  consultationType: string;
  consultationDate: string;
  consultationTime: string;
  providerName: string;
  clinicalSummary: string;
  diagnosis?: string;
  presentIllnessHistory: string;
  reviewOfSymptoms?: string;
  allergies?: string;
  vitals?: string;
  treatmentPlan?: string;
  medications?: string;
  labResults?: string;
  differentialDiagnosis?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  outcome?: string;
}

export interface Prescription extends BaseRecord {
  consultationId: string;
  patientId: string;
  prescriptionName: string;
  dosage: string;
  instruction: string;
}

export interface Booking extends BaseRecord {
  patientId: string;
  serviceId: string;
  doctorId: string;
  appointmentId?: string | null;
  preferredDate: string;
  preferredTime: string;
  status: BookingStatus;
  intakeNotes: string;
  feeType: BookingFeeType;
  feeAmount: number;
  receiptCode: string;
  paymentStatus: BookingPaymentStatus;
  relatedReferral_id?: string | null;
}

export interface Referral extends BaseRecord {
  patientId: string;
  appointmentId?: string | null;
  referringDoctorId: string;
  targetDoctorId?: string | null;
  targetSpecialtyId?: string | null;
  reason: string;
  clinicalSummary: string;
  referralNotes: string;
  status: ReferralStatus;
  specialistFindings: string;
  specialistRecommendations: string;
  referredAt: string;
  specialistVisitedAt?: string | null;
  completedAt?: string | null;
}

export interface InvoiceItem extends BaseRecord {
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  category: "consultation" | "laboratory" | "medicine" | "other";
}

export interface Invoice extends BaseRecord {
  patientId: string;
  appointmentId?: string | null;
  invoiceNumber: string;
  paymentStatus: PaymentStatus;
  subtotal: number;
  total: number;
}

export interface Payment extends BaseRecord {
  invoiceId: string;
  amount: number;
  method: "cash" | "card" | "transfer" | "ewallet";
  referenceNumber: string;
  receivedBy: string;
}

export interface Supplier extends BaseRecord {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
}

export interface InventoryCategory extends BaseRecord {
  name: string;
}

export interface InventoryItem extends BaseRecord {
  category_id: string;
  supplier_id?: string | null;
  qrCode: string;
  name: string;
  sku: string;
  unit: string;
  stockOnHand: number;
  reorderLevel: number;
}

export interface StockTransaction extends BaseRecord {
  itemId: string;
  type: StockTransactionType;
  quantity: number;
  remarks: string;
}

export interface InventoryUsageLog extends BaseRecord {
  patientId: string;
  itemId: string;
  appointmentId?: string | null;
  quantity: number;
  notes: string;
  scannedCode: string;
  recordedBy: string;
}

export type LabServiceCategory = "laboratoryTests" | "imagingTests";

export interface LabService extends BaseRecord {
  name: string;
  description: string;
  price: number;
  category: LabServiceCategory;
}

export interface LabOrder extends BaseRecord {
  patientId: string;
  appointmentId?: string | null;
  labServiceId: string;
  requestedBy: string;
  status: LabOrderStatus;
  notes: string;
  schedDate?: string | null;
  schedTime?: string | null;
  urgentFlag?: boolean;
}

export type LabBookingStatus =
  | "Pending"
  | "Confirmed"
  | "Completed"
  | "Cancelled";

export interface LabBookingRequest extends BaseRecord {
  patientName: string;
  email: string;
  labTestName: string;
  slotNumber?: string | null;
  status: LabBookingStatus;
  confirmedAt?: string | null;
}

export interface LabResult extends BaseRecord {
  labOrderId: string;
  resultSummary: string;
  releasedAt?: string | null;
  attachmentName?: string | null;
}

export interface FileUpload extends BaseRecord {
  patientId: string;
  fileName: string;
  category: string;
  url: string;
}

export interface AuditLog extends BaseRecord {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}

export interface PatientActionLog extends BaseRecord {
  patientId: string;
  patientName: string;
  action: "edit" | "delete";
  actorId: string;
  actorName: string;
  summary: string;
  fields: string[];
}

export interface AppDatabase {
  clinicSettings: ClinicSettings;
  users: UserProfile[];
  specialties: Specialty[];
  services: Service[];
  doctorAvailability: DoctorAvailability[];
  patients: Patient[];
  appointments: Appointment[];
  consultations: Consultation[];
  prescriptions: Prescription[];
  bookings: Booking[];
  referrals: Referral[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payments: Payment[];
  suppliers: Supplier[];
  inventoryCategories: InventoryCategory[];
  inventoryItems: InventoryItem[];
  stockTransactions: StockTransaction[];
  inventoryUsageLogs: InventoryUsageLog[];
  labServices: LabService[];
  labOrders: LabOrder[];
  labResults: LabResult[];
  labBookingRequests: LabBookingRequest[];
  fileUploads: FileUpload[];
  auditLogs: AuditLog[];
}
