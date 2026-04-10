import { Bell, LogOut, Menu, Search, ShieldEllipsis, Stethoscope } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../../features/auth/auth-context';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { appNavigation } from '../../config/navigation';
import { defaultClinicSettings } from '../../config/clinic';
import { roleLabels } from '../../config/permissions';
import { cn, getInitials } from '../../lib/utils';

export function AppShell() {
  const { profile, can, signOut } = useAuth();
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();

  return (
    <div className="flex min-h-screen bg-slate-100">

      {/* ── White Sidebar ────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-white border-r border-slate-200 lg:flex overflow-hidden">

        {/* Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600 text-white shrink-0">
              <Stethoscope className="size-4" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-orange-600">Clinic OS</p>
              <h1 className="text-sm font-extrabold leading-tight text-slate-950">{clinic.clinicName}</h1>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-4 pb-2 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-3 pb-2">Main Menu</p>
          {appNavigation
            .filter((item) => can(item.permission) && (!item.roles || (profile ? item.roles.includes(profile.role) : false)))
            .map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-all duration-150',
                    isActive
                      ? 'bg-orange-50 text-orange-700 border-l-[3px] border-orange-600 font-extrabold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-[3px] border-transparent',
                  )
                }
                to={item.to}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
        </nav>

        {/* User profile footer */}
        <div className="border-t border-slate-100 px-4 py-4 space-y-2">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-8 w-8 items-center justify-center bg-orange-600 text-white text-xs font-extrabold shrink-0">
              {getInitials(profile?.fullName ?? 'Guest User')}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-950 truncate leading-tight">{profile?.fullName ?? 'Guest'}</p>
              <p className="text-[11px] text-slate-400 font-medium truncate">{profile ? roleLabels[profile.role] : 'Unknown role'}</p>
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
            <button className="border border-slate-200 p-2 text-slate-700 lg:hidden" type="button">
              <Menu className="size-5" />
            </button>
            <div className="hidden items-center gap-2.5 border border-slate-200 bg-slate-50 px-4 py-2 md:flex">
              <Search className="size-4 text-slate-400" />
              <span className="text-sm text-slate-400">Search patients, appointments, invoices…</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {profile?.role === 'owner_admin' ? (
              <NavLink
                className="border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                title="Super Admin Console"
                to="/odc"
              >
                <ShieldEllipsis className="size-4" />
              </NavLink>
            ) : null}
            <button className="border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 transition-colors" type="button">
              <Bell className="size-4" />
            </button>
            <div className="hidden md:flex items-center gap-2.5 border border-slate-200 bg-white px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center bg-orange-600 text-white text-xs font-extrabold shrink-0">
                {getInitials(profile?.fullName ?? 'Guest User')}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 leading-none">{profile?.fullName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{profile ? roleLabels[profile.role] : 'Guest'}</p>
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
