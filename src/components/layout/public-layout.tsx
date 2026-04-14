import { ArrowRight, ChevronDown, LogOut, Stethoscope, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { portalNavigation } from '../../config/navigation';
import { defaultClinicSettings } from '../../config/clinic';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { useAuth } from '../../features/auth/auth-context';
import { PortalChatbot } from '../ui/portal-chatbot';

export function PublicLayout() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { profile, isAuthenticated, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }

    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{
        backgroundColor: '#f9f7f4',
        backgroundImage: 'radial-gradient(circle, #d4c9be 1.5px, transparent 1.5px)',
        backgroundSize: '28px 28px',
      }}
    >
      <header className="sticky top-0 z-50 border-b-2 border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 lg:px-8">
          <Link className="flex items-center gap-3 transition-opacity hover:opacity-90" to="/portal">
            <div className="rounded-none bg-orange-600 p-3 text-white shadow-sm">
              <Stethoscope className="size-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-slate-950 uppercase">{clinic.clinicName}</p>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Patient Portal</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {portalNavigation.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  `text-sm font-bold tracking-widest transition-all uppercase border-b-2 py-1 ${
                    isActive 
                      ? 'border-orange-600 text-slate-950' 
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                  }`
                }
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="relative" ref={menuRef}>
                <button
                  className="inline-flex items-center gap-2 rounded-none border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                  onClick={() => setMenuOpen((value) => !value)}
                  type="button"
                >
                  <UserRound className="size-4 text-orange-600" />
                  <span className="hidden md:inline">{profile?.fullName ?? profile?.email ?? 'Patient'}</span>
                  <ChevronDown className="size-4 text-slate-500" />
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Patient account</p>
                      <p className="mt-1 text-sm font-bold text-slate-950">{profile?.fullName ?? 'Patient'}</p>
                      <p className="text-xs text-slate-500">{profile?.email}</p>
                    </div>
                    <div className="p-2">
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
                  className="inline-flex items-center justify-center rounded-none bg-white px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-slate-900 ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50"
                  to="/login"
                >
                  Sign in
                </Link>
                <Link
                  className="inline-flex items-center justify-center gap-2 rounded-none bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white shadow-sm shadow-orange-200/50 transition hover:opacity-95"
                  to="/portal/register"
                >
                  Register
                  <ArrowRight className="size-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t-2 border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <div className="rounded-none bg-orange-600 p-2 text-white">
              <Stethoscope className="size-4" />
            </div>
            <p className="text-sm font-extrabold uppercase tracking-widest text-slate-950">{clinic.clinicName}</p>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            &copy; {new Date().getFullYear()} {clinic.clinicName}. All rights reserved.
          </p>
        </div>
      </footer>

      <PortalChatbot />
    </div>
  );
}
