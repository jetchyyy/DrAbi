export const queryKeys = {
  clinicSettings: ["clinic-settings"] as const,
  services: ["services"] as const,
  specialties: ["specialties"] as const,
  doctors: ["doctors"] as const,
  providers: ["providers"] as const,
  doctorAvailability: (doctorId: string | null) =>
    ["doctor-availability", doctorId] as const,
  specialistAvailability: (doctorId: string | null) =>
    ["specialist-availability", doctorId] as const,
  blockedBookingSlots: (
    date: string | null,
    doctorId: string | null,
    serviceId: string | null,
  ) => ["blocked-booking-slots", date, doctorId, serviceId] as const,
  currentProfile: (userId: string | null) =>
    ["current-profile", userId] as const,
  currentPatient: (userId: string | null) =>
    ["current-patient", userId] as const,
  users: ["users"] as const,
  accessRoles: ["access-roles"] as const,
  patients: ["patients"] as const,
  patientActionLogs: ["patient-action-logs"] as const,
  patientDetail: (patientId: string | null) =>
    ["patient-detail", patientId] as const,
  patientAppointments: (patientId: string | null) =>
    ["patient-appointments", patientId] as const,
  patientBookings: (patientId: string | null) =>
    ["patient-bookings", patientId] as const,
  patientTeleconsultAppointments: (identity: string | null) =>
    ["patient-teleconsult-appointments", identity] as const,
  patientLatestInvoice: (patientId: string | null) =>
    ["patient-latest-invoice", patientId] as const,
  patientConsultations: (patientId: string | null) =>
    ["patient-consultations", patientId] as const,
  patientPrescriptions: (patientId: string | null) =>
    ["patient-prescriptions", patientId] as const,
  patientMedicalCertificates: (patientId: string | null) =>
    ["patient-medical-certificates", patientId] as const,
  appointments: ["appointments"] as const,
  bookings: ["bookings"] as const,
  myBookings: (userId: string | null) => ["my-bookings", userId] as const,
  bookingReceipt: (receiptCode: string | null) =>
    ["booking-receipt", receiptCode] as const,
  referrals: (patientId: string | null) => ["referrals", patientId] as const,
  specialistReferrals: (doctorId: string | null) =>
    ["specialist-referrals", doctorId] as const,
  chatContacts: (userId: string | null) => ["chat-contacts", userId] as const,
  chatThreads: (userId: string | null) => ["chat-threads", userId] as const,
  invoices: ["invoices"] as const,
  invoiceItems: ["invoice-items"] as const,
  posSales: ["pos-sales"] as const,
  inventory: ["inventory"] as const,
  inventoryUsageLogs: ["inventory-usage-logs"] as const,
  laboratory: ["laboratory"] as const,
  labServices: ["lab-services"] as const,
  labBookingRequests: ["lab-booking-requests"] as const,
  labQueue: (
    clinicId: string | null,
    filters: Partial<
      Record<"status" | "sampleStatus" | "resultStatus" | "urgentOnly", unknown>
    > = {},
  ) => ["lab-queue", clinicId, filters] as const,
  appointmentLabRequests: (
    appointmentId: string | null,
    filters: Partial<
      Record<"status" | "sampleStatus" | "resultStatus" | "urgentOnly", unknown>
    > = {},
  ) => ["appointment-lab-requests", appointmentId, filters] as const,
  labRequest: (requestId: string | null) => ["lab-request", requestId] as const,
  patientLabResults: (
    patientId: string | null,
    filters: Partial<
      Record<"status" | "sampleStatus" | "resultStatus" | "urgentOnly", unknown>
    > = {},
  ) => ["patient-lab-results", patientId, filters] as const,
  doctorLabRequests: (
    doctorId: string | null,
    filters: Partial<
      Record<"status" | "sampleStatus" | "resultStatus" | "urgentOnly", unknown>
    > = {},
  ) => ["doctor-lab-requests", doctorId, filters] as const,
  patientMedicalTimeline: (patientId: string | null) =>
    ["patient-medical-timeline", patientId] as const,
  dashboard: ["dashboard"] as const,
};
