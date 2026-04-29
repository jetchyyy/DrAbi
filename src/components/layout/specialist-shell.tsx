import { useEffect, useState } from 'react';
import { CalendarDays, FileText, LogOut, Menu, Stethoscope, UserRound, X, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { specialistNavigation } from '../../config/navigation';
import { isModuleEnabled } from '../../config/modules';
import { useAuth } from '../../features/auth/auth-context';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { defaultClinicSettings } from '../../config/clinic';
import { roleLabels } from '../../config/permissions';
import { cn, getInitials } from '../../lib/utils';

const navigationIcons: Record<string, LucideIcon> = {
  '/specialist/referrals': FileText,
  '/specialist/availability': CalendarDays,
  '/specialist/profile': UserRound,
};

export function SpecialistShell() {
  const { profile, signOut } = useAuth();
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const location = useLocation();
  const profileRoleLabel = profile?.accessRoleName ?? (profile ? roleLabels[profile.role] : 'Specialist');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const visibleSpecialistNavigation = specialistNavigation.filter(
    (item) => !item.moduleKey || isModuleEnabled(item.moduleKey, clinic.enabledModules),
  );

  const navigationItems = visibleSpecialistNavigation.map((item) => {
    const Icon = navigationIcons[item.to] || Stethoscope;
    return (
      <NavLink
        key={item.to}
        className={({ isActive }) =>
          cn(
            'flex w-full min-w-0 items-center gap-3 overflow-hidden px-3 py-2.5 text-sm font-semibold transition-all duration-150',
            isActive
              ? 'bg-orange-50 text-orange-700 border-l-[3px] border-orange-600 font-extrabold'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-[3px] border-transparent',
          )
        }
        onClick={() => setMobileSidebarOpen(false)}
        to={item.to}
      >
        <Icon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </NavLink>
    );
  });

  return (
    <div className="flex min-h-screen bg-slate-100">

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
          'fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] shrink-0 flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out lg:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="shrink-0 bg-orange-600 p-2 text-white">
              <Stethoscope className="size-4" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-orange-600">{clinic.shortCode || 'Clinic OS'}</p>
              <h1 className="text-sm font-extrabold leading-tight text-slate-950">{clinic.clinicName}</h1>
            </div>
          </div>
          <button
            aria-label="Close navigation menu"
            className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            onClick={() => setMobileSidebarOpen(false)}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-2 pt-4">
          <p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Specialist Portal</p>
          {navigationItems}
        </nav>

        <div className="space-y-2 border-t border-slate-100 px-4 py-4">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-orange-600 text-xs font-extrabold text-white">
              {getInitials(profile?.fullName ?? 'Specialist User')}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-slate-950">{profile?.fullName ?? 'Specialist'}</p>
              <p className="truncate text-[11px] font-medium text-slate-400">{profileRoleLabel}</p>
            </div>
          </div>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
            onClick={() => void signOut()}
            type="button"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── White Sidebar ────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-white border-r border-slate-200 lg:flex overflow-hidden">

        {/* Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600 text-white shrink-0">
              <Stethoscope className="size-4" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-orange-600">{clinic.shortCode || 'Clinic OS'}</p>
              <h1 className="text-sm font-extrabold leading-tight text-slate-950">{clinic.clinicName}</h1>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-4 pb-2 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-3 pb-2">Specialist Portal</p>
          {navigationItems}
        </nav>

        {/* User profile footer */}
        <div className="border-t border-slate-100 px-4 py-4 space-y-2">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-8 w-8 items-center justify-center bg-orange-600 text-white text-xs font-extrabold shrink-0">
              {getInitials(profile?.fullName ?? 'Specialist User')}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-950 truncate leading-tight">{profile?.fullName ?? 'Specialist'}</p>
              <p className="text-[11px] text-slate-400 font-medium truncate">{profileRoleLabel}</p>
            </div>
          </div>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-6 py-3.5 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation menu"
              className="border border-slate-200 p-2 text-slate-700 lg:hidden"
              onClick={() => setMobileSidebarOpen((isOpen) => !isOpen)}
              type="button"
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden items-center md:flex">
              <p className="text-sm font-bold text-slate-900">Specialist Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2.5 border border-slate-200 bg-white px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center bg-orange-600 text-white text-xs font-extrabold shrink-0">
                {getInitials(profile?.fullName ?? 'Specialist User')}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 leading-none">{profile?.fullName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{profile?.accessRoleName ?? (profile ? roleLabels[profile.role] : 'Specialist')}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 w-full max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

