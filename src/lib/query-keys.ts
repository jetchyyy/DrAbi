export const queryKeys = {
  clinicSettings: ['clinic-settings'] as const,
  services: ['services'] as const,
  doctors: ['doctors'] as const,
  currentProfile: (userId: string | null) => ['current-profile', userId] as const,
  currentPatient: (userId: string | null) => ['current-patient', userId] as const,
  users: ['users'] as const,
  patients: ['patients'] as const,
  appointments: ['appointments'] as const,
  bookings: ['bookings'] as const,
  myBookings: (userId: string | null) => ['my-bookings', userId] as const,
  referrals: (patientId: string | null) => ['referrals', patientId] as const,
  invoices: ['invoices'] as const,
  inventory: ['inventory'] as const,
  laboratory: ['laboratory'] as const,
  dashboard: ['dashboard'] as const,
};

