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
  ShoppingCart,
} from "lucide-react";

import type { ModuleKey, Permission, Role } from "../types/domain";

export interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
  roles?: Role[];
  moduleKey?: ModuleKey;
}

export interface SimpleNavItem {
  label: string;
  to: string;
  moduleKey?: ModuleKey;
}

export const appNavigation: NavItem[] = [
  {
    label: "Dashboard",
    to: "/app/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.view",
    moduleKey: "dashboard",
  },
  {
    label: "Patients",
    to: "/app/patients",
    icon: Users,
    permission: "patients.view",
    moduleKey: "patient_management",
  },
  {
    label: "Patient Logs",
    to: "/app/patients/logs",
    icon: ClipboardList,
    permission: "patients.view",
    roles: ["owner_admin", "nurse_staff", "front_desk_cashier"],
    moduleKey: "patient_management",
  },
  {
    label: "Appointments",
    to: "/app/appointments",
    icon: CalendarDays,
    permission: "appointments.view",
    moduleKey: "booking_appointments",
  },
  {
    label: "Patient Bookings List",
    to: "/app/patient-bookings",
    icon: CalendarDays,
    permission: "appointments.view",
  },
  {
    label: "Specialist Bookings List",
    to: "/app/specialist-list",
    icon: CalendarDays,
    permission: "appointments.view",
  },
  {
    label: "Referrals",
    to: "/app/referrals",
    icon: CalendarDays,
    permission: "appointments.view",
    moduleKey: "booking_appointments",
  },
  {
    label: "Consultations",
    to: "/app/consultations",
    icon: Stethoscope,
    permission: "consultations.manage",
    moduleKey: "booking_appointments",
  },
  {
    label: "My Availability",
    to: "/app/doctor-availability",
    icon: Clock3,
    permission: "appointments.view",
    roles: ["doctor"],
    moduleKey: "booking_appointments",
  },
  {
    label: "Specialist Referrals",
    to: "/app/specialist-referrals",
    icon: ClipboardPlus,
    permission: "patients.view",
    roles: ["doctor"],
    moduleKey: "patient_management",
  },
  {
    label: "Scan Patient",
    to: "/app/patients/scan",
    icon: ScanLine,
    permission: "patients.view",
    roles: ["doctor"],
    moduleKey: "patient_management",
  },
  {
    label: "Scan Receipt",
    to: "/app/bookings/scan",
    icon: ScanLine,
    permission: "booking.view",
    roles: ["owner_admin", "front_desk_cashier", "lab_staff", "nurse_staff"],
    moduleKey: "booking_appointments",
  },
  {
    label: "Billing",
    to: "/app/billing",
    icon: ReceiptText,
    permission: "billing.view",
    moduleKey: "billing",
  },
  {
    label: "POS",
    to: "/app/pos",
    icon: ShoppingCart,
    permission: "pos.view",
    roles: ["owner_admin", "front_desk_cashier"],
    moduleKey: "pos",
  },
  {
    label: "Inventory",
    to: "/app/inventory",
    icon: Package2,
    permission: "inventory.view",
    moduleKey: "inventory",
  },
  {
    label: "Inventory Logs",
    to: "/app/inventory-logs",
    icon: ClipboardList,
    permission: "inventory.view",
    moduleKey: "inventory",
  },
  {
    label: "Laboratory",
    to: "/app/laboratory",
    icon: FlaskConical,
    permission: "laboratory.view",
    moduleKey: "laboratory",
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
    roles: [
      "owner_admin",
      "doctor",
      "nurse_staff",
      "front_desk_cashier",
      "lab_staff",
      "inventory_staff",
    ],
  },
];

export const specialistNavigation: SimpleNavItem[] = [
  {
    label: "Referral Inbox",
    to: "/specialist/referrals",
    moduleKey: "patient_management",
  },
  {
    label: "Availability",
    to: "/specialist/availability",
    moduleKey: "booking_appointments",
  },
  { label: "My Profile", to: "/specialist/profile" },
];

export const portalNavigation: SimpleNavItem[] = [
  { label: "Portal Home", to: "/portal" },
  {
    label: "My Bookings",
    to: "/portal/my-bookings",
    moduleKey: "booking_appointments",
  },
  {
    label: "My Bookings",
    to: "/portal/my-bookings",
    moduleKey: "booking_appointments",
  },
  {
    label: "My Consultations",
    to: "/portal/consultations",
    moduleKey: "teleconsult",
  },
  {
    label: "My Medical History",
    to: "/portal/medical-history",
    moduleKey: "booking_appointments",
  },
  { label: "My Profile", to: "/portal/profile" },
];

export const settingsNavigation = [
  { label: "Clinic Profile", to: "/app/settings/clinic" },
  { label: "Service Catalog", to: "/app/settings/catalog" },
  { label: "User Management", to: "/app/settings/users" },
  { label: "Role Management", to: "/app/settings/roles" },
  { label: "Supplier Management", to: "/app/settings/support" },
];
