import { queryClient } from '../app/query-client';
import { defaultClinicSettings } from '../config/clinic';
import { createSeedDatabase } from '../data/seed';
import type {
  AppDatabase,
  Appointment,
  AuditLog,
  Booking,
  ClinicSettings,
  Consultation,
  InventoryItem,
  Invoice,
  InvoiceItem,
  LabOrder,
  LabResult,
  Patient,
  Referral,
  Service,
  Specialty,
  Supplier,
  UserProfile,
} from '../types/domain';
import { generateId, generatePatientQrCode } from './utils';

const STORAGE_KEY = 'odyssey-clinic-demo-db-v1';

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
    referrals: parsed.referrals ?? [],
  } as AppDatabase);

  if (
    (parsed.patients ?? []).some((patient) => !patient.qrCode) ||
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
  return getDatabase().users;
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

export function listServices() {
  return getDatabase().services;
}

export function createService(input: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.services.unshift({
      ...input,
      id: generateId('svc'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }).services[0];
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

export function upsertPatient(input: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.patients.unshift({
      ...input,
      qrCode: input.qrCode || generatePatientQrCode(),
      id: generateId('pat'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    draft.auditLogs.unshift(createAuditLog('user_owner', 'create', 'patient'));
  }).patients[0];
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
    draft.appointments.unshift({
      ...input,
      id: generateId('appt'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    draft.auditLogs.unshift(createAuditLog('user_owner', 'create', 'appointment'));
  }).appointments[0];
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

export function listBookings() {
  return getDatabase().bookings;
}

export function listReferralsByPatient(patientId: string) {
  return getDatabase().referrals
    .filter((referral) => referral.patientId === patientId)
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

export function createBooking(input: Omit<Booking, 'id' | 'createdAt' | 'updatedAt' | 'status'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.bookings.unshift({
      ...input,
      id: generateId('book'),
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }).bookings[0];
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

export function listInventoryItems() {
  return getDatabase().inventoryItems;
}

export function createInventoryItem(input: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date().toISOString();
  return updateDatabase((draft) => {
    draft.inventoryItems.unshift({
      ...input,
      id: generateId('item'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }).inventoryItems[0];
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
      id: generateId('pat'),
      userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });
}

function normalizeDatabase(database: AppDatabase) {
  return {
    ...database,
    services: database.services.map((service) => ({
      ...service,
      durationMinutes: service.durationMinutes ?? 30,
      isBookable: service.isBookable ?? true,
      deliveryMode: service.deliveryMode ?? 'hybrid',
    })),
    patients: database.patients.map((patient) => ({
      ...patient,
      qrCode: patient.qrCode || generatePatientQrCode(),
    })),
  };
}

