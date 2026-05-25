import { useEffect, useRef, useState } from "react";
import {
  Bell,
  LogOut,
  Menu,
  Search,
  ShieldEllipsis,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../features/auth/auth-context";
import { useClinicSettingsData } from "../../hooks/use-clinic-data";
import { appNavigation, type NavItem } from "../../config/navigation";
import { defaultClinicSettings } from "../../config/clinic";
import { isModuleEnabled } from "../../config/modules";
import { roleLabels } from "../../config/permissions";
import { Button } from "../ui/button";
import { cn, getInitials } from "../../lib/utils";

type NavigationSection =
  | "Overview"
  | "Workflows"
  | "Patients"
  | "Appointments"
  | "Referrals"
  | "Finance"
  | "HMO Management"
  | "Operations"
  | "Administration"
  | "Account";

const navigationSectionOrder: NavigationSection[] = [
  "Overview",
  "Workflows",
  "Patients",
  "Appointments",
  "Referrals",
  "Finance",
  "HMO Management",
  "Operations",
  "Administration",
  "Account",
];

function getNavigationSection(item: NavItem): NavigationSection {
  // Exact path overrides take priority
  if (item.to === "/app/doctor-availability") return "Account";
  if (item.to === "/app/patients/scan") return "Patients";
  if (item.to.startsWith("/app/settings")) return "Administration";
  if (item.to === "/app/profile") return "Account";

  // Workflow pages
  if (
    item.to === "/app/front-desk-workflow" ||
    item.to === "/app/doctor-workflow" ||
    item.to === "/app/meetings"
  ) {
    return "Workflows";
  }

  // Referrals section
  if (item.to === "/app/referrals") return "Referrals";

  // moduleKey mapping
  if (item.moduleKey === "dashboard") return "Overview";
  if (item.moduleKey === "patient_management") return "Patients";
  if (item.moduleKey === "booking_appointments") return "Appointments";
  if (item.moduleKey === "billing" || item.moduleKey === "pos") return "Finance";
  if (item.moduleKey === "hmo") return "HMO Management";
  if (item.moduleKey === "inventory" || item.moduleKey === "laboratory") return "Operations";

  return "Administration";
}

export function AppShell() {
  const {
    profile,
    can,
    pinSetupRequired,
    pinVerificationRequired,
    setSecurityPin,
    verifySecurityPin,
    signOut,
  } = useAuth();
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const location = useLocation();
  const profileRoleLabel =
    profile?.accessRoleName ??
    (profile ? roleLabels[profile.role] : "Unknown role");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [activePinField, setActivePinField] = useState<"pin" | "confirm">(
    "pin",
  );
  const [pinError, setPinError] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const isPinGateOpen = pinSetupRequired || pinVerificationRequired;

  useEffect(() => {
    if (!pinSetupRequired && !pinVerificationRequired) {
      setPin("");
      setConfirmPin("");
      setActivePinField("pin");
      setPinError("");
    }
  }, [pinSetupRequired, pinVerificationRequired]);

  useEffect(() => {
    if (isPinGateOpen) {
      pinInputRef.current?.focus();
    }
  }, [activePinField, isPinGateOpen]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const visibleNavigation = appNavigation.filter(
    (item) =>
      can(item.permission) &&
      (!item.roles || (profile ? item.roles.includes(profile.role) : false)) &&
      (!item.moduleKey ||
        isModuleEnabled(item.moduleKey, clinic.enabledModules)),
  );
  const navigationGroups = navigationSectionOrder
    .map((section) => ({
      section,
      items: visibleNavigation.filter(
        (item) => getNavigationSection(item) === section,
      ),
    }))
    .filter((group) => group.items.length > 0);

  const renderNavigationItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      className={({ isActive }) =>
        cn(
          "flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150",
          isActive
            ? "bg-[color-mix(in_srgb,var(--color-primary)_16%,white)] text-slate-900 ring-1 ring-[color-mix(in_srgb,var(--color-primary)_35%,white)]"
            : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-900",
        )
      }
      onClick={() => setMobileSidebarOpen(false)}
      to={item.to}
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
              isActive
                ? "bg-[color-mix(in_srgb,var(--color-primary)_30%,white)] text-slate-900"
                : "bg-slate-100 text-slate-600",
            )}
          >
            <item.icon className="size-4 shrink-0" />
          </span>
          <span className="min-w-0 flex-1 break-words text-[13px] leading-snug">
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );

  const pinPadKeys = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "0",
  ] as const;
  const sanitizePinInput = (value: string) =>
    value.replace(/\D/g, "").slice(0, 6);

  const handlePinDigit = (digit: string) => {
    if (pinError) setPinError("");

    if (activePinField === "pin") {
      if (pin.length >= 6) {
        return;
      }

      const nextPin = `${pin}${digit}`;
      setPin(nextPin);
      if (pinSetupRequired && nextPin.length === 6) {
        setActivePinField("confirm");
        pinInputRef.current?.focus();
      }

      if (pinVerificationRequired && nextPin.length === 6) {
        void handleSavePin({ pinValue: nextPin });
      }
      return;
    }

    if (confirmPin.length >= 6) {
      return;
    }

    const nextConfirmPin = `${confirmPin}${digit}`;
    setConfirmPin(nextConfirmPin);

    if (pinSetupRequired && pin.length === 6 && nextConfirmPin.length === 6) {
      void handleSavePin({ pinValue: pin, confirmValue: nextConfirmPin });
    }
  };

  const handlePinFieldChange = (field: "pin" | "confirm", value: string) => {
    if (pinError) setPinError("");

    const nextValue = sanitizePinInput(value);
    if (field === "pin") {
      setPin(nextValue);
      if (pinSetupRequired && nextValue.length === 6) {
        setActivePinField("confirm");
        pinInputRef.current?.focus();
      }

      if (pinVerificationRequired && nextValue.length === 6) {
        void handleSavePin({ pinValue: nextValue });
      }
      return;
    }

    setConfirmPin(nextValue);

    if (pinSetupRequired && pin.length === 6 && nextValue.length === 6) {
      void handleSavePin({ pinValue: pin, confirmValue: nextValue });
    }
  };

  const handlePinBackspace = () => {
    if (pinError) setPinError("");

    if (activePinField === "confirm") {
      if (confirmPin.length > 0) {
        setConfirmPin(confirmPin.slice(0, -1));
        return;
      }

      setActivePinField("pin");
    }

    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  async function handleSavePin(input?: {
    pinValue?: string;
    confirmValue?: string;
  }) {
    const pinValue = input?.pinValue ?? pin;
    const confirmValue = input?.confirmValue ?? confirmPin;

    if (pinVerificationRequired) {
      if (!/^\d{6}$/.test(pinValue)) {
        setPinError("PIN must be exactly 6 digits.");
        return;
      }

      try {
        setSavingPin(true);
        setPinError("");
        await verifySecurityPin(pinValue);
      } catch (error: unknown) {
        setPinError(
          error instanceof Error ? error.message : "Unable to verify your PIN.",
        );
      } finally {
        setSavingPin(false);
      }
      return;
    }

    if (!/^\d{6}$/.test(pinValue)) {
      setPinError("PIN must be exactly 6 digits.");
      return;
    }

    if (pinValue !== confirmValue) {
      setPinError("PIN entries do not match.");
      return;
    }

    try {
      setSavingPin(true);
      setPinError("");
      await setSecurityPin(pinValue);
    } catch (error: unknown) {
      setPinError(
        error instanceof Error ? error.message : "Unable to save your PIN.",
      );
    } finally {
      setSavingPin(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {mobileSidebarOpen ? (
        <button
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] shrink-0 flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out lg:hidden",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 pb-5 pt-6">
          <div className="flex flex-col items-start gap-2">
            <img
              alt={`${clinic.clinicName || clinic.legalName || "Clinic"} logo`}
              className="h-8 w-auto object-contain"
              decoding="async"
              src="/logo.png"
            />
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Operations Hub
            </p>
          </div>
          <button
            aria-label="Close navigation menu"
            className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
            onClick={() => setMobileSidebarOpen(false)}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-4 py-5">
          {navigationGroups.map((group) => (
            <div key={group.section} className="space-y-2">
              <p className="px-3 text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">
                {group.section}
              </p>
              {group.items.map((item) => renderNavigationItem(item))}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 px-4 py-4">
          <div className="flex items-center gap-3 px-1">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-xs font-extrabold text-white">
              {getInitials(profile?.fullName ?? "Guest User")}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-slate-950">
                {profile?.fullName ?? "Guest"}
              </p>
              <p className="truncate text-[11px] font-medium text-slate-400">
                {profileRoleLabel}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <aside className="sticky top-0 hidden h-screen w-80 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col items-start gap-2">
            <img
              alt={`${clinic.clinicName || clinic.legalName || "Clinic"} logo`}
              className="h-8 w-auto object-contain"
              decoding="async"
              src="/logo.png"
            />
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Operations Hub
            </p>
          </div>
        </div>

        <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-4 py-5">
          {navigationGroups.map((group) => (
            <div key={group.section} className="space-y-2">
              <p className="px-3 text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">
                {group.section}
              </p>
              {group.items.map((item) => renderNavigationItem(item))}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 px-4 py-4">
          <div className="flex items-center gap-3 px-1">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-xs font-extrabold text-white">
              {getInitials(profile?.fullName ?? "Guest User")}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-slate-950">
                {profile?.fullName ?? "Guest"}
              </p>
              <p className="truncate text-[11px] font-medium text-slate-400">
                {profileRoleLabel}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200/90 bg-white/90 px-5 py-3 shadow-[0_1px_0_rgba(15,41,71,0.06)] backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation menu"
              className="rounded-xl border border-slate-200/90 p-2 text-slate-700 transition hover:bg-slate-50 lg:hidden"
              onClick={() => setMobileSidebarOpen((isOpen) => !isOpen)}
              type="button"
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden h-11 items-center gap-2.5 rounded-xl border border-slate-200/90 bg-slate-50/90 px-4 md:flex lg:min-w-[320px]">
              <Search className="size-4 shrink-0 text-slate-400" />
              <span className="text-sm text-slate-400">
                Search patients, appointments, invoices…
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {profile?.role === "owner_admin" ? (
              <NavLink
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/90 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                title="Super Admin Console"
                to="/odc"
              >
                <ShieldEllipsis className="size-4" />
              </NavLink>
            ) : null}
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/90 text-slate-500 transition-colors hover:bg-slate-50"
              type="button"
            >
              <Bell className="size-4" />
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 px-3 text-xs font-semibold uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              onClick={() => void signOut()}
              type="button"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
            <div className="hidden h-11 items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white pl-2 pr-3 shadow-sm md:flex">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-xs font-extrabold text-white">
                {getInitials(profile?.fullName ?? "Guest User")}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold leading-none text-slate-900">
                  {profile?.fullName}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {profile?.accessRoleName ??
                    (profile ? roleLabels[profile.role] : "Guest")}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </main>
      </div>

      {isPinGateOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="relative w-full max-w-md overflow-hidden border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-6 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {pinVerificationRequired
                  ? "Security PIN Verification"
                  : "Security PIN Required"}
              </p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-slate-900">
                {pinVerificationRequired
                  ? "Enter your 6-digit PIN to continue"
                  : "Set your 6-digit PIN to continue"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {pinVerificationRequired
                  ? "Your password was accepted. Type your security PIN to unlock the system."
                  : "Your account needs a security PIN before you can continue using the system."}
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="space-y-3">
                <div
                  className={cn(
                    "grid gap-3",
                    pinSetupRequired ? "sm:grid-cols-2" : "sm:grid-cols-1",
                  )}
                >
                  <button
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition-colors",
                      activePinField === "pin"
                        ? pinVerificationRequired
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-green-400 bg-green-50/40"
                        : "border-slate-200 bg-slate-50",
                    )}
                    onClick={() => {
                      setActivePinField("pin");
                      pinInputRef.current?.focus();
                    }}
                    type="button"
                  >
                    <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                      {pinVerificationRequired ? "Security PIN" : "PIN"}
                    </p>
                    <div className="mt-3 flex gap-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <span
                          key={`pin-dot-${index}`}
                          className={cn(
                            "size-3 rounded-full border",
                            index < pin.length
                              ? pinVerificationRequired
                                ? "border-emerald-600 bg-emerald-600"
                                : "border-[var(--color-primary)] bg-[var(--color-primary)]"
                              : "border-slate-300 bg-white",
                          )}
                        />
                      ))}
                    </div>
                  </button>

                  {pinSetupRequired ? (
                    <button
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition-colors",
                        activePinField === "confirm"
                          ? "border-green-400 bg-green-50/40"
                          : "border-slate-200 bg-slate-50",
                      )}
                      onClick={() => {
                        setActivePinField("confirm");
                        pinInputRef.current?.focus();
                      }}
                      type="button"
                    >
                      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                        Confirm PIN
                      </p>
                      <div className="mt-3 flex gap-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <span
                            key={`confirm-pin-dot-${index}`}
                            className={cn(
                              "size-3 rounded-full border",
                              index < confirmPin.length
                                ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                                : "border-slate-300 bg-white",
                            )}
                          />
                        ))}
                      </div>
                    </button>
                  ) : null}
                </div>

                <input
                  ref={pinInputRef}
                  autoComplete="one-time-code"
                  aria-label="Security PIN entry"
                  className="absolute h-px w-px opacity-0 pointer-events-none"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) =>
                    handlePinFieldChange(activePinField, event.target.value)
                  }
                  type="password"
                  value={activePinField === "pin" ? pin : confirmPin}
                />

                <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                  {pinVerificationRequired
                    ? "Type your 6-digit security PIN"
                    : activePinField === "pin"
                      ? "Type your 6-digit PIN"
                      : "Re-enter your PIN to confirm"}
                </p>
              </div>

              <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 justify-items-center gap-3">
                {pinPadKeys.slice(0, 9).map((digit) => (
                  <button
                    key={digit}
                    className="flex size-16 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-extrabold text-slate-900 shadow-sm transition hover:border-green-300 hover:bg-green-50"
                    onClick={() => handlePinDigit(digit)}
                    type="button"
                  >
                    {digit}
                  </button>
                ))}
                <div className="size-16" />
                <button
                  className="flex size-16 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-extrabold text-slate-900 shadow-sm transition hover:border-green-300 hover:bg-green-50"
                  onClick={() => handlePinDigit("0")}
                  type="button"
                >
                  0
                </button>
                <button
                  className="flex size-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-extrabold uppercase tracking-widest text-slate-600 shadow-sm transition hover:border-green-300 hover:bg-green-50"
                  onClick={handlePinBackspace}
                  type="button"
                >
                  Delete
                </button>
              </div>

              {pinError ? (
                <p className="text-sm font-medium text-rose-600">{pinError}</p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => void signOut()}
                  type="button"
                  variant="secondary"
                >
                  Sign out
                </Button>
                <Button
                  className="w-full bg-[var(--color-primary)] hover:brightness-95 sm:w-auto"
                  disabled={savingPin}
                  onClick={() => void handleSavePin()}
                  type="button"
                >
                  {savingPin
                    ? pinVerificationRequired
                      ? "Verifying..."
                      : "Saving..."
                    : pinVerificationRequired
                      ? "Verify PIN"
                      : "Save PIN"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
