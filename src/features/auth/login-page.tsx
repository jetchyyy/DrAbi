import { CalendarCheck2, Shield, Users } from 'lucide-react';

import { LoginForm } from './components/login-form';

const features = [
  {
    icon: CalendarCheck2,
    title: 'Smart Scheduling',
    desc: 'Portal & internal appointment booking with teleconsultation support.',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    desc: 'Granular permissions for doctors, front desk, lab, and admin staff.',
  },
  {
    icon: Users,
    title: 'Unified Patient Records',
    desc: 'Medical history, billing, and lab results all in one place.',
  },
];

export function LoginPage() {
  return (
    <div className="min-h-screen flex">

      {/* ── Left branding panel ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] flex-col bg-[#172937] relative overflow-hidden">

        {/* Animated aurora background */}
        <div
          className="absolute inset-0 animate-aurora opacity-70"
          style={{
            background:
              'linear-gradient(135deg, #172937 0%, #1f3a52 25%, #2d5a7b 45%, #172937 60%, #1a2f45 80%, #172937 100%)',
            backgroundSize: '400% 400%',
          }}
        />

        {/* Floating orbs */}
        <div
          className="pointer-events-none absolute animate-orb-1"
          style={{
            top: '-80px',
            right: '-60px',
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(249,115,22,0.25) 0%, rgba(234,88,12,0.08) 60%, transparent 80%)',
          }}
        />
        <div
          className="pointer-events-none absolute animate-orb-2"
          style={{
            bottom: '-60px',
            left: '8%',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,146,60,0.18) 0%, rgba(249,115,22,0.06) 65%, transparent 85%)',
          }}
        />
        <div
          className="pointer-events-none absolute animate-orb-3"
          style={{
            top: '40%',
            left: '15%',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(253,186,116,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 39px, #fff 39px, #fff 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #fff 39px, #fff 40px)',
          }}
        />

        {/* Orange accent strip at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-600" />

        <div className="relative z-10 flex flex-col h-full px-14 py-12">

          {/* Logo + clinic badge */}
          <div className="animate-slide-left">
            <img
              src="/odc.jpg"
              alt="Odyssey Clinic Logo"
              className="h-20 w-20 object-contain"
            />
            <div className="mt-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-orange-400">Clinic Management Platform</p>
              <h1 className="mt-1.5 text-3xl font-extrabold text-white leading-tight tracking-tight">
                Odyssey Clinic<br />Operations System
              </h1>
            </div>
          </div>

          {/* Hero text */}
          <div className="mt-auto">
            <div className="mb-6 inline-flex items-center gap-2 border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80 animate-fade-in delay-100">
              <Shield className="size-4 text-orange-400" />
              Secure staff access portal
            </div>

            <p className="text-lg font-semibold text-white leading-relaxed max-w-md animate-slide-left delay-200">
              Staff workflows, patient booking, and billing operations — built for single-clinic today, white-label ready tomorrow.
            </p>

            {/* Feature list */}
            <div className="mt-10 space-y-5 animate-fade-up delay-300">
              {features.map((f) => (
                <div key={f.title} className="flex items-start gap-4">
                  <div className="p-2 bg-orange-600 text-white shrink-0 mt-0.5">
                    <f.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white uppercase tracking-wide">{f.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer badge */}
            <div className="mt-12 pt-8 border-t border-white/10 animate-fade-in delay-400">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                © {new Date().getFullYear()} Odyssey Diagnostic Clinic · All rights reserved
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right login form panel ───────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12 relative">

        {/* Mobile-only logo */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-3">
          <img src="/odc.jpg" alt="ODC Logo" className="h-10 w-10 object-contain" />
          <p className="text-sm font-extrabold text-slate-950 uppercase tracking-widest">Odyssey Clinic</p>
        </div>

        {/* Orange top accent on mobile */}
        <div className="lg:hidden absolute top-0 left-0 right-0 h-1 bg-orange-600" />

        <div className="w-full max-w-sm animate-fade-up">
          {/* Panel heading */}
          <div className="mb-8">
            <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Clinic OS Access</p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-950 tracking-tight">Sign in</h2>
            <p className="mt-2 text-sm text-slate-500">
              Enter your credentials to access the clinic management system.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
