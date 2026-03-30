import { ArrowRight, Stethoscope } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { portalNavigation } from '../../config/navigation';
import { defaultClinicSettings } from '../../config/clinic';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { Button } from '../ui/button';

export function PublicLayout() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
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

          <Button className="gap-2 rounded-none font-semibold uppercase tracking-wide" type="button" variant="secondary">
            Need help?
            <ArrowRight className="size-4" />
          </Button>
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
    </div>
  );
}
