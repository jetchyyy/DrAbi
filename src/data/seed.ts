import { defaultClinicSettings } from '../config/clinic';
import type { AppDatabase } from '../types/domain';

export function createSeedDatabase(): AppDatabase {
  return {
    clinicSettings: defaultClinicSettings,
    users: [],
    specialties: [],
    services: [],
    doctorAvailability: [],
    patients: [],
    appointments: [],
    consultations: [],
    prescriptions: [],
    bookings: [],
    referrals: [],
    invoices: [],
    invoiceItems: [],
    payments: [],
    suppliers: [],
    inventoryCategories: [],
    inventoryItems: [],
    stockTransactions: [],
    inventoryUsageLogs: [],
    posSales: [],
    posSaleItems: [],
    labServices: [],
    labOrders: [],
    labResults: [],
    labBookingRequests: [],
    fileUploads: [],
    auditLogs: [],
  };
}
