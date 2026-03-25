import { ArrowRight, Stethoscope } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { portalNavigation } from '../../config/navigation';
import { defaultClinicSettings } from '../../config/clinic';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { Button } from '../ui/button';

export function PublicLayout() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6fbff_0%,#fefcf8_100%)]">
      <header className="border-b border-white/60 bg-white/75 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 lg:px-8">
          <Link className="flex items-center gap-3" to="/portal">
            <div className="rounded-2xl bg-slate-950 p-3 text-white">
              <Stethoscope className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">{clinic.clinicName}</p>
              <p className="text-xs text-slate-500">Patient booking portal</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-4 md:flex">
            {portalNavigation.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  `text-sm ${isActive ? 'font-semibold text-slate-950' : 'text-slate-500'}`
                }
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Button className="gap-2" type="button" variant="secondary">
            Need help?
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
