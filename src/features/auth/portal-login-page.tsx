import { CalendarCheck2, ClipboardList, MoveLeft, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PortalLoginForm } from './components/portal-login-form';

const benefits = [
  {
    icon: CalendarCheck2,
    title: 'Book Appointments',
    desc: 'Schedule in-person or teleconsultation visits at your convenience.',
  },
  {
    icon: ClipboardList,
    title: 'Track Your Bookings',
    desc: 'View upcoming and past appointments — all in one place.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Private',
    desc: 'Your medical and personal information is always protected.',
  },
];

export function PortalLoginPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Left branding panel ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] flex-col relative overflow-hidden bg-[#08142c]">

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
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(96,165,250,0.25) 0%, rgba(59,130,246,0.08) 60%, transparent 80%)',
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
            background: 'radial-gradient(circle, rgba(147,197,253,0.18) 0%, rgba(96,165,250,0.06) 65%, transparent 85%)',
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
            background: 'radial-gradient(circle, rgba(186,230,253,0.12) 0%, transparent 70%)',
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

        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#3b82f6]" />

        <div className="relative z-10 flex flex-col h-full px-14 py-12">

          {/* Back to portal link */}
          <Link
            to="/portal"
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors w-fit animate-fade-in"
          >
            <MoveLeft className="size-3.5" />
            Back to Portal
          </Link>

          {/* Logo + name */}
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

          {/* Hero text */}
          <div className="mt-auto">
            <div
              className="mb-6 inline-flex items-center gap-2 border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80 animate-fade-in delay-100"
            >
              <ShieldCheck className="size-4 text-[#93c5fd]" />
              Patient account required to book
            </div>

            <p className="text-2xl font-semibold text-white leading-snug max-w-md animate-slide-left delay-200">
              Your health, your schedule —<br />
              <span className="text-[#93c5fd]">always at your fingertips.</span>
            </p>

            {/* Benefit list */}
            <div className="mt-8 space-y-4 animate-fade-up delay-300">
              {benefits.map((b) => (
                <div key={b.title} className="flex items-start gap-4">
                  <div className="p-2 bg-white/10 text-[#93c5fd] shrink-0 mt-0.5">
                    <b.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white uppercase tracking-wide">{b.title}</p>
                    <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{b.desc}</p>
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

        {/* Mobile logo */}
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

        <div className="w-full max-w-sm animate-fade-up">

          {/* Panel heading */}
          <div className="mb-8">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#2563eb]">Patient Portal</p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-950 tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Sign in to manage your appointments and bookings.
            </p>
          </div>

          <PortalLoginForm />

          <div className="mt-8 pt-6 border-t border-slate-100 space-y-3 text-center">
            <p className="text-xs text-slate-400">
              Don&apos;t have an account?{' '}
              <Link to="/portal/register" className="font-bold text-[#2563eb] hover:underline">
                Create one here
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
