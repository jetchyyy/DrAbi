import type { ClinicSettings } from '../types/domain';
import { defaultEnabledModules } from './modules';

export const clinicTheme = {
  primary: 'var(--color-primary)',
  accent: 'var(--color-accent)',
  surface: 'var(--color-surface)',
  canvas: 'var(--color-canvas)',
};

export const defaultClinicSettings: ClinicSettings = {
  id: 'clinic_default',
  createdAt: '2026-03-01T08:00:00.000Z',
  updatedAt: '2026-03-01T08:00:00.000Z',
  clinicName: 'Odyssey Family Clinic',
  legalName: 'Odyssey Family Clinic OPC',
  shortCode: 'ODYSSEY',
  address: '125 Rizal Avenue, Makati City, Metro Manila',
  contactNumber: '+63 917 555 0134',
  email: 'hello@odysseyclinic.test',
  website: 'https://odysseyclinic.test',
  logoUrl: '',
  primaryColor: '#155eef',
  accentColor: '#0f766e',
  bookingLeadDays: 30,
  bookingCancellationHours: 12,
  appointmentSlotMinutes: 30,
  systemEnabled: true,
  systemMessage: 'Contact your System Administrator to continue using the System',
  enabledModules: defaultEnabledModules,
  operatingHours: [
    { day: 'Monday', open: '08:00', close: '18:00', enabled: true },
    { day: 'Tuesday', open: '08:00', close: '18:00', enabled: true },
    { day: 'Wednesday', open: '08:00', close: '18:00', enabled: true },
    { day: 'Thursday', open: '08:00', close: '18:00', enabled: true },
    { day: 'Friday', open: '08:00', close: '18:00', enabled: true },
    { day: 'Saturday', open: '08:00', close: '13:00', enabled: true },
    { day: 'Sunday', open: '00:00', close: '00:00', enabled: false },
  ],
};
