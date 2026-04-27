import {
  ArrowRight,
  ChevronDown,
  LogOut,
  Menu,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { portalNavigation } from "../../config/navigation";
import { defaultClinicSettings } from "../../config/clinic";
import { isModuleEnabled } from "../../config/modules";
import { useClinicSettingsData } from "../../hooks/use-clinic-data";
import { useAuth } from "../../features/auth/auth-context";
import { PortalChatbot } from "../ui/portal-chatbot";

export function PublicLayout() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { profile, isAuthenticated, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isHeroNavFloating, setIsHeroNavFloating] = useState(true);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const isPortalHome =
    location.pathname === "/portal" || location.pathname === "/portal/";
  const useFloatingHomeHeader = isPortalHome && isHeroNavFloating;

  useEffect(() => {
    const handlePointerDownOutside = (event: PointerEvent) => {
      const targetNode = event.target as Node;
      const clickedInsideDesktopMenu =
        desktopMenuRef.current?.contains(targetNode) ?? false;
      const clickedInsideMobileMenu =
        mobileMenuRef.current?.contains(targetNode) ?? false;

      if (!clickedInsideDesktopMenu && !clickedInsideMobileMenu) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      window.addEventListener("pointerdown", handlePointerDownOutside);
    }

    return () =>
      window.removeEventListener("pointerdown", handlePointerDownOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!isPortalHome) {
      setIsHeroNavFloating(false);
      return;
    }

    const syncHeaderState = () => {
      const heroSection = document.getElementById("portal-hero");
      if (!heroSection) {
        setIsHeroNavFloating(true);
        return;
      }

      const heroBottom = heroSection.getBoundingClientRect().bottom;
      setIsHeroNavFloating(heroBottom > 96);
    };

    syncHeaderState();
    window.addEventListener("scroll", syncHeaderState, { passive: true });
    window.addEventListener("resize", syncHeaderState);

    return () => {
      window.removeEventListener("scroll", syncHeaderState);
      window.removeEventListener("resize", syncHeaderState);
    };
  }, [isPortalHome]);

  const visiblePortalNavigation = portalNavigation.filter(
    (item) =>
      !item.moduleKey || isModuleEnabled(item.moduleKey, clinic.enabledModules),
  );

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{
        backgroundColor: "#f9f7f4",
        backgroundImage:
          "radial-gradient(circle, #d4c9be 1.5px, transparent 1.5px)",
        backgroundSize: "28px 28px",
      }}
    >
      <header
        className={
          isPortalHome
            ? "fixed inset-x-0 top-0 z-50"
            : "sticky top-0 z-50 border-b-2 border-slate-200 bg-white shadow-sm"
        }
      >
        <div
          className={
            useFloatingHomeHeader
              ? "mx-3 mt-3 flex max-w-7xl items-center justify-between gap-3 rounded-full border border-white/50 bg-white px-4 py-3 shadow-lg shadow-slate-900/8 sm:mx-4 sm:mt-4 sm:px-5 sm:py-4 lg:mx-auto lg:mt-6 lg:px-8"
              : isPortalHome
                ? "mx-auto flex max-w-full items-center justify-between gap-3 border-b-2 border-slate-200 bg-white px-4 py-4 shadow-sm lg:px-8 lg:py-5"
                : "mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 lg:px-8 lg:py-5"
          }
        >
          <Link
            className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-90 sm:gap-3"
            to="/portal"
          >
            <div
              className="bg-orange-600 p-2.5 text-white shadow-sm sm:p-3"
              style={{
                borderRadius: useFloatingHomeHeader ? "999px" : "0.75rem",
              }}
            >
              <Stethoscope className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-extrabold tracking-tight text-slate-950 uppercase sm:text-sm">
                {clinic.clinicName}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.18em] font-semibold sm:text-xs">
                Patient Portal
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {visiblePortalNavigation.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  `text-sm font-bold tracking-widest transition-all uppercase border-b-2 py-1 ${
                    isActive
                      ? "border-orange-600 text-slate-950"
                      : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
                  }`
                }
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {isAuthenticated ? (
              <div className="relative" ref={desktopMenuRef}>
                <button
                  className="inline-flex items-center gap-2 rounded-none border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                  onClick={() => setMenuOpen((value) => !value)}
                  type="button"
                >
                  <UserRound className="size-4 text-orange-600" />
                  <span className="hidden md:inline">
                    {profile?.fullName ?? profile?.email ?? "Patient"}
                  </span>
                  <ChevronDown className="size-4 text-slate-500" />
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                        Patient account
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-950">
                        {profile?.fullName ?? "Patient"}
                      </p>
                      <p className="text-xs text-slate-500">{profile?.email}</p>
                    </div>
                    <div className="p-2">
                      <div className="border-b border-slate-100 pb-2 md:hidden">
                        {visiblePortalNavigation.map((item) => (
                          <NavLink
                            key={item.to}
                            className={({ isActive }) =>
                              `flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold transition ${
                                isActive
                                  ? "bg-orange-50 text-orange-700"
                                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                              }`
                            }
                            onClick={() => setMenuOpen(false)}
                            to={item.to}
                          >
                            {item.label}
                          </NavLink>
                        ))}
                      </div>
                      <Link
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                        onClick={() => setMenuOpen(false)}
                        to="/portal/profile"
                      >
                        <UserRound className="size-4 text-orange-600" />
                        User profile
                      </Link>
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                        onClick={() => {
                          setMenuOpen(false);
                          void signOut();
                        }}
                        type="button"
                      >
                        <LogOut className="size-4 text-orange-600" />
                        Log out
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <Link
                  className={
                    useFloatingHomeHeader
                      ? "inline-flex items-center justify-center rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white whitespace-nowrap shadow-sm shadow-orange-200/50 transition hover:bg-orange-700"
                      : "inline-flex items-center justify-center rounded-none bg-white px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-slate-900 ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50"
                  }
                  to="/login"
                >
                  Sign in
                </Link>
                <Link
                  className={
                    useFloatingHomeHeader
                      ? "inline-flex items-center justify-center gap-2 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white whitespace-nowrap shadow-sm shadow-orange-200/50 transition hover:bg-orange-700"
                      : "inline-flex items-center justify-center gap-2 rounded-none bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white shadow-sm shadow-orange-200/50 transition hover:opacity-95"
                  }
                  to="/portal/register"
                >
                  Register
                  <ArrowRight className="size-4" />
                </Link>
              </>
            )}
          </div>

          <div className="relative lg:hidden" ref={mobileMenuRef}>
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50"
              onClick={() => setMenuOpen((value) => !value)}
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <X className="size-5 text-orange-600" />
              ) : (
                <Menu className="size-5 text-orange-600" />
              )}
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-full z-50 mt-3 w-[min(21rem,calc(100vw-2.5rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                    Patient portal
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-950">
                    {profile?.fullName ?? clinic.clinicName}
                  </p>
                  <p className="text-xs text-slate-500">
                    Navigate services and account actions
                  </p>
                </div>
                <div className="p-2">
                  {visiblePortalNavigation.map((item) => (
                    <NavLink
                      key={item.to}
                      className={({ isActive }) =>
                        `flex w-full items-center rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                          isActive
                            ? "bg-orange-50 text-orange-700"
                            : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                        }`
                      }
                      onClick={() => setMenuOpen(false)}
                      to={item.to}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
                <div className="border-t border-slate-100 p-3">
                  {isAuthenticated ? (
                    <>
                      <Link
                        className="flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                        onClick={() => setMenuOpen(false)}
                        to="/portal/profile"
                      >
                        <UserRound className="size-4 text-orange-600" />
                        User profile
                      </Link>
                      <button
                        className="mt-1 flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                        onClick={() => {
                          setMenuOpen(false);
                          void signOut();
                        }}
                        type="button"
                      >
                        <LogOut className="size-4 text-orange-600" />
                        Log out
                      </button>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <Link
                        className="inline-flex flex-1 items-center justify-center rounded-full border border-orange-200 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition hover:bg-orange-50"
                        onClick={() => setMenuOpen(false)}
                        to="/login"
                      >
                        Sign in
                      </Link>
                      <Link
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-orange-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-sm shadow-orange-200/50 transition hover:bg-orange-700"
                        onClick={() => setMenuOpen(false)}
                        to="/portal/register"
                      >
                        Register
                        <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main
        className={
          isPortalHome
            ? "flex-1"
            : "flex-1 w-full mx-auto max-w-7xl px-4 py-10 lg:px-8"
        }
      >
        <Outlet />
      </main>

      <footer className="relative overflow-hidden border-t border-orange-100 bg-orange-50 py-14">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-orange-100/50" />
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-orange-100/40" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-4 lg:px-8">
          <div className="grid gap-10 md:grid-cols-[1fr_auto_auto]">

            {/* Brand + tagline */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-orange-600 p-2.5 text-white shadow-md">
                  <Stethoscope className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-slate-950">
                    {clinic.clinicName}
                  </p>
                  {clinic.legalName && clinic.legalName !== clinic.clinicName ? (
                    <p className="text-[10px] font-medium text-slate-400">{clinic.legalName}</p>
                  ) : null}
                </div>
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-slate-400">
                Providing quality healthcare services to our community with
                compassion and excellence.
              </p>
            </div>

            {/* Contact info */}
            <div className="flex flex-col gap-2">
              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Contact</p>
              {clinic.address ? (
                <p className="text-xs text-slate-500">{clinic.address}</p>
              ) : null}
              {clinic.contactNumber ? (
                <a href={`tel:${clinic.contactNumber}`} className="text-xs font-semibold text-slate-600 transition hover:text-orange-600">
                  {clinic.contactNumber}
                </a>
              ) : null}
              {clinic.email ? (
                <a href={`mailto:${clinic.email}`} className="text-xs font-semibold text-slate-600 transition hover:text-orange-600">
                  {clinic.email}
                </a>
              ) : null}
              {clinic.website ? (
                <a href={clinic.website} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-slate-600 transition hover:text-orange-600">
                  {clinic.website.replace(/^https?:\/\//, '')}
                </a>
              ) : null}
            </div>

            {/* Nav links */}
            <div className="flex flex-col gap-2">
              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Navigation</p>
              {visiblePortalNavigation.map((item) => (
                <NavLink
                  key={item.to}
                  className={({ isActive }) =>
                    `text-xs font-bold uppercase tracking-widest transition-colors ${
                      isActive
                        ? "text-orange-600"
                        : "text-slate-500 hover:text-orange-600"
                    }`
                  }
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="mt-10 flex items-center justify-center border-t border-orange-200/60 pt-6">
            <p className="text-xs font-medium text-slate-400">
              &copy; {new Date().getFullYear()} {clinic.clinicName}. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>

      <PortalChatbot />
    </div>
  );
}
