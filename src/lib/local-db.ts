import { queryClient } from '../app/query-client';
import { defaultClinicSettings } from '../config/clinic';
import { createSeedDatabase } from '../data/seed';
import type {
  AccessRoleTemplate,
  AppDatabase,
  Appointment,
  AuditLog,
  Booking,
  ClinicSettings,
  Consultation,
  DoctorFeeSettings,
  DoctorAvailability,
  InventoryItem,
  InventoryUsageLog,
  Invoice,
  InvoiceItem,
  LabBookingRequest,
  LabBookingStatus,
  LabOrder,
  LabResult,
  LabService,
  LabServiceCategory,
  PatientActionLog,
  Patient,
  PosPaymentMethod,
  PosSale,
  PosSaleItem,
  Permission,
  Prescription,
  Referral,
  Service,
  Specialty,
  Supplier,
  UserProfile,
} from '../types/domain';
import { generateBookingReceiptCode, generateId, generateInventoryQrCode, generatePatientQrCode } from './utils';
import { hashSecret } from './utils';

const STORAGE_KEY = 'odyssey-clinic-demo-db-v2';
const PATIENT_ACTION_LOGS_KEY = 'odyssey-clinic-patient-action-logs-v1';
const USER_PERMISSION_OVERRIDES_KEY = 'odyssey-clinic-user-permission-overrides-v1';
const ACCESS_ROLE_TEMPLATES_KEY = 'odyssey-clinic-access-role-templates-v1';
const USER_ACCESS_ROLE_ASSIGNMENTS_KEY = 'odyssey-clinic-user-access-role-assignments-v1';
const USER_PIN_CREDENTIALS_KEY = 'odyssey-clinic-user-pin-credentials-v1';

interface UserPermissionOverride {
  userId?: string;
  email: string;
  permissions: Permission[];
}

interface UserAccessRoleAssignment {
  userId?: string;
  email: string;
  accessRoleId: string;
}

interface UserPinCredential {
  userId?: string;
  email: string;
  pinHash: string;
  updatedAt: string;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getDatabase(): AppDatabase {
  if (!canUseStorage()) {
    return normalizeDatabase(createSeedDatabase());
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const seeded = normalizeDatabase(createSeedDatabase());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  const parsed = JSON.parse(stored) as Partial<AppDatabase>;
  const merged = normalizeDatabase({
    ...createSeedDatabase(),
    ...parsed,
    doctorAvailability: parsed.doctorAvailability ?? [],
    referrals: parsed.referrals ?? [],
    labBookingRequests: parsed.labBookingRequests ?? [],
  } as AppDatabase);

  if (
    (parsed.patients ?? []).some((patient) => !patient.qrCode) ||
    (parsed.inventoryItems ?? []).some((item) => !item.qrCode) ||
    parsed.inventoryUsageLogs == null ||
    (parsed.services ?? []).some(
      (service) => service.deliveryMode == null || service.isBookable == null || service.durationMinutes == null,
    )
  ) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }

  return merged;
}

export function saveDatabase(database: AppDatabase) {
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  }
}

function getPatientActionLogsStorage(): PatientActionLog[] {
  if (!canUseStorage()) {
    return [];
  }

  const stored = window.localStorage.getItem(PATIENT_ACTION_LOGS_KEY);
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as PatientActionLog[];
  } catch {
    return [];
  }
}

function savePatientActionLogs(logs: PatientActionLog[]) {
  if (canUseStorage()) {
    window.localStorage.setItem(PATIENT_ACTION_LOGS_KEY, JSON.stringify(logs));
  }
}

function getUserPermissionOverridesStorage(): UserPermissionOverride[] {
  if (!canUseStorage()) {
    return [];
  }

  const stored = window.localStorage.getItem(USER_PERMISSION_OVERRIDES_KEY);
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as UserPermissionOverride[];
  } catch {
    return [];
  }
}

function saveUserPermissionOverridesStorage(overrides: UserPermissionOverride[]) {
  if (canUseStorage()) {
    window.localStorage.setItem(USER_PERMISSION_OVERRIDES_KEY, JSON.stringify(overrides));
  }
}

function buildSystemAccessRoles(): AccessRoleTemplate[] {
  const timestamp = new Date().toISOString();
  return [
    {
      id: 'access_owner_admin',
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Owner / Admin',
      description: 'Full system access for the clinic owner or administrator.',
      permissions: [
        'dashboard.view',
        'patients.view',
        'patients.manage',
        'appointments.view',
        'appointments.manage',
        'consultations.manage',
        'billing.view',
        'billing.manage',
        'pos.view',
        'pos.manage',
        'inventory.view',
        'inventory.manage',
        'laboratory.view',
        'laboratory.manage',
        'settings.view',
        'settings.manage',
        'booking.view',
        'booking.manage',
        'users.manage',
      ],
      isSystem: true,
    },
    {
      id: 'access_doctor',
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Doctor',
      description: 'Clinical access for providers handling consultations and patient review.',
      permissions: ['dashboard.view', 'patients.view', 'appointments.view', 'consultations.manage', 'laboratory.view', 'booking.view'],
      isSystem: true,
    },
    {
      id: 'access_specialist',
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Specialist',
      description: 'External specialist access for referrals, patient chart review, SOAP documentation, and schedule management.',
      permissions: ['patients.view', 'appointments.view', 'consultations.manage', 'booking.view'],
      isSystem: true,
    },
    {
      id: 'access_nurse_staff',
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Nurse / Staff',
      description: 'Care-team access for patient intake, appointments, and consultation support.',
      permissions: ['dashboard.view', 'patients.view', 'patients.manage', 'appointments.view', 'appointments.manage', 'consultations.manage', 'laboratory.view'],
      isSystem: true,
    },
    {
      id: 'access_front_desk_cashier',
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Front Desk / Cashier',
      description: 'Reception and payment access for scheduling, billing, and bookings.',
      permissions: ['dashboard.view', 'patients.view', 'patients.manage', 'appointments.view', 'appointments.manage', 'billing.view', 'billing.manage', 'pos.view', 'pos.manage', 'laboratory.view', 'booking.view', 'booking.manage'],
      isSystem: true,
    },
    {
      id: 'access_lab_staff',
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Lab Staff',
      description: 'Laboratory operations access for sample processing and result handling.',
      permissions: ['dashboard.view', 'patients.view', 'laboratory.view', 'laboratory.manage'],
      isSystem: true,
    },
    {
      id: 'access_inventory_staff',
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Inventory Staff',
      description: 'Stock and supply access for inventory monitoring and updates.',
      permissions: ['dashboard.view', 'inventory.view', 'inventory.manage'],
      isSystem: true,
    },
  ];
}

