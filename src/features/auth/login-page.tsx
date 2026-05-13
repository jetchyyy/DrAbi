import { CalendarCheck2, FileText, Receipt, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { defaultClinicSettings } from '../../config/clinic';
import { LoginForm } from './components/login-form';

/** Two calm proof points aligned with CPR Med portal; no long marketing copy on the panel. */
const highlights = [
  { icon: CalendarCheck2, label: 'Smart scheduling' },
  { icon: Users, label: 'Unified patient records' },
  { icon: Receipt, label: 'Billing and invoice tracking' },
  { icon: FileText, label: 'Clinical notes documentation' },
  { icon: ShieldCheck, label: 'Secure role-based access' },
];

export function LoginPage() {
  const { data: clinic } = useClinicSettingsData();
  const clinicName = clinic?.clinicName ?? defaultClinicSettings.clinicName;
  const legalName = clinic?.legalName ?? defaultClinicSettings.legalName;
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen">
      {/* Left: light brand calm — matches portal whites + soft wash */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 xl:w-[52%] lg:flex-col lg:border-r lg:border-slate-200/70">
        <div className="absolute inset-0 bg-white" aria-hidden />

        {/* Soft medical wash (portal-adjacent) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#ffffff_0%,rgba(240,251,237,0.55)_42%,rgba(236,251,246,0.75)_68%,#ffffff_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top_left,rgba(52,178,249,0.07)_0%,transparent_50%)]"
        />
        {/* Very soft primary halo */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-[-20%] left-[-14%] h-[52%] w-[72%] rounded-full opacity-[0.2]"
          style={{
            background:
              'radial-gradient(ellipse closest-side, color-mix(in srgb, var(--color-primary) 32%, transparent) 0%, transparent 70%)',
          }}
        />

        {/* Low-contrast grid (mirror portal column rhythm, subdued) */}
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
          <div>
            <img
              alt={`${clinicName} logo`}
              className="h-[3.25rem] w-auto max-w-[13rem] object-contain object-left opacity-98 sm:h-14 xl:h-[3.625rem]"
              decoding="async"
              height={90}
              src="/logo.png"
              width={248}
            />

            <p className="mt-10 text-[11px] font-semibold uppercase leading-none tracking-[0.22em] text-[var(--color-accent)] sm:tracking-[0.26em]">
              Clinical operations
            </p>
            <h1 className="mt-4 font-display text-[2.125rem] font-semibold leading-[1.12] tracking-[-0.03em] text-slate-900 xl:text-[2.35rem]">
              CPR Med Operations System
            </h1>
            <p className="mt-8 max-w-md text-[1.0625rem] leading-relaxed tracking-tight text-slate-600">
              Manage bookings, patient records, billing, and clinic workflows in one secure workspace.
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

      {/* Right: Sign-in focus */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-white px-6 py-12 sm:py-14 lg:px-10 xl:px-12">
        <div className="absolute left-6 top-6 flex items-center gap-3 lg:hidden">
          <img alt={`${clinicName} logo`} className="h-9 w-auto object-contain" decoding="async" src="/logo.png" width={200} />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{clinicName}</span>
        </div>
        <div className="absolute right-6 top-6">
          <Link
            className="text-xs font-semibold uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-700"
            to="/portal"
          >
            Back to portal
          </Link>
        </div>
        <div aria-hidden className="fixed inset-x-0 top-0 z-10 h-1 shrink-0 bg-[var(--color-primary)] lg:hidden" />

        <div className="animate-fade-up w-full max-w-[22rem] pt-14 lg:pt-0 lg:max-w-[24rem]">
          <header className="mb-10">
            <h2 className="mt-4 font-display text-[1.875rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[2rem]">
              Sign in
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-500">Access your clinic workspace securely.</p>
          </header>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}


