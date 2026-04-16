import type { EnabledModules, ModuleKey } from "../types/domain";

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  description: string;
}

export const moduleDefinitions: ModuleDefinition[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Overview metrics and operational snapshots for clinic staff.",
  },
  {
    key: "patient_management",
    label: "Patient Management",
    description: "Patient charts, logs, referrals, and core clinical record workflows.",
  },
  {
    key: "booking_appointments",
    label: "Booking & Appointments",
    description: "Patient booking, appointment scheduling, receipt scanning, and visit coordination.",
  },
  {
    key: "billing",
    label: "Billing",
    description: "Invoices, payment collection, and billing operations.",
  },
  {
    key: "pos",
    label: "POS",
    description: "Point-of-sale checkout for medicines and inventory-based counter sales.",
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Stock tracking, item management, and supply monitoring.",
  },
  {
    key: "laboratory",
    label: "Laboratory",
    description: "Laboratory workflows, requests, results, and receipt scanning.",
  },
  {
    key: "teleconsult",
    label: "Teleconsult",
    description: "Online teleconsult room access for doctors and patients.",
  },
];

export const defaultEnabledModules: EnabledModules = {
  dashboard: true,
  patient_management: true,
  booking_appointments: true,
  billing: true,
  pos: true,
  inventory: true,
  laboratory: true,
  teleconsult: true,
};

export const moduleDefinitionMap: Record<ModuleKey, ModuleDefinition> = moduleDefinitions.reduce(
  (acc, moduleDefinition) => {
    acc[moduleDefinition.key] = moduleDefinition;
    return acc;
  },
  {} as Record<ModuleKey, ModuleDefinition>,
);

export function normalizeEnabledModules(value: unknown): EnabledModules {
  const raw = value && typeof value === "object"
    ? (value as Partial<Record<ModuleKey, unknown>>)
    : {};

  return {
    dashboard: raw.dashboard === false ? false : true,
    patient_management: raw.patient_management === false ? false : true,
    booking_appointments: raw.booking_appointments === false ? false : true,
    billing: raw.billing === false ? false : true,
    pos: raw.pos === false ? false : true,
    inventory: raw.inventory === false ? false : true,
    laboratory: raw.laboratory === false ? false : true,
    teleconsult: raw.teleconsult === false ? false : true,
  };
}

export function isModuleEnabled(moduleKey: ModuleKey, enabledModules: EnabledModules | null | undefined) {
  return normalizeEnabledModules(enabledModules)[moduleKey];
}