function getAccessRoleTemplatesStorage(): AccessRoleTemplate[] {
  if (!canUseStorage()) {
    return buildSystemAccessRoles();
  }

  const stored = window.localStorage.getItem(ACCESS_ROLE_TEMPLATES_KEY);
  if (!stored) {
    const seeded = buildSystemAccessRoles();
    window.localStorage.setItem(ACCESS_ROLE_TEMPLATES_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(stored) as AccessRoleTemplate[];
    const systemRoles = buildSystemAccessRoles();
    const customRoles = parsed.filter((role) => !role.isSystem);
    return [...systemRoles, ...customRoles];
  } catch {
    const seeded = buildSystemAccessRoles();
    window.localStorage.setItem(ACCESS_ROLE_TEMPLATES_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function saveAccessRoleTemplatesStorage(roles: AccessRoleTemplate[]) {
  if (canUseStorage()) {
    window.localStorage.setItem(ACCESS_ROLE_TEMPLATES_KEY, JSON.stringify(roles));
  }
}

function getUserAccessRoleAssignmentsStorage(): UserAccessRoleAssignment[] {
  if (!canUseStorage()) {
    return [];
  }

  const stored = window.localStorage.getItem(USER_ACCESS_ROLE_ASSIGNMENTS_KEY);
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as UserAccessRoleAssignment[];
  } catch {
    return [];
  }
}

function saveUserAccessRoleAssignmentsStorage(assignments: UserAccessRoleAssignment[]) {
  if (canUseStorage()) {
    window.localStorage.setItem(USER_ACCESS_ROLE_ASSIGNMENTS_KEY, JSON.stringify(assignments));
  }
}

function getUserPinCredentialsStorage(): UserPinCredential[] {
  if (!canUseStorage()) {
    return [];
  }

  const stored = window.localStorage.getItem(USER_PIN_CREDENTIALS_KEY);
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as UserPinCredential[];
  } catch {
    return [];
  }
}

function saveUserPinCredentialsStorage(credentials: UserPinCredential[]) {
  if (canUseStorage()) {
    window.localStorage.setItem(USER_PIN_CREDENTIALS_KEY, JSON.stringify(credentials));
  }
}

export function updateDatabase(mutator: (draft: AppDatabase) => void) {
  const next = structuredClone(getDatabase());
  mutator(next);
  next.clinicSettings.updatedAt = new Date().toISOString();
  saveDatabase(next);
  void queryClient.invalidateQueries();
  return next;
}

export function resetDemoData() {
  const seeded = normalizeDatabase(createSeedDatabase());
  saveDatabase(seeded);
  void queryClient.invalidateQueries();
}

export function getClinicSettings() {
  return getDatabase().clinicSettings ?? defaultClinicSettings;
}

export function updateClinicSettings(input: Partial<ClinicSettings>) {
  return updateDatabase((draft) => {
    draft.clinicSettings = {
      ...draft.clinicSettings,
      ...input,
      updatedAt: new Date().toISOString(),
    };
  }).clinicSettings;
}

export function listUsers() {
  return getDatabase().users.map((profile) => applyUserPermissionOverride(applyUserAccessRoleAssignment(profile)));
}

export function createUserProfile(input: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.users.unshift({
      ...input,
      id: generateId('user'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    draft.auditLogs.unshift(createAuditLog('user_owner', 'create', 'profile'));
  }).users[0];
}

export function updateUserProfileRecord(
  id: string,
  input: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>,
) {
  return updateDatabase((draft) => {
    const user = draft.users.find((item) => item.id === id);
    if (!user) {
      throw new Error('User not found.');
    }

    Object.assign(user, input, {
      updatedAt: new Date().toISOString(),
    });
  }).users.find((item) => item.id === id) ?? null;
}

export function deleteUserProfileRecord(id: string) {
  return updateDatabase((draft) => {
    draft.users = draft.users.filter((item) => item.id !== id);
  }).users;
}

export function saveUserPermissionOverride(input: { userId?: string; email: string; permissions: Permission[] }) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingOverrides = getUserPermissionOverridesStorage();
  const filteredOverrides = existingOverrides.filter(
    (item) => item.email.toLowerCase() !== normalizedEmail && (!input.userId || item.userId !== input.userId),
  );

  filteredOverrides.unshift({
    userId: input.userId,
    email: normalizedEmail,
    permissions: input.permissions,
  });

  saveUserPermissionOverridesStorage(filteredOverrides);
  void queryClient.invalidateQueries();
}

export function clearUserPermissionOverride(input: { userId?: string; email?: string }) {
  const normalizedEmail = input.email?.trim().toLowerCase();
  const filteredOverrides = getUserPermissionOverridesStorage().filter(
    (item) =>
      (input.userId ? item.userId !== input.userId : true) &&
      (normalizedEmail ? item.email.toLowerCase() !== normalizedEmail : true),
  );

  saveUserPermissionOverridesStorage(filteredOverrides);
  void queryClient.invalidateQueries();
}

export function applyUserPermissionOverride(profile: UserProfile): UserProfile {
  const override = getUserPermissionOverridesStorage().find(
    (item) =>
      (item.userId && (item.userId === profile.id || item.userId === profile.authUserId)) ||
      item.email.toLowerCase() === profile.email.toLowerCase(),
  );

  if (!override) {
    return profile;
  }

  return {
    ...profile,
    permissions: override.permissions,
  };
}

export function listAccessRoles() {
  return getAccessRoleTemplatesStorage();
}

export function createAccessRole(input: Omit<AccessRoleTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isSystem'>) {
  const timestamp = new Date().toISOString();
  const nextRole: AccessRoleTemplate = {
    ...input,
    id: generateId('accessrole'),
    createdAt: timestamp,
    updatedAt: timestamp,
    isSystem: false,
  };

  saveAccessRoleTemplatesStorage([nextRole, ...getAccessRoleTemplatesStorage()]);
  void queryClient.invalidateQueries();
  return nextRole;
}

export function updateAccessRoleRecord(id: string, input: Omit<AccessRoleTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isSystem'>) {
  const nextRoles = getAccessRoleTemplatesStorage().map((role) => {
    if (role.id !== id) {
      return role;
    }

    if (role.isSystem) {
      throw new Error('System roles cannot be edited here.');
    }

    return {
      ...role,
      ...input,
      updatedAt: new Date().toISOString(),
    };
  });

  saveAccessRoleTemplatesStorage(nextRoles);
  void queryClient.invalidateQueries();
  return nextRoles.find((role) => role.id === id) ?? null;
}

export function deleteAccessRoleRecord(id: string) {
  const targetRole = getAccessRoleTemplatesStorage().find((role) => role.id === id);
  if (targetRole?.isSystem) {
    throw new Error('System roles cannot be deleted.');
  }

  saveAccessRoleTemplatesStorage(getAccessRoleTemplatesStorage().filter((role) => role.id !== id));
  saveUserAccessRoleAssignmentsStorage(getUserAccessRoleAssignmentsStorage().filter((assignment) => assignment.accessRoleId !== id));
  void queryClient.invalidateQueries();
}

export function saveUserAccessRoleAssignment(input: { userId?: string; email: string; accessRoleId: string }) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const filteredAssignments = getUserAccessRoleAssignmentsStorage().filter(
    (item) => item.email.toLowerCase() !== normalizedEmail && (!input.userId || item.userId !== input.userId),
  );

  filteredAssignments.unshift({
    userId: input.userId,
    email: normalizedEmail,
    accessRoleId: input.accessRoleId,
  });

  saveUserAccessRoleAssignmentsStorage(filteredAssignments);
  void queryClient.invalidateQueries();
}

export function clearUserAccessRoleAssignment(input: { userId?: string; email?: string }) {
  const normalizedEmail = input.email?.trim().toLowerCase();
  const filteredAssignments = getUserAccessRoleAssignmentsStorage().filter(
    (item) =>
      (input.userId ? item.userId !== input.userId : true) &&
      (normalizedEmail ? item.email.toLowerCase() !== normalizedEmail : true),
  );

  saveUserAccessRoleAssignmentsStorage(filteredAssignments);
  void queryClient.invalidateQueries();
}

export function applyUserAccessRoleAssignment(profile: UserProfile): UserProfile {
  const assignment = getUserAccessRoleAssignmentsStorage().find(
    (item) =>
      (item.userId && (item.userId === profile.id || item.userId === profile.authUserId)) ||
      item.email.toLowerCase() === profile.email.toLowerCase(),
  );

  if (!assignment) {
    return profile;
  }

  const accessRole = getAccessRoleTemplatesStorage().find((role) => role.id === assignment.accessRoleId);
  if (!accessRole) {
    return profile;
  }

  return {
    ...profile,
    accessRoleId: accessRole.id,
    accessRoleName: accessRole.name,
    permissions: accessRole.permissions,
  };
}

export async function hasUserPin(profile: Pick<UserProfile, 'id' | 'authUserId' | 'email'>) {
  const normalizedEmail = profile.email.trim().toLowerCase();
  return getUserPinCredentialsStorage().some(
    (item) =>
      (item.userId && (item.userId === profile.id || item.userId === profile.authUserId)) ||
      item.email.toLowerCase() === normalizedEmail,
  );
}

export async function saveUserPin(
  profile: Pick<UserProfile, 'id' | 'authUserId' | 'email'>,
  pin: string,
) {
  const normalizedEmail = profile.email.trim().toLowerCase();
  const pinHash = await hashSecret(pin);
  const updatedAt = new Date().toISOString();
  const filteredCredentials = getUserPinCredentialsStorage().filter(
    (item) =>
      item.email.toLowerCase() !== normalizedEmail &&
      item.userId !== profile.id &&
      item.userId !== profile.authUserId,
  );

  filteredCredentials.unshift({
    userId: profile.authUserId || profile.id,
    email: normalizedEmail,
    pinHash,
    updatedAt,
  });

  saveUserPinCredentialsStorage(filteredCredentials);
  void queryClient.invalidateQueries();
}

export async function verifyUserPin(
  profile: Pick<UserProfile, 'id' | 'authUserId' | 'email'>,
  pin: string,
) {
  const normalizedEmail = profile.email.trim().toLowerCase();
  const pinHash = await hashSecret(pin);

  return getUserPinCredentialsStorage().some(
    (item) =>
      item.pinHash === pinHash &&
      ((item.userId && (item.userId === profile.id || item.userId === profile.authUserId)) ||
        item.email.toLowerCase() === normalizedEmail),
  );
}

export function listSpecialties() {
  return getDatabase().specialties;
}

export function createSpecialty(input: Omit<Specialty, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.specialties.unshift({
      ...input,
      id: generateId('spec'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }).specialties[0];
}

export function updateSpecialtyRecord(id: string, input: Omit<Specialty, 'id' | 'createdAt' | 'updatedAt'>) {
  return updateDatabase((draft) => {
    const specialty = draft.specialties.find((item) => item.id === id);
    if (!specialty) {
      throw new Error('Specialty not found.');
    }

    Object.assign(specialty, input, {
      updatedAt: new Date().toISOString(),
    });
  }).specialties.find((item) => item.id === id) ?? null;
}

export function deleteSpecialtyRecord(id: string) {
  return updateDatabase((draft) => {
    draft.specialties = draft.specialties.filter((item) => item.id !== id);
  }).specialties;
}

export function listServices() {
  return getDatabase().services;
}

export function listDoctorAvailabilityByDoctor(doctorId: string) {
  return getDatabase().doctorAvailability
    .filter((slot) => slot.doctorId === doctorId)
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek || left.startTime.localeCompare(right.startTime));
}

export function updateDoctorFeeSettings(doctorId: string, input: DoctorFeeSettings) {
  return updateDatabase((draft) => {
    const doctorUser = draft.users.find((item) => item.id === doctorId);
    if (!doctorUser) {
      throw new Error('Doctor record not found.');
    }

    Object.assign(doctorUser, {
      consultationFee: input.consultationFee,
      followUpFee: input.followUpFee,
      updatedAt: new Date().toISOString(),
    });
  }).users.find((item) => item.id === doctorId) ?? null;
}

export function replaceDoctorAvailability(
  doctorId: string,
  slots: Array<Omit<DoctorAvailability, 'id' | 'createdAt' | 'updatedAt'>>,
) {
  const timestamp = new Date().toISOString();

  return updateDatabase((draft) => {
    draft.doctorAvailability = draft.doctorAvailability.filter((item) => item.doctorId !== doctorId);
    draft.doctorAvailability.unshift(
      ...slots.map((slot) => ({
        ...slot,
        id: generateId('avail'),
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    );
    draft.auditLogs.unshift(createAuditLog(doctorId, 'update', 'doctor_availability'));
  }).doctorAvailability
    .filter((item) => item.doctorId === doctorId)
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek || left.startTime.localeCompare(right.startTime));
}

export function createService(input: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.services.unshift({
      ...input,
      serviceType: input.serviceType || 'medical_service',
      id: generateId('svc'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }).services[0];
}

export function updateServiceRecord(id: string, input: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) {
  return updateDatabase((draft) => {
    const service = draft.services.find((item) => item.id === id);
    if (!service) {
      throw new Error('Service not found.');
    }

    Object.assign(service, input, {
      updatedAt: new Date().toISOString(),
    });
  }).services.find((item) => item.id === id) ?? null;
}

export function deleteServiceRecord(id: string) {
  return updateDatabase((draft) => {
    draft.services = draft.services.filter((item) => item.id !== id);
  }).services;
}

export function listSuppliers() {
  return getDatabase().suppliers;
}

export function createSupplier(input: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.suppliers.unshift({
      ...input,
      id: generateId('sup'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }).suppliers[0];
}

export function updateSupplierRecord(id: string, input: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) {
  return updateDatabase((draft) => {
    const supplier = draft.suppliers.find((item) => item.id === id);
    if (!supplier) {
      throw new Error('Supplier not found.');
    }

    Object.assign(supplier, input, {
      updatedAt: new Date().toISOString(),
    });
  }).suppliers.find((item) => item.id === id) ?? null;
}

export function deleteSupplierRecord(id: string) {
  return updateDatabase((draft) => {
    draft.suppliers = draft.suppliers.filter((item) => item.id !== id);
  }).suppliers;
}

export function upsertPatient(input: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.patients.unshift({
      ...input,
      qrCode: input.qrCode || generatePatientQrCode(),
      intakeSource: input.intakeSource ?? 'staff_walk_in',
      visitStatus: input.visitStatus ?? 'visited_clinic',
      lastClinicVisitAt: input.lastClinicVisitAt ?? null,
      id: generateId('pat'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    draft.auditLogs.unshift(createAuditLog('user_owner', 'create', 'patient'));
  }).patients[0];
}

export function updatePatientRecord(
  patientId: string,
  input: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>,
) {
  return updateDatabase((draft) => {
    const patient = draft.patients.find((item) => item.id === patientId);
    if (!patient) {
      throw new Error('Patient record not found.');
    }

    Object.assign(patient, input, {
      updatedAt: new Date().toISOString(),
    });
  }).patients.find((item) => item.id === patientId) ?? null;
}

export function deletePatientRecord(patientId: string) {
  return updateDatabase((draft) => {
    draft.patients = draft.patients.filter((item) => item.id !== patientId);
  }).patients;
}

export function listPatientActionLogs() {
  return getPatientActionLogsStorage().sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createPatientActionLog(
  input: Omit<PatientActionLog, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const timestamp = new Date().toISOString();
  const nextLog: PatientActionLog = {
    ...input,
    id: generateId('patientlog'),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const nextLogs = [nextLog, ...getPatientActionLogsStorage()];
  savePatientActionLogs(nextLogs);
  void queryClient.invalidateQueries({ queryKey: ['patient-action-logs'] });

  return nextLog;
}

export function listPatients() {
  return getDatabase().patients;
}

export function getPatientById(patientId: string) {
  return getDatabase().patients.find((patient) => patient.id === patientId) ?? null;
}

export function getPatientByQrCode(qrCode: string) {
  return getDatabase().patients.find((patient) => patient.qrCode === qrCode) ?? null;
}

export function listAppointments() {
  return getDatabase().appointments;
}

export function createAppointment(input: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    const appointment = {
      ...input,
      id: generateId('appt'),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    draft.appointments.unshift(appointment);

    if (appointment.bookingId) {
      const booking = draft.bookings.find((item) => item.id === appointment.bookingId);
      if (booking) {
        booking.appointmentId = appointment.id;
        booking.updatedAt = timestamp;
      }
    }

    draft.auditLogs.unshift(createAuditLog('user_owner', 'create', 'appointment'));
  }).appointments[0];
}

export function updateAppointmentRecord(
  appointmentId: string,
  input: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>,
) {
  return updateDatabase((draft) => {
    const appointment = draft.appointments.find((item) => item.id === appointmentId);
    if (!appointment) {
      throw new Error('Appointment record not found.');
    }

    Object.assign(appointment, input, {
      updatedAt: new Date().toISOString(),
    });
  }).appointments.find((item) => item.id === appointmentId) ?? null;
}

export function deleteAppointmentRecord(appointmentId: string) {
  return updateDatabase((draft) => {
    draft.appointments = draft.appointments.filter((item) => item.id !== appointmentId);
  }).appointments;
}

export function createConsultation(input: Omit<Consultation, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.consultations.unshift({
      ...input,
      id: generateId('consult'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    draft.auditLogs.unshift(createAuditLog(input.doctorId, 'create', 'consultation'));
  }).consultations[0];
}

export function createPrescription(input: Omit<Prescription, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.prescriptions.unshift({
      ...input,
      id: generateId('rx'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    draft.auditLogs.unshift(createAuditLog(input.patientId, 'create', 'prescription'));
  }).prescriptions[0];
}

export function listBookings() {
  return getDatabase().bookings;
}

export function listReferralsByPatient(patientId: string) {
  return getDatabase().referrals
    .filter((referral) => referral.patientId === patientId)
    .sort((left, right) => right.referredAt.localeCompare(left.referredAt));
}

export function listReferralsByTargetDoctor(targetDoctorId: string) {
  return getDatabase().referrals
    .filter((referral) => referral.targetDoctorId === targetDoctorId)
    .sort((left, right) => right.referredAt.localeCompare(left.referredAt));
}

export function createReferral(input: Omit<Referral, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.referrals.unshift({
      ...input,
      id: generateId('ref'),
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: input.status === 'completed' ? timestamp : null,
    });
    draft.auditLogs.unshift(createAuditLog(input.referringDoctorId, 'create', 'referral'));
  }).referrals[0];
}

export function updateReferralOutcome(
  referralId: string,
  input: Pick<Referral, 'status' | 'specialistFindings' | 'specialistRecommendations' | 'specialistVisitedAt'>,
) {
  return updateDatabase((draft) => {
    const referral = draft.referrals.find((item) => item.id === referralId);
    if (!referral) {
      return;
    }

    referral.status = input.status;
    referral.specialistFindings = input.specialistFindings;
    referral.specialistRecommendations = input.specialistRecommendations;
    referral.specialistVisitedAt = input.specialistVisitedAt;
    referral.completedAt = input.status === 'completed' ? new Date().toISOString() : null;
    referral.updatedAt = new Date().toISOString();
    draft.auditLogs.unshift(createAuditLog(referral.targetDoctorId ?? 'user_owner', 'update', 'referral'));
  }).referrals.find((item) => item.id === referralId) ?? null;
}

export function updateReferralStatus(
  referralId: string,
  input: Pick<Referral, 'status' | 'referralNotes'>,
) {
  return updateDatabase((draft) => {
    const referral = draft.referrals.find((item) => item.id === referralId);
    if (!referral) {
      return;
    }

    referral.status = input.status;
    referral.referralNotes = input.referralNotes;
    referral.completedAt = input.status === 'completed' ? new Date().toISOString() : null;
    referral.updatedAt = new Date().toISOString();
    draft.auditLogs.unshift(createAuditLog(referral.targetDoctorId ?? 'user_owner', 'update', 'referral'));
  }).referrals.find((item) => item.id === referralId) ?? null;
}

export function createBooking(input: Omit<Booking, 'id' | 'createdAt' | 'updatedAt' | 'status'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.bookings.unshift({
      ...input,
      appointmentId: input.appointmentId ?? null,
      id: generateId('book'),
      status: 'pending',
      receiptCode: input.receiptCode || generateBookingReceiptCode(),
      paymentStatus: input.paymentStatus || 'pending_cashier',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }).bookings[0];
}

export function getBookingByReceiptCode(receiptCode: string) {
  return getDatabase().bookings.find((booking) => booking.receiptCode === receiptCode) ?? null;
}

function resolveBookingScheduledAtIso(input: {
  preferredDate: string | null | undefined;
  preferredTime: string | null | undefined;
  fallbackIso?: string | null;
}) {
  const dateValue = input.preferredDate?.trim() ?? '';
  const timeValue = input.preferredTime?.trim() ?? '';

  if (dateValue && timeValue) {
    const timeMatch = timeValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2]);
      const second = Number(timeMatch[3] ?? '0');

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
        const normalizedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
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

export function markBookingPaidAndCreateInvoice(receiptCode: string) {
  const database = getDatabase();
  const booking = database.bookings.find((item) => item.receiptCode === receiptCode);
  if (!booking) {
    throw new Error('Booking receipt not found.');
  }

  if (booking.paymentStatus === 'paid') {
    return { booking, invoice: database.invoices.find((invoice) => invoice.patientId === booking.patientId) ?? null };
  }

  const invoiceNumber = `INV-${Date.now()}`;
  const description = booking.feeType === 'follow_up' ? 'Follow-up Fee' : booking.feeType === 'consultation' ? 'Consultation Fee' : 'Medical Service Fee';
  const existingAppointment = booking.appointmentId
    ? database.appointments.find((item) => item.id === booking.appointmentId) ?? null
    : null;
  const appointment = existingAppointment ?? createAppointment({
    patientId: booking.patientId,
    doctorId: booking.doctorId || 'user_owner',
    specialtyId: '',
    serviceId: booking.serviceId,
    bookingId: booking.id,
    scheduledAt: resolveBookingScheduledAtIso({
      preferredDate: booking.preferredDate,
      preferredTime: booking.preferredTime,
      fallbackIso: booking.createdAt,
    }),
    status: 'scheduled',
    source: 'internal',
    visitType: 'in_person',
    reason: description,
    notes: booking.intakeNotes,
    teleconsultationPlatform: null,
    teleconsultationUrl: null,
    teleconsultationAccessInstructions: null,
    consultationId: null,
    completedBy: null,
    completedAt: null,
    deletedAt: null,
  });
  const invoice = createInvoice(
    {
      patientId: booking.patientId,
      appointmentId: appointment.id,
      invoiceNumber,
      paymentStatus: 'paid',
      subtotal: booking.feeAmount,
      total: booking.feeAmount,
    },
    [
      {
        description,
        quantity: 1,
        unitPrice: booking.feeAmount,
        category: 'consultation',
      },
    ],
  );

  const updatedBooking = updateDatabase((draft) => {
    const target = draft.bookings.find((item) => item.receiptCode === receiptCode);
    if (!target) {
      return;
    }
    target.paymentStatus = 'paid';
    target.appointmentId = appointment.id;
    target.updatedAt = new Date().toISOString();
  }).bookings.find((item) => item.receiptCode === receiptCode) ?? null;

  return { booking: updatedBooking, invoice };
}

export function listInvoices() {
  return getDatabase().invoices;
}

export function createInvoice(
  invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>,
  items: Array<Omit<InvoiceItem, 'id' | 'createdAt' | 'updatedAt' | 'invoiceId'>>,
) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    const invoiceId = generateId('inv');
    draft.invoices.unshift({
      ...invoice,
      id: invoiceId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    draft.invoiceItems.unshift(
      ...items.map((item) => ({
        ...item,
        id: generateId('inv_item'),
        invoiceId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    );
  }).invoices[0];
}

export function updateInvoiceRecord(
  invoiceId: string,
  invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>,
  item: Omit<InvoiceItem, 'id' | 'createdAt' | 'updatedAt' | 'invoiceId'>,
) {
  const timestamp = new Date().toISOString();

  return updateDatabase((draft) => {
    const targetInvoice = draft.invoices.find((entry) => entry.id === invoiceId);
    if (!targetInvoice) {
      throw new Error('Invoice record not found.');
    }

    Object.assign(targetInvoice, invoice, {
      updatedAt: timestamp,
    });

    const existingItems = draft.invoiceItems.filter((entry) => entry.invoiceId === invoiceId);
    if (existingItems.length > 0) {
      Object.assign(existingItems[0], item, {
        updatedAt: timestamp,
      });
      if (existingItems.length > 1) {
        const [firstItem] = existingItems;
        draft.invoiceItems = draft.invoiceItems.filter((entry) => entry.invoiceId !== invoiceId || entry.id === firstItem.id);
      }
    } else {
      draft.invoiceItems.unshift({
        ...item,
        id: generateId('inv_item'),
        invoiceId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }).invoices.find((entry) => entry.id === invoiceId) ?? null;
}

export function deleteInvoiceRecord(invoiceId: string) {
  return updateDatabase((draft) => {
    draft.invoices = draft.invoices.filter((entry) => entry.id !== invoiceId);
    draft.invoiceItems = draft.invoiceItems.filter((entry) => entry.invoiceId !== invoiceId);
  }).invoices;
}

export function listInventoryItems() {
  return getDatabase().inventoryItems;  
}

export function createInventoryItem(
  input: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'qrCode'> & { qrCode?: string },
) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.inventoryItems.unshift({
      ...input,
      qrCode: input.qrCode || generateInventoryQrCode(),
      id: generateId('item'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }).inventoryItems[0];
}

export function updateInventoryItemRecord(
  itemId: string,
  input: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'qrCode'> & { qrCode?: string },
) {
  return updateDatabase((draft) => {
    const item = draft.inventoryItems.find((entry) => entry.id === itemId);
    if (!item) {
      throw new Error('Inventory item not found.');
    }

    Object.assign(item, {
      ...input,
      qrCode: input.qrCode || item.qrCode,
      updatedAt: new Date().toISOString(),
    });
  }).inventoryItems.find((entry) => entry.id === itemId) ?? null;
}

export function deleteInventoryItemRecord(itemId: string) {
  return updateDatabase((draft) => {
    draft.inventoryItems = draft.inventoryItems.filter((entry) => entry.id !== itemId);
  }).inventoryItems;
}

export function getInventoryItemByQrCode(qrCode: string) {
  const normalizedCode = qrCode.trim().toUpperCase();
  return getDatabase().inventoryItems.find((item) => item.qrCode === normalizedCode || item.sku.trim().toUpperCase() === normalizedCode) ?? null;
}

export function listPosSales() {
  return getDatabase().posSales;
}

export function listPosSaleItems() {
  return getDatabase().posSaleItems;
}

export function createPosSaleRecord(input: Omit<PosSale, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.posSales.unshift({
      ...input,
      id: generateId('possale'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }).posSales[0];
}

export function createPosSaleItemRecord(input: Omit<PosSaleItem, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.posSaleItems.unshift({
      ...input,
      id: generateId('positem'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }).posSaleItems[0];
}

export function checkoutPosSale(input: {
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
}) {
  if (input.items.length === 0) {
    throw new Error('Add at least one inventory item before checkout.');
  }

  const timestamp = new Date().toISOString();
  const saleNumber = `POS-${Date.now()}`;

  const nextDatabase = updateDatabase((draft) => {
    const saleItems = input.items.map((entry) => {
      const item = draft.inventoryItems.find((inventoryItem) => inventoryItem.id === entry.inventoryItemId);
      if (!item) {
        throw new Error('Inventory item not found.');
      }

      if (entry.quantity <= 0) {
        throw new Error(`Quantity for ${item.name} must be at least 1.`);
      }

      if (item.stockOnHand < entry.quantity) {
        throw new Error(`Only ${item.stockOnHand} ${item.unit} remaining for ${item.name}.`);
      }

      const unitPrice = Number(entry.unitPrice ?? item.sellingPrice ?? 0);
      const lineTotal = unitPrice * entry.quantity;

      return {
        item,
        quantity: entry.quantity,
        unitPrice,
        lineTotal,
      };
    });

    const subtotal = saleItems.reduce((sum, entry) => sum + entry.lineTotal, 0);
    const saleId = generateId('possale');

    draft.posSales.unshift({
      id: saleId,
      saleNumber,
      patientId: input.patientId ?? null,
      cashierId: input.cashierId,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference ?? null,
      paymentNotes: input.paymentNotes ?? null,
      subtotal,
      total: subtotal,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    for (const entry of saleItems) {
      entry.item.stockOnHand -= entry.quantity;
      entry.item.updatedAt = timestamp;

      draft.posSaleItems.unshift({
        id: generateId('positem'),
        saleId,
        inventoryItemId: entry.item.id,
        itemName: entry.item.name,
        itemSku: entry.item.sku,
        itemUnit: entry.item.unit,
        quantity: entry.quantity,
        unitPrice: entry.unitPrice,
        lineTotal: entry.lineTotal,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      draft.stockTransactions.unshift({
        id: generateId('stock'),
        itemId: entry.item.id,
        type: 'sale',
        quantity: entry.quantity,
        remarks: `POS sale ${saleNumber}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    draft.auditLogs.unshift(createAuditLog(input.cashierId, 'create', 'pos_sale'));
  });

  const sale = nextDatabase.posSales.find((entry) => entry.saleNumber === saleNumber) ?? null;
  const items = sale ? nextDatabase.posSaleItems.filter((entry) => entry.saleId === sale.id) : [];

  return {
    sale,
    items,
  };
}

export function listInventoryUsageLogsByPatient(patientId: string) {
  return getDatabase().inventoryUsageLogs
    .filter((log) => log.patientId === patientId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function recordInventoryUsage(
  input: Omit<InventoryUsageLog, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const timestamp = new Date().toISOString();

  return updateDatabase((draft) => {
    const item = draft.inventoryItems.find((inventoryItem) => inventoryItem.id === input.itemId);
    if (!item) {
      throw new Error('Inventory item not found.');
    }

    if (input.quantity <= 0) {
      throw new Error('Quantity used must be at least 1.');
    }

    if (item.stockOnHand < input.quantity) {
      throw new Error(`Only ${item.stockOnHand} ${item.unit} remaining for ${item.name}.`);
    }

    item.stockOnHand -= input.quantity;
    item.updatedAt = timestamp;

    draft.stockTransactions.unshift({
      id: generateId('stock'),
      itemId: item.id,
      type: 'stock_out',
      quantity: input.quantity,
      remarks: `Used for patient ${input.patientId}. ${input.notes}`.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    draft.inventoryUsageLogs.unshift({
      ...input,
      id: generateId('invuse'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    draft.auditLogs.unshift(createAuditLog(input.recordedBy, 'create', 'inventory_usage'));
  }).inventoryUsageLogs[0];
}

export function listLabOrders() {
  return getDatabase().labOrders;
}

export function createLabOrder(order: Omit<LabOrder, 'id' | 'createdAt' | 'updatedAt'>, resultSummary?: string) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    const orderId = generateId('laborder');
    draft.labOrders.unshift({
      ...order,
      id: orderId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    if (resultSummary) {
      const result: LabResult = {
        id: generateId('labresult'),
        createdAt: timestamp,
        updatedAt: timestamp,
        labOrderId: orderId,
        resultSummary,
        releasedAt: order.status === 'released' ? timestamp : null,
        attachmentName: null,
      };
      draft.labResults.unshift(result);
    }
  }).labOrders[0];
}

export function updateLabOrder(
  id: string,
  order: Omit<LabOrder, 'id' | 'createdAt' | 'updatedAt'>,
  resultSummary?: string,
) {
  const timestamp = new Date().toISOString();

  return updateDatabase((draft) => {
    const existingOrder = draft.labOrders.find((entry) => entry.id === id);
    if (!existingOrder) {
      throw new Error('Lab order not found.');
    }

    Object.assign(existingOrder, order, {
      updatedAt: timestamp,
    });

    const existingResult = draft.labResults.find((entry) => entry.labOrderId === id);
    if (resultSummary && resultSummary.trim()) {
      if (existingResult) {
        existingResult.resultSummary = resultSummary;
        existingResult.releasedAt = order.status === 'released' ? timestamp : existingResult.releasedAt;
        existingResult.updatedAt = timestamp;
      } else {
        draft.labResults.unshift({
          id: generateId('labresult'),
          createdAt: timestamp,
          updatedAt: timestamp,
          labOrderId: id,
          resultSummary,
          releasedAt: order.status === 'released' ? timestamp : null,
          attachmentName: null,
        });
      }
    }
  }).labOrders.find((entry) => entry.id === id) ?? null;
}

export function deleteLabOrder(id: string) {
  return updateDatabase((draft) => {
    draft.labOrders = draft.labOrders.filter((entry) => entry.id !== id);
    draft.labResults = draft.labResults.filter((entry) => entry.labOrderId !== id);
  }).labOrders;
}

export function getDashboardSnapshot() {
  const database = getDatabase();
  const today = '2026-03-25';
  const todaysAppointments = database.appointments.filter((appointment) =>
    appointment.scheduledAt.startsWith(today),
  );
  const revenue = database.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const pendingConsultations = database.appointments.filter((appointment) =>
    ['scheduled', 'confirmed', 'in_progress'].includes(appointment.status),
  ).length;
  const labWorkload = database.labOrders.filter((order) => order.status !== 'released').length;
  const lowStock = database.inventoryItems.filter((item) => item.stockOnHand <= item.reorderLevel).length;

  return {
    appointmentsToday: todaysAppointments.length,
    patientCount: database.patients.length,
    revenue,
    pendingConsultations,
    labWorkload,
    lowStock,
  };
}

function createAuditLog(actorId: string, action: string, entityType: string): AuditLog {
  const timestamp = new Date().toISOString();
  return {
    id: generateId('audit'),
    actorId,
    action,
    entityType,
    entityId: generateId('entity'),
    details: `${action} ${entityType}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateLabService(id: string, input: Partial<Pick<LabService, 'name' | 'description' | 'price' | 'category'>>) {
  return updateDatabase((draft) => {
    const svc = draft.labServices.find((s) => s.id === id);
    if (!svc) return;
    Object.assign(svc, input, { updatedAt: new Date().toISOString() });
  });
}

export function deleteLabService(id: string) {
  return updateDatabase((draft) => {
    draft.labServices = draft.labServices.filter((s) => s.id !== id);
  });
}

export function createLabService(input: { name: string; description: string; price: number; category: LabServiceCategory }) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.labServices.unshift({
      ...input,
      id: generateId('labsvc'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }).labServices[0];
}

export function updateLabOrderSchedule(id: string, schedDate: string, schedTime: string) {
  return updateDatabase((draft) => {
    const order = draft.labOrders.find((o) => o.id === id);
    if (!order) return;
    order.schedDate = schedDate;
    order.schedTime = schedTime;
    order.updatedAt = new Date().toISOString();
  }).labOrders.find((o) => o.id === id) ?? null;
}

export function listLabBookingRequests() {
  return getDatabase().labBookingRequests;
}

export function createLabBookingRequest(input: Omit<LabBookingRequest, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'confirmedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.labBookingRequests.unshift({
      ...input,
      id: generateId('labreq'),
      status: 'Pending',
      confirmedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }).labBookingRequests[0];
}

export function updateLabBookingRequestStatus(id: string, status: LabBookingStatus) {
  return updateDatabase((draft) => {
    const req = draft.labBookingRequests.find((r) => r.id === id);
    if (!req) return;
    req.status = status;
    req.updatedAt = new Date().toISOString();
    if (status === 'Confirmed') {
      req.confirmedAt = new Date().toISOString();
    }
  }).labBookingRequests.find((r) => r.id === id) ?? null;
}

export function deleteLabBookingRequest(id: string) {
  return updateDatabase((draft) => {
    draft.labBookingRequests = draft.labBookingRequests.filter((r) => r.id !== id);
  });
}

export function createPatientProfileAccount(
  user: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>,
  patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    const userId = generateId('user');
    draft.users.unshift({
      ...user,
      id: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    draft.patients.unshift({
      ...patient,
      qrCode: patient.qrCode || generatePatientQrCode(),
      intakeSource: patient.intakeSource ?? 'online_registration',
      visitStatus: patient.visitStatus ?? 'registered_no_visit',
      lastClinicVisitAt: patient.lastClinicVisitAt ?? null,
      id: generateId('pat'),
      userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });
}

export function updatePatientProfileAccount(
  userId: string,
  input: Pick<Patient, 'mobileNumber' | 'address' | 'allergies' | 'medicalHistory' | 'emergencyContactName' | 'emergencyContactPhone'>,
) {
  return updateDatabase((draft) => {
    const user = draft.users.find((item) => item.id === userId || item.authUserId === userId);
    if (user) {
      user.phone = input.mobileNumber;
      user.updatedAt = new Date().toISOString();
    }

    const patient = draft.patients.find((item) => item.userId === userId);
    if (!patient) {
      throw new Error('Patient profile not found.');
    }

    patient.mobileNumber = input.mobileNumber;
    patient.address = input.address;
    patient.allergies = input.allergies;
    patient.medicalHistory = input.medicalHistory;
    patient.emergencyContactName = input.emergencyContactName;
    patient.emergencyContactPhone = input.emergencyContactPhone;
    patient.updatedAt = new Date().toISOString();
  }).patients.find((item) => item.userId === userId) ?? null;
}

function normalizeDatabase(database: AppDatabase) {
  return {
    ...database,
    services: database.services.map((service) => ({
      ...service,
      serviceType: service.serviceType ?? 'medical_service',
      durationMinutes: service.durationMinutes ?? 30,
      isBookable: service.isBookable ?? true,
      deliveryMode: service.deliveryMode ?? 'hybrid',
    })),
    users: database.users.map((user) => ({
      ...user,
      consultationFee: user.consultationFee ?? 0,
      followUpFee: user.followUpFee ?? 0,
    })),
    doctorAvailability: (database.doctorAvailability ?? []).map((slot) => ({
      ...slot,
      slotMinutes: slot.slotMinutes ?? 30,
    })),
    bookings: database.bookings.map((booking) => ({
      ...booking,
      feeType: booking.feeType ?? 'consultation',
      feeAmount: booking.feeAmount ?? 0,
      receiptCode: booking.receiptCode ?? generateBookingReceiptCode(),
      paymentStatus: booking.paymentStatus ?? 'pending_cashier',
    })),
    patients: database.patients.map((patient) => ({
      ...patient,
      qrCode: patient.qrCode || generatePatientQrCode(),
      intakeSource: patient.intakeSource ?? (patient.userId ? 'online_registration' : 'staff_walk_in'),
      visitStatus: patient.visitStatus ?? (patient.userId ? 'registered_no_visit' : 'visited_clinic'),
      lastClinicVisitAt: patient.lastClinicVisitAt ?? null,
    })),
    inventoryItems: database.inventoryItems.map((item) => ({
      ...item,
      qrCode: item.qrCode || generateInventoryQrCode(),
      costPrice: item.costPrice ?? 0,
      sellingPrice: item.sellingPrice ?? 0,
    })),
    inventoryUsageLogs: database.inventoryUsageLogs ?? [],
    posSales: database.posSales ?? [],
    posSaleItems: database.posSaleItems ?? [],
  };
}

