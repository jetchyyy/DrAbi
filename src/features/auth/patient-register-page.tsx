import { CalendarCheck2, ClipboardList, MoveLeft, ShieldCheck, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PatientRegisterForm } from './components/patient-register-form';

const steps = [
  {
    icon: UserPlus,
    title: 'Create Your Account',
    desc: 'Fill in your personal and medical details once — we keep everything on file.',
  },
  {
    icon: CalendarCheck2,
    title: 'Book Appointments',
    desc: 'Choose a date, time, and service. In-person or teleconsultation.',
  },
  {
    icon: ClipboardList,
    title: 'Track Everything',
    desc: 'View upcoming visits, past records, and referrals in one place.',
  },
];

export function PatientRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Left branding panel ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[38%] flex-col relative overflow-hidden bg-[#08142c]">

        {/* Animated aurora background */}
        <div
          className="absolute inset-0 animate-aurora opacity-80"
          style={{
            background:
              'linear-gradient(135deg, #08142c 0%, #10295e 25%, #1a3a6e 45%, #08142c 60%, #0c1f4a 80%, #08142c 100%)',
            backgroundSize: '400% 400%',
          }}
        />

        {/* Floating orbs */}
        <div
          className="pointer-events-none absolute animate-orb-1"
          style={{
            top: '-80px',
            right: '-60px',
            width: '380px',
            height: '380px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(96,165,250,0.22) 0%, rgba(59,130,246,0.07) 60%, transparent 80%)',
          }}
        />
        <div
          className="pointer-events-none absolute animate-orb-2"
          style={{
            bottom: '-60px',
            left: '5%',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(147,197,253,0.15) 0%, rgba(96,165,250,0.05) 65%, transparent 85%)',
          }}
        />
        <div
          className="pointer-events-none absolute animate-orb-3"
          style={{
            top: '38%',
            left: '12%',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(186,230,253,0.10) 0%, transparent 70%)',
          }}
        />

        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 39px, #fff 39px, #fff 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #fff 39px, #fff 40px)',
          }}
        />

        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#3b82f6]" />

        <div className="relative z-10 flex flex-col h-full px-12 py-12">

          {/* Back link */}
          <Link
            to="/portal"
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors w-fit animate-fade-in"
          >
            <MoveLeft className="size-3.5" />
            Back to Portal
          </Link>

          {/* Logo */}
          <div className="mt-8 animate-slide-left">
            <img src="/odc.jpg" alt="Odyssey Clinic Logo" className="h-16 w-16 object-contain" />
            <div className="mt-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#93c5fd]">
                Patient Portal
              </p>
              <h1 className="mt-1.5 text-3xl font-extrabold text-white leading-tight">
                Odyssey Diagnostic<br />Clinic
              </h1>
            </div>
          </div>

          {/* Hero */}
          <div className="mt-auto">
            <div className="inline-flex items-center gap-2 border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80 animate-fade-in delay-100">
              <ShieldCheck className="size-4 text-[#93c5fd]" />
              One account, all your records
            </div>

            <p className="mt-5 text-2xl font-semibold text-white leading-snug max-w-xs animate-slide-left delay-200">
              Get started in<br />
              <span className="text-[#93c5fd]">under two minutes.</span>
            </p>

            {/* Steps */}
            <div className="mt-8 space-y-4 animate-fade-up delay-300">
              {steps.map((s, i) => (
                <div key={s.title} className="flex items-start gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center size-8 bg-white/10 text-[#93c5fd] text-xs font-extrabold">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white uppercase tracking-wide">{s.title}</p>
                    <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-white/10 animate-fade-in delay-400">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/25">
                © {new Date().getFullYear()} Odyssey Diagnostic Clinic · All rights reserved
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12 relative">

        {/* Mobile top accent */}
        <div className="lg:hidden absolute top-0 left-0 right-0 h-1 bg-[#3b82f6]" />

        {/* Mobile header */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-3">
          <img src="/odc.jpg" alt="ODC Logo" className="h-10 w-10 object-contain" />
          <p className="text-sm font-extrabold text-slate-950 uppercase tracking-widest">Odyssey Clinic</p>
        </div>

        {/* Mobile back link */}
        <div className="lg:hidden absolute top-6 right-6">
          <Link
            to="/portal"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
          >
            <MoveLeft className="size-3.5" />
            Portal
          </Link>
        </div>

        <div className="w-full max-w-2xl animate-fade-up pt-16 lg:pt-0">
          <PatientRegisterForm />

          <div className="mt-6 pt-6 border-t border-slate-100 space-y-3 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-[#2563eb] hover:underline">
                Sign in here
              </Link>
            </p>
            <p className="text-xs text-slate-300">
              Are you clinic staff?{' '}
              <Link to="/login" className="font-semibold text-slate-400 hover:text-slate-600 hover:underline transition-colors">
                Staff sign-in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
