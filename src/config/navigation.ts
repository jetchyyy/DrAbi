import {
  CalendarDays,
  FlaskConical,
  LayoutDashboard,
  Package2,
  ReceiptText,
  Settings,
  Stethoscope,
  Users,
} from 'lucide-react';

import type { Permission } from '../types/domain';

export interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
}

export const appNavigation: NavItem[] = [
  { label: 'Dashboard', to: '/app/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { label: 'Patients', to: '/app/patients', icon: Users, permission: 'patients.view' },
  { label: 'Appointments', to: '/app/appointments', icon: CalendarDays, permission: 'appointments.view' },
  { label: 'Consultations', to: '/app/consultations', icon: Stethoscope, permission: 'consultations.manage' },
  { label: 'Billing', to: '/app/billing', icon: ReceiptText, permission: 'billing.view' },
  { label: 'Inventory', to: '/app/inventory', icon: Package2, permission: 'inventory.view' },
  { label: 'Laboratory', to: '/app/laboratory', icon: FlaskConical, permission: 'laboratory.view' },
  { label: 'Settings', to: '/app/settings/clinic', icon: Settings, permission: 'settings.view' },
];

export const portalNavigation = [
  { label: 'Portal Home', to: '/portal' },
  { label: 'Book Appointment', to: '/portal/book' },
  { label: 'My Bookings', to: '/portal/my-bookings' },
];

export const settingsNavigation = [
  { label: 'Clinic Profile', to: '/app/settings/clinic' },
  { label: 'Services & Specialties', to: '/app/settings/catalog' },
  { label: 'Users & Roles', to: '/app/settings/users' },
  { label: 'Suppliers & Preferences', to: '/app/settings/support' },
];

