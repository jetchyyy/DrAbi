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
  clinicName: 'CPR Med',
  legalName: 'CPR Med Clinic',
  shortCode: 'CPRMED',
  address:
    'CPR Medical Clinic & Laboratory Bulacao, Cebu City',
  contactNumber: '+639623093577',
  email: 'hello@cprmed.test',
  website: 'https://cprmed.test',
  logoUrl: '',
  primaryColor: '#7dd453',
  accentColor: '#34b2f9',
  bookingLeadDays: 30,
  bookingCancellationHours: 12,
  appointmentSlotMinutes: 30,
  systemEnabled: true,
  systemMessage: 'Contact your System Administrator to continue using the System',
  enabledModules: defaultEnabledModules,
  operatingHours: [
    { day: 'Monday', open: '10:00', close: '22:00', enabled: true },
    { day: 'Tuesday', open: '10:00', close: '22:00', enabled: true },
    { day: 'Wednesday', open: '10:00', close: '22:00', enabled: true },
    { day: 'Thursday', open: '10:00', close: '22:00', enabled: true },
    { day: 'Friday', open: '10:00', close: '22:00', enabled: true },
    { day: 'Saturday', open: '10:00', close: '22:00', enabled: true },
    { day: 'Sunday', open: '00:00', close: '00:00', enabled: false },
  ],
};
