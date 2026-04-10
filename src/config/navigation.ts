import {
  ScanLine,
  CalendarDays,
  Clock3,
  FlaskConical,
  LayoutDashboard,
  Package2,
  ReceiptText,
  Settings,
  Stethoscope,
  Users,
} from 'lucide-react';

import type { Permission, Role } from '../types/domain';

export interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
  roles?: Role[];
}

export const appNavigation: NavItem[] = [
  { label: 'Dashboard', to: '/app/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { label: 'Patients', to: '/app/patients', icon: Users, permission: 'patients.view' },
  { label: 'Appointments', to: '/app/appointments', icon: CalendarDays, permission: 'appointments.view' },
  { label: 'Consultations', to: '/app/consultations', icon: Stethoscope, permission: 'consultations.manage' },
  { label: 'My Availability', to: '/app/doctor-availability', icon: Clock3, permission: 'appointments.view', roles: ['doctor'] },
  { label: 'Scan Patient', to: '/app/patients/scan', icon: ScanLine, permission: 'patients.view', roles: ['doctor'] },
  { label: 'Scan Receipt', to: '/app/bookings/scan', icon: ScanLine, permission: 'booking.view', roles: ['owner_admin', 'front_desk_cashier', 'lab_staff', 'nurse_staff'] },
  { label: 'Billing', to: '/app/billing', icon: ReceiptText, permission: 'billing.view' },
  { label: 'Inventory', to: '/app/inventory', icon: Package2, permission: 'inventory.view' },
  { label: 'Laboratory', to: '/app/laboratory', icon: FlaskConical, permission: 'laboratory.view' },
  { label: 'Settings', to: '/app/settings/clinic', icon: Settings, permission: 'settings.view' },
];

export const portalNavigation = [
  { label: 'Portal Home', to: '/portal' },
  { label: 'Book Appointment', to: '/portal/book' },
  { label: 'My Bookings', to: '/portal/my-bookings' },
  { label: 'My Profile', to: '/portal/profile' },
];

export const settingsNavigation = [
  { label: 'Clinic Profile', to: '/app/settings/clinic' },
  { label: 'Services & Specialties', to: '/app/settings/catalog' },
  { label: 'Users & Roles', to: '/app/settings/users' },
  { label: 'Suppliers & Preferences', to: '/app/settings/support' },
];
