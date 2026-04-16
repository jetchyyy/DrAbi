import { CalendarDays, FileText, LogOut, Stethoscope, UserRound, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { specialistNavigation } from '../../config/navigation';
import { isModuleEnabled } from '../../config/modules';
import { useAuth } from '../../features/auth/auth-context';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { defaultClinicSettings } from '../../config/clinic';
import { roleLabels } from '../../config/permissions';
import { getInitials } from '../../lib/utils';

const navigationIcons: Record<string, LucideIcon> = {
  '/specialist/referrals': FileText,
  '/specialist/availability': CalendarDays,
  '/specialist/profile': UserRound,
};

export function SpecialistShell() {
  const { profile, signOut } = useAuth();
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const profileRoleLabel = profile?.accessRoleName ?? (profile ? roleLabels[profile.role] : 'Specialist');
  const visibleSpecialistNavigation = specialistNavigation.filter(
    (item) => !item.moduleKey || isModuleEnabled(item.moduleKey, clinic.enabledModules),
  );

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <aside className="hidden h-screen w-72 shrink-0 border-r border-sky-900/60 bg-slate-950 lg:flex lg:flex-col">
        <div className="border-b border-sky-900/60 px-6 py-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-sky-300">Specialist Portal</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="rounded-sm bg-sky-500/15 p-3 text-sky-200">
              <Stethoscope className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{clinic.clinicName}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">External care partner</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {visibleSpecialistNavigation.map((item) => {
            const Icon = navigationIcons[item.to];
            return (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-sm px-4 py-3 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-sky-500/15 text-sky-100'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white',
                  ].join(' ')
                }
                to={item.to}
              >
                <Icon className="size-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-sky-900/60 px-4 py-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/20 text-sm font-extrabold text-sky-100">
              {getInitials(profile?.fullName ?? 'Specialist User')}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{profile?.fullName ?? 'Specialist'}</p>
              <p className="truncate text-xs text-slate-400">{profileRoleLabel}</p>
            </div>
          </div>
          <button
            className="mt-3 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
            onClick={() => void signOut()}
            type="button"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]">
        <header className="border-b border-sky-900/40 bg-slate-950/70 px-6 py-5 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-sky-300">Specialist Workspace</p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white">Referral care outside the clinic network</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Review referred patients, document specialist SOAP notes, and publish your availability without accessing the clinic’s internal operations portal.
              </p>
            </div>
            <div className="hidden rounded-sm border border-sky-500/20 bg-sky-500/10 px-4 py-3 md:block">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-sky-200">Signed in as</p>
              <p className="mt-1 text-sm font-bold text-white">{profile?.fullName ?? 'Specialist'}</p>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
