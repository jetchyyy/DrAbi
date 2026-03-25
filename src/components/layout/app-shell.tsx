import { Bell, LogOut, Menu, Search, ShieldEllipsis } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../../features/auth/auth-context';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { appNavigation } from '../../config/navigation';
import { defaultClinicSettings } from '../../config/clinic';
import { roleLabels } from '../../config/permissions';
import { cn, getInitials } from '../../lib/utils';
import { Button } from '../ui/button';

export function AppShell() {
  const { profile, can, signOut } = useAuth();
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(21,94,239,0.12),_transparent_28%),linear-gradient(180deg,#f8fbff_0%,#f4f7fb_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1500px] gap-6 px-4 py-4 lg:px-6">
        <aside className="hidden w-72 shrink-0 rounded-[32px] bg-slate-950 p-6 text-white shadow-2xl lg:block">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Clinic OS</p>
            <h1 className="mt-3 text-2xl font-semibold">{clinic.clinicName}</h1>
            <p className="mt-2 text-sm text-slate-400">Single-clinic today, white-label ready tomorrow.</p>
          </div>

          <nav className="mt-10 space-y-2">
            {appNavigation
              .filter((item) => can(item.permission))
              .map((item) => (
                <NavLink
                  key={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white',
                      isActive && 'bg-white text-slate-950',
                    )
                  }
                  to={item.to}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </NavLink>
              ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 rounded-[28px] border border-white/60 bg-white/80 px-4 py-4 shadow-sm backdrop-blur lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button className="rounded-2xl border border-slate-200 p-2 text-slate-700 lg:hidden" type="button">
                  <Menu className="size-5" />
                </button>
                <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:flex">
                  <Search className="size-4 text-slate-400" />
                  <span className="text-sm text-slate-500">Search patient, appointment, invoice...</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {profile?.role === 'owner_admin' ? (
                  <NavLink className="rounded-2xl border border-slate-200 p-3 text-slate-500" to="/odc">
                    <ShieldEllipsis className="size-4" />
                  </NavLink>
                ) : null}
                <button className="rounded-2xl border border-slate-200 p-3 text-slate-500" type="button">
                  <Bell className="size-4" />
                </button>
                <div className="flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-2.5 text-white">
                  <div className="flex size-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                    {getInitials(profile?.fullName ?? 'Guest User')}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{profile?.fullName}</p>
                    <p className="text-xs text-slate-300">{profile ? roleLabels[profile.role] : 'Guest'}</p>
                  </div>
                </div>
                <Button className="gap-2" variant="secondary" onClick={() => void signOut()}>
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
