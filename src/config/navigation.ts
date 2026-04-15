import {
  ScanLine,
  ClipboardList,
  CalendarDays,
  Clock3,
  ClipboardPlus,
  FlaskConical,
  LayoutDashboard,
  Package2,
  ReceiptText,
  Settings,
  Stethoscope,
  Users,
  BriefcaseBusiness,
  Boxes,
  ShieldCheck,
  KeyRound,
  UserRound,
} from "lucide-react";

import type { Permission, Role } from "../types/domain";

export interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
  roles?: Role[];
}

export const appNavigation: NavItem[] = [
  {
    label: "Dashboard",
    to: "/app/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.view",
  },
  {
    label: "Patients",
    to: "/app/patients",
    icon: Users,
    permission: "patients.view",
  },
  {
    label: "Patient Logs",
    to: "/app/patients/logs",
    icon: ClipboardList,
    permission: "patients.view",
    roles: ["owner_admin", "nurse_staff", "front_desk_cashier"],
  },
  {
    label: "Appointments",
    to: "/app/appointments",
    icon: CalendarDays,
    permission: "appointments.view",
  },
  {
    label: "Referrals",
    to: "/app/referrals",
    icon: CalendarDays,
    permission: "appointments.view",
  },
  {
    label: "Consultations",
    to: "/app/consultations",
    icon: Stethoscope,
    permission: "consultations.manage",
  },
  {
    label: "My Availability",
    to: "/app/doctor-availability",
    icon: Clock3,
    permission: "appointments.view",
    roles: ["doctor"],
  },
  {
    label: "Specialist Referrals",
    to: "/app/specialist-referrals",
    icon: ClipboardPlus,
    permission: "patients.view",
    roles: ["doctor"],
  },
  {
    label: "Scan Patient",
    to: "/app/patients/scan",
    icon: ScanLine,
    permission: "patients.view",
    roles: ["doctor"],
  },
  {
    label: "Scan Receipt",
    to: "/app/bookings/scan",
    icon: ScanLine,
    permission: "booking.view",
    roles: ["owner_admin", "front_desk_cashier", "lab_staff", "nurse_staff"],
  },
  {
    label: "Billing",
    to: "/app/billing",
    icon: ReceiptText,
    permission: "billing.view",
  },
  {
    label: "Inventory",
    to: "/app/inventory",
    icon: Package2,
    permission: "inventory.view",
  },
  {
    label: "Laboratory",
    to: "/app/laboratory",
    icon: FlaskConical,
    permission: "laboratory.view",
  },
  {
    label: "Service Catalog",
    to: "/app/settings/catalog",
    icon: BriefcaseBusiness,
    permission: "settings.view",
  },
  {
    label: "User Management",
    to: "/app/settings/users",
    icon: ShieldCheck,
    permission: "settings.view",
  },
  {
    label: "Role Management",
    to: "/app/settings/roles",
    icon: KeyRound,
    permission: "settings.view",
  },
  {
    label: "Supplier Management",
    to: "/app/settings/support",
    icon: Boxes,
    permission: "settings.view",
  },
  {
    label: "Settings",
    to: "/app/settings/clinic",
    icon: Settings,
    permission: "settings.view",
  },
  {
    label: "My Profile",
    to: "/app/profile",
    icon: UserRound,
    permission: "dashboard.view",
    roles: ["owner_admin", "doctor", "nurse_staff", "front_desk_cashier", "lab_staff", "inventory_staff"],
  },
];

export const specialistNavigation = [
  { label: "Referral Inbox", to: "/specialist/referrals" },
  { label: "Availability", to: "/specialist/availability" },
  { label: "My Profile", to: "/specialist/profile" },
];

export const portalNavigation = [
  { label: "Portal Home", to: "/portal" },
  { label: "Book Appointment", to: "/portal/book" },
  { label: "My Bookings", to: "/portal/my-bookings" },
  { label: "My Medical History", to: "/portal/medical-history" },
  { label: "My Profile", to: "/portal/profile" },
];

export const settingsNavigation = [
  { label: "Clinic Profile", to: "/app/settings/clinic" },
  { label: "Service Catalog", to: "/app/settings/catalog" },
  { label: "User Management", to: "/app/settings/users" },
  { label: "Role Management", to: "/app/settings/roles" },
  { label: "Supplier Management", to: "/app/settings/support" },
];
