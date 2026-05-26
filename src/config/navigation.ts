import {
  Activity,
  ScanLine,
  ClipboardList,
  CalendarDays,
  Clock3,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Package2,
  ReceiptText,
  FileText,
  Settings,
  Stethoscope,
  Users,
  BriefcaseBusiness,
  Boxes,
  ShieldCheck,
  KeyRound,
  UserRound,
  ShoppingCart,
  Building2,
  Wallet,
  Receipt,
  Ticket,
  Video,
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
  // ── Overview ──────────────────────────────────────────────
  {
    label: "Dashboard",
    to: "/app/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.view",
    moduleKey: "dashboard",
  },
  // ── Workflows ─────────────────────────────────────────────
  {
    label: "Doctor Workflow",
    to: "/app/doctor-workflow",
    icon: Stethoscope,
    permission: "consultations.manage",
    roles: ["owner_admin", "doctor"],
    moduleKey: "booking_appointments",
  },
  {
    label: "Front Desk Workflow",
    to: "/app/front-desk-workflow",
    icon: Activity,
    permission: "appointments.view",
    roles: ["owner_admin", "front_desk_cashier"],
    moduleKey: "booking_appointments",
  },
  {
    label: "Meetings",
    to: "/app/meetings",
    icon: Video,
    permission: "consultations.manage",
    roles: ["owner_admin", "doctor"],
    moduleKey: "teleconsult",
  },

  // ── Patients ──────────────────────────────────────────────
  {
    label: "Patients",
    to: "/app/patients",
    icon: Users,
    permission: "patients.view",
    moduleKey: "patient_management",
  },
  // ── Appointments ──────────────────────────────────────────
  {
    label: "Appointments",
    to: "/app/appointments",
    icon: CalendarDays,
    permission: "appointments.view",
    moduleKey: "booking_appointments",
  },
  {
    label: "Bookings Queue",
    to: "/app/patient-bookings",
    icon: ClipboardList,
    permission: "appointments.view",
    moduleKey: "booking_appointments",
  },
  {
    label: "Queue Management",
    to: "/app/appointments-queue",
    icon: CalendarDays,
    permission: "appointments.view",
    moduleKey: "booking_appointments",
  },
  {
    label: "Scan Receipt",
    to: "/app/bookings/scan",
    icon: ScanLine,
    permission: "booking.view",
    roles: ["owner_admin", "front_desk_cashier", "lab_staff", "nurse_staff"],
    moduleKey: "booking_appointments",
  },

  // ── Referrals ─────────────────────────────────────────────
  {
    label: "Referrals",
    to: "/app/referrals",
    icon: GitBranch,
    permission: "appointments.view",
    moduleKey: "booking_appointments",
  },

  // ── Finance ───────────────────────────────────────────────
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
    label: "Doctor Payouts",
    to: "/app/doctor-payouts",
    icon: Wallet,
    permission: "appointments.view",
    roles: ["owner_admin", "doctor", "specialist"],
    moduleKey: "billing",
  },

  // ── HMO Management ────────────────────────────────────────
  {
    label: "HMO Dashboard",
    to: "/app/hmo",
    icon: ShieldCheck,
    permission: "hmo.view",
    moduleKey: "hmo",
  },
  {
    label: "Patient HMO Accounts",
    to: "/app/hmo/accounts",
    icon: ClipboardList,
    permission: "hmo.view",
    moduleKey: "hmo",
  },
  {
    label: "Authorizations",
    to: "/app/hmo/authorizations",
    icon: FileText,
    permission: "hmo.view",
    moduleKey: "hmo",
  },
  {
    label: "Claims",
    to: "/app/hmo/claims",
    icon: Receipt,
    permission: "hmo.manage",
    roles: ["owner_admin", "front_desk_cashier"],
    moduleKey: "hmo",
  },
  {
    label: "HMO Providers",
    to: "/app/hmo/providers",
    icon: Building2,
    permission: "hmo.manage",
    roles: ["owner_admin"],
    moduleKey: "hmo",
  },

  // ── Operations ────────────────────────────────────────────
  {
    label: "Laboratory",
    to: "/app/laboratory",
    icon: FlaskConical,
    permission: "laboratory.view",
    moduleKey: "laboratory",
  },
  {
    label: "Inventory",
    to: "/app/inventory",
    icon: Package2,
    permission: "inventory.view",
    moduleKey: "inventory",
  },

  // ── Administration ────────────────────────────────────────
  {
    label: "Service Catalog",
    to: "/app/settings/catalog",
    icon: BriefcaseBusiness,
    permission: "settings.view",
  },
  {
    label: "Inventory Catalog",
    to: "/app/settings/inventory-catalog",
    icon: Package2,
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
    label: "Promo Codes",
    to: "/app/settings/promo-codes",
    icon: Ticket,
    permission: "settings.view",
  },
  {
    label: "Documents",
    to: "/app/settings/documents",
    icon: FileText,
    permission: "settings.view",
    roles: ["owner_admin"],
  },
  {
    label: "Settings",
    to: "/app/settings/clinic",
    icon: Settings,
    permission: "settings.view",
  },

  // ── Account ───────────────────────────────────────────────
  {
    label: "My Availability",
    to: "/app/doctor-availability",
    icon: Clock3,
    permission: "appointments.view",
    roles: ["doctor"],
    moduleKey: "booking_appointments",
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
  { label: "Inventory Catalog", to: "/app/settings/inventory-catalog" },
  { label: "User Management", to: "/app/settings/users" },
  { label: "Role Management", to: "/app/settings/roles" },
  { label: "Supplier Management", to: "/app/settings/support" },
  { label: "Promo Codes", to: "/app/settings/promo-codes" },
];
