import {
  ArrowRight,
  ChevronDown,
  LogOut,
  Mail,
  Menu,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { portalNavigation } from "../../config/navigation";
import { FooterDotGrid } from "./footer-dot-grid";
import { defaultClinicSettings } from "../../config/clinic";
import { isModuleEnabled } from "../../config/modules";
import { useClinicSettingsData } from "../../hooks/use-clinic-data";
import { useAuth } from "../../features/auth/auth-context";
import { PortalChatbot } from "../ui/portal-chatbot";

export function PublicLayout() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { profile, isAuthenticated, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const isPortalHome =
    location.pathname === "/portal" || location.pathname === "/portal/";

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

  const visiblePortalNavigation = portalNavigation.filter(
    (item) =>
      !item.moduleKey || isModuleEnabled(item.moduleKey, clinic.enabledModules),
  );

  const telHref = clinic.contactNumber
    ? `tel:${clinic.contactNumber.replace(/\s+/g, "")}`
    : "";

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={
        isPortalHome
          ? {
            backgroundColor: '#ffffff',
          }
          : {
            backgroundColor: '#f4f5f6',
            backgroundImage:
              'repeating-linear-gradient(90deg,transparent,transparent 76px,rgba(148,163,184,0.14) 76px,rgba(148,163,184,0.14) 77px)',
          }
      }
    >
      <header
        className={
          isPortalHome
            ? "fixed inset-x-0 top-0 z-50"
            : "sticky top-0 z-50"
        }
      >
        <div
          className="pointer-events-none w-full px-3 pt-3 pb-2.5 sm:px-5 sm:pt-4 sm:pb-3 lg:px-8 lg:pt-5 lg:pb-3.5"
        >
          <div
            className={
              isPortalHome
                ? 'pointer-events-auto mx-auto flex w-full max-w-7xl items-center justify-between gap-4 rounded-[1.625rem] border border-slate-300/60 bg-[var(--color-primary)] px-5 py-3 shadow-[0_22px_52px_-26px_rgba(0,0,0,0.3)] sm:rounded-[2rem] sm:px-6 sm:py-3.5 lg:gap-8 lg:border-slate-200/80 lg:bg-white/35 lg:px-7 lg:py-3 lg:shadow-[0_26px_55px_-24px_rgba(15,50,105,0.18),inset_0_1px_0_rgba(255,255,255,0.52)] lg:backdrop-blur-xl lg:backdrop-saturate-150 xl:gap-8'
                : 'pointer-events-auto mx-auto flex w-full max-w-7xl items-center justify-between gap-4 rounded-[1.625rem] border border-slate-200/80 bg-white px-5 py-3 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.09)] sm:rounded-[2rem] sm:px-6 sm:py-3.5 lg:gap-8 lg:px-7 lg:py-3 xl:gap-8'
            }
          >
            <Link
              className="flex min-w-0 shrink-0 items-center transition-opacity hover:opacity-90"
              to="/portal"
            >
              <img
                src="/logo.png"
                alt=""
                width={248}
                height={60}
                decoding="async"
                className={
                  isPortalHome
                    ? 'h-9 w-auto max-h-9 max-w-[140px] object-contain object-left brightness-0 invert lg:brightness-100 lg:invert-0'
                    : 'h-9 w-auto max-h-9 max-w-[140px] object-contain object-left'
                }
              />
              <span className="sr-only">
                {clinic.clinicName} patient portal — home
              </span>
            </Link>

            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-5 lg:flex xl:gap-7">
              {visiblePortalNavigation.map((item, navIndex) => (
                <NavLink
                  key={`${item.to}::${item.label}::${navIndex}`}
                  className={({ isActive }) =>
                    `text-sm font-bold tracking-widest transition-all uppercase border-b-2 py-1 ${isActive
                      ? "border-[var(--color-primary)] text-slate-950"
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
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                    onClick={() => setMenuOpen((value) => !value)}
                    type="button"
                  >
                    <UserRound className="size-4 text-[var(--color-primary)]" />
                    <span className="hidden md:inline">
                      {profile?.fullName ?? profile?.email ?? "Patient"}
                    </span>
                    <ChevronDown className="size-4 text-slate-500" />
                  </button>

                  {menuOpen ? (
                    <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
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
                          {visiblePortalNavigation.map((item, navIndex) => (
                            <NavLink
                              key={`${item.to}::${item.label}::${navIndex}`}
                              className={({ isActive }) =>
                                `flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold transition ${isActive
                                  ? "bg-emerald-50 text-slate-900"
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
                          <UserRound className="size-4 text-[var(--color-primary)]" />
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
                          <LogOut className="size-4 text-[var(--color-primary)]" />
                          Log out
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <Link
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition hover:bg-slate-50"
                    to="/login"
                  >
                    Sign in
                  </Link>
                  <Link
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white shadow-sm shadow-green-900/10 transition hover:brightness-95"
                    to="/portal/register"
                  >
                    Register
                    <ArrowRight className="size-4" />
                  </Link>
                </>
              )}
            </div>

            <div className="relative flex min-w-0 items-center justify-end gap-2 lg:hidden" ref={mobileMenuRef}>
              {isPortalHome && !isAuthenticated && (
                <Link
                  className="shrink-0 whitespace-nowrap py-1 text-sm font-semibold uppercase tracking-wide text-white underline-offset-4 transition hover:underline"
                  to="/login"
                >
                  Sign in
                </Link>
              )}
              <button
                className={
                  isPortalHome
                    ? 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white shadow-none transition hover:bg-white/22'
                    : 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50'
                }
                onClick={() => setMenuOpen((value) => !value)}
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
              >
                {menuOpen ? (
                  <X
                    className={
                      isPortalHome ? 'size-5 text-white' : 'size-5 text-[var(--color-primary)]'
                    }
                  />
                ) : (
                  <Menu
                    className={
                      isPortalHome ? 'size-5 text-white' : 'size-5 text-[var(--color-primary)]'
                    }
                  />
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
                    {visiblePortalNavigation.map((item, navIndex) => (
                      <NavLink
                        key={`${item.to}::${item.label}::${navIndex}`}
                        className={({ isActive }) =>
                          `flex w-full items-center rounded-2xl px-3 py-3 text-sm font-semibold transition ${isActive
                            ? "bg-emerald-50 text-slate-900"
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
                          <UserRound className="size-4 text-[var(--color-primary)]" />
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
                          <LogOut className="size-4 text-[var(--color-primary)]" />
                          Log out
                        </button>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Link
                          className="inline-flex flex-1 items-center justify-center rounded-full border border-emerald-200/80 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition hover:bg-emerald-50/70"
                          onClick={() => setMenuOpen(false)}
                          to="/login"
                        >
                          Sign in
                        </Link>
                        <Link
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-sm shadow-green-900/10 transition hover:brightness-95"
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
        </div>
      </header>

      <main
        className={
          isPortalHome
            ? "flex-1 w-full min-w-0"
            : "flex-1 w-full mx-auto max-w-7xl px-4 py-10 lg:px-8"
        }
      >
        <Outlet />
      </main>

      <footer className="w-full min-w-0 shrink-0 border-t border-slate-200 bg-white text-slate-900">
        <div className="w-full max-w-none px-5 sm:px-8 lg:px-11 xl:px-14 2xl:px-20">
          {/* Top: brand + intro + contact */}
          <div className="py-8 sm:py-12">
            <div className="flex min-w-0 flex-col gap-5 sm:gap-7">
              <Link className="inline-flex w-fit shrink-0 items-center" to="/portal">
                <img
                  src="/logo.png"
                  alt=""
                  width={400}
                  height={97}
                  decoding="async"
                  className="h-14 w-auto max-w-[min(100%,18rem)] object-contain object-left sm:h-20 sm:max-w-none lg:h-24 xl:h-28"
                />
                <span className="sr-only">{clinic.clinicName} — home</span>
              </Link>
              <div className="grid min-w-0 gap-5 sm:gap-8 lg:grid-cols-2 lg:items-start lg:gap-x-16 xl:gap-x-24">
                <p className="max-w-2xl text-[0.9375rem] leading-[1.65] text-slate-600 sm:max-w-none sm:text-[0.9625rem] lg:max-w-[44rem]">
                  <span className="font-semibold text-slate-900">{clinic.clinicName}</span>
                  {" "}
                  {clinic.legalName && clinic.legalName !== clinic.clinicName ? `${clinic.legalName} ` : ""}
                  offers patient scheduling, consultations, and medical records through this portal, with
                  care anchored in clarity and trust.
                </p>
                {clinic.contactNumber || clinic.email ? (
                  <div className="min-w-0 lg:justify-self-end lg:text-right">
                    <div className="space-y-2 text-[0.9375rem] leading-[1.65] text-slate-600">
                      {clinic.contactNumber && telHref ? (
                        <p className="flex items-center gap-2.5 lg:justify-end">
                          <Phone aria-hidden className="size-4 shrink-0 text-slate-500" strokeWidth={2} />
                          <a className="min-w-0 hover:underline" href={telHref}>
                            {clinic.contactNumber}
                          </a>
                        </p>
                      ) : null}
                      {clinic.email ? (
                        <p className="flex items-center gap-2.5 lg:justify-end">
                          <Mail aria-hidden className="size-4 shrink-0 text-slate-500" strokeWidth={2} />
                          <a className="min-w-0 break-all hover:underline" href={`mailto:${clinic.email}`}>
                            {clinic.email}
                          </a>
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200" />

          {/* Nav row */}
          <nav
            aria-label="Footer"
            className="flex flex-col gap-3 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6 sm:gap-y-3 lg:gap-x-10"
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:gap-x-8 lg:gap-x-10">
              <NavLink
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${isActive ? "text-[var(--color-accent)]" : "text-slate-900 hover:text-[var(--color-accent)]"}`
                }
                end
                to="/portal"
              >
                Home
              </NavLink>
              {visiblePortalNavigation
                .filter((item) => item.to !== "/portal")
                .map((item, navIndex) => (
                  <NavLink
                    key={`${item.to}::foot::${navIndex}`}
                    className={({ isActive }) =>
                      `text-sm font-medium transition-colors ${isActive ? "text-[var(--color-accent)]" : "text-slate-900 hover:text-[var(--color-accent)]"}`
                    }
                    to={item.to}
                  >
                    {item.label}
                  </NavLink>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:justify-end sm:gap-x-8 lg:gap-x-10">
              <a
                className="text-sm font-medium text-slate-400 transition hover:text-slate-600"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                Terms
              </a>
              <a
                className="text-sm font-medium text-slate-400 transition hover:text-slate-600"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                Privacy
              </a>
            </div>
          </nav>

          <div className="border-t border-slate-200" />

          {/* Disclaimer + copyright */}
          <div className="space-y-5 py-6 sm:py-8">
            <p className="text-[0.8125rem] leading-relaxed text-slate-500 sm:text-[0.84375rem]">
              This site is for information and appointment management at {clinic.clinicName}. It does
              not replace professional medical advice, diagnosis, or treatment. In an emergency, contact
              local emergency services. Use of this portal is subject to clinic policies and applicable
              law. 
            </p>
            <div className="flex flex-col gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p className="text-[0.8125rem] text-slate-500">
                &copy; {new Date().getFullYear()} {clinic.clinicName}. All rights reserved.
              </p>
              <p className="text-[0.8125rem] text-slate-500">
                Powered and Designed by{" "}
                <a
                  href="https://odysseyph.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-500 hover:underline"
                >
                  OdysseyPH IT Solutions
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Dot grid */}
        <FooterDotGrid />
      </footer>

      <PortalChatbot />
    </div>
  );
}
