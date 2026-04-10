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
  Patient,
  Prescription,
  Referral,
  Service,
  Specialty,
  Supplier,
  UserProfile,
} from '../types/domain';
import { generateBookingReceiptCode, generateId, generateInventoryQrCode, generatePatientQrCode } from './utils';

const STORAGE_KEY = 'odyssey-clinic-demo-db-v2';

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
      intakeSource: input.intakeSource ?? 'staff_walk_in',
      visitStatus: input.visitStatus ?? 'visited_clinic',
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
  const invoice = createInvoice(
    {
      patientId: booking.patientId,
      appointmentId: null,
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

export function getInventoryItemByQrCode(qrCode: string) {
  return getDatabase().inventoryItems.find((item) => item.qrCode === qrCode) ?? null;
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
    })),
    inventoryItems: database.inventoryItems.map((item) => ({
      ...item,
      qrCode: item.qrCode || generateInventoryQrCode(),
    })),
    inventoryUsageLogs: database.inventoryUsageLogs ?? [],
  };
}

