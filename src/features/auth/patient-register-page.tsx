import { CalendarCheck2, FileText, MoveLeft, Receipt, Shield, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { defaultClinicSettings } from '../../config/clinic';
import { PatientRegisterForm } from './components/patient-register-form';

/** Short proof points aligned with login page tone; focused on patient experience. */
const highlights = [
  { icon: CalendarCheck2, label: 'Book appointments online' },
  { icon: Shield, label: 'Your information stays private' },
  { icon: FileText, label: 'Share medical history and allergies' },
  { icon: Users, label: 'Keep emergency contacts on file' },
  { icon: Receipt, label: 'Track billing and invoices' },
];

export function PatientRegisterPage() {
  const { data: clinic } = useClinicSettingsData();
  const clinicName = clinic?.clinicName ?? defaultClinicSettings.clinicName;
  const legalName = clinic?.legalName ?? defaultClinicSettings.legalName;
  const year = new Date().getFullYear();

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Left: calm brand strip (matches staff login portal language) */}
      <div className="relative hidden overflow-hidden lg:absolute lg:inset-y-0 lg:left-0 lg:flex lg:w-1/2 xl:w-[52%] lg:flex-col lg:border-r lg:border-slate-200/70">
        <div className="absolute inset-0 bg-white" aria-hidden />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#ffffff_0%,rgba(240,251,237,0.55)_42%,rgba(236,251,246,0.75)_68%,#ffffff_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top_left,rgba(52,178,249,0.07)_0%,transparent_50%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-[-20%] left-[-14%] h-[52%] w-[72%] rounded-full opacity-[0.2]"
          style={{
            background:
              'radial-gradient(ellipse closest-side, color-mix(in srgb, var(--color-primary) 32%, transparent) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[1]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg,transparent,transparent 76px,rgba(148,163,184,0.045) 76px,rgba(148,163,184,0.045) 77px)',
          }}
        />

        <div className="h-1 w-full shrink-0 bg-[var(--color-primary)]" aria-hidden />

        <div className="relative z-[1] flex min-h-0 flex-1 flex-col px-11 py-12 xl:px-16 xl:py-14">
          <Link
            to="/portal"
            className="inline-flex w-fit items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 transition-colors hover:text-slate-800"
          >
            <MoveLeft className="size-3.5" aria-hidden />
            Back to portal
          </Link>

          <div className="mt-10">
            <img
              alt={`${clinicName} logo`}
              className="h-[3.25rem] w-auto max-w-[13rem] object-contain object-left opacity-98 sm:h-14 xl:h-[3.625rem]"
              decoding="async"
              height={90}
              src="/logo.png"
              width={248}
            />

            <p className="mt-10 text-[11px] font-semibold uppercase leading-none tracking-[0.22em] text-[var(--color-accent)] sm:tracking-[0.26em]">
              Patient portal
            </p>
            <h1 className="mt-4 font-display text-[2.125rem] font-semibold leading-[1.12] tracking-[-0.03em] text-slate-900 xl:text-[2.35rem]">
              Join {clinicName}
            </h1>
            <p className="mt-8 max-w-md text-[1.0625rem] leading-relaxed tracking-tight text-slate-600">
              Take a minute to register. Afterwards you can book visits, manage your profile, and keep your clinical
              information up to date in one secure place.
            </p>

            <ul className="mt-14 max-w-md list-none space-y-5 p-0" role="list">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.label} className="flex items-center gap-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/55 bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] text-[var(--color-primary)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <Icon className="size-[1.125rem]" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="text-[0.9375rem] font-medium tracking-tight text-slate-800">{item.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <footer className="mt-auto shrink-0 border-t border-slate-200/80 pt-10">
            <p className="text-xs font-medium tracking-tight text-slate-500">
              © {year} {legalName}. All rights reserved.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">Powered by Odyssey Solutions</p>
          </footer>
        </div>
      </div>

      {/* Right: registration form */}
      <div className="relative flex h-screen flex-col overflow-y-auto bg-white px-6 py-12 sm:py-14 lg:ml-[50%] lg:px-10 xl:ml-[52%] xl:px-12">
        <div className="absolute left-6 top-6 flex items-center gap-3 lg:hidden">
          <img alt={`${clinicName} logo`} className="h-9 w-auto object-contain" decoding="async" src="/logo.png" width={200} />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{clinicName}</span>
        </div>

        <div className="absolute right-6 top-6 lg:hidden">
          <Link
            to="/portal"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition-colors hover:text-slate-700"
          >
            <MoveLeft className="size-3.5" aria-hidden />
            Portal
          </Link>
        </div>

        <div aria-hidden className="fixed inset-x-0 top-0 z-10 h-1 shrink-0 bg-[var(--color-primary)] lg:hidden" />

        <div className="animate-fade-up mx-auto flex min-h-full w-full max-w-xl flex-col pt-14 pb-8 lg:max-w-[36rem] lg:pt-4 lg:pb-12 xl:max-w-[38rem]">
          <PatientRegisterForm />

          <div className="mt-auto space-y-3 border-t border-slate-200/80 pt-8 text-center">
            <p className="text-[13px] text-slate-500">
              Already have an account?{' '}
              <Link className="font-medium text-slate-700 underline-offset-[3px] hover:text-slate-900 hover:underline" to="/portal/login">
                Sign in
              </Link>
            </p>
            <p className="text-[11px] text-slate-400">
              Clinic staff should use{' '}
              <Link className="font-medium text-slate-500 underline-offset-[3px] transition-colors hover:text-slate-800 hover:underline" to="/login">
                Operations sign-in
              </Link>
              . Walk-in patients with a Unique ID can continue via{' '}
              <Link className="font-medium text-slate-500 underline-offset-[3px] transition-colors hover:text-slate-800 hover:underline" to="/portal/walk-in/login">
                Walk-in Login
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
