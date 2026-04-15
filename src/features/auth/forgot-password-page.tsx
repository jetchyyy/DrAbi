import { ArrowLeft, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PasswordResetForm } from './components/password-reset-form';

export function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex">

      {/* ── Left branding panel (same as login) ─────────────── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col bg-[#172937] relative overflow-hidden">
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
            width: '380px',
            height: '380px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(249,115,22,0.25) 0%, rgba(234,88,12,0.08) 60%, transparent 80%)',
          }}
        />
        <div
          className="pointer-events-none absolute animate-orb-2"
          style={{
            bottom: '-50px',
            left: '10%',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,146,60,0.18) 0%, rgba(249,115,22,0.06) 65%, transparent 85%)',
          }}
        />
        <div
          className="pointer-events-none absolute animate-orb-3"
          style={{
            top: '35%',
            left: '12%',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(253,186,116,0.12) 0%, transparent 70%)',
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
        {/* Orange top strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-600" />

        <div className="relative z-10 flex flex-col h-full px-12 py-12">
          {/* Logo */}
          <div className="animate-slide-left">
            <img src="/odc.jpg" alt="Odyssey Clinic Logo" className="h-16 w-16 object-contain" />
            <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.3em] text-orange-400">Clinic OS Access</p>
            <h1 className="mt-1.5 text-2xl font-extrabold text-white leading-tight tracking-tight">
              Odyssey Clinic<br />Operations System
            </h1>
          </div>

          {/* Illustration block */}
          <div className="mt-auto animate-fade-up delay-200">
            <div className="p-5 bg-white/5 border border-white/10 inline-block mb-6">
              <Mail className="size-10 text-orange-500" />
            </div>
            <p className="text-base font-semibold text-white leading-relaxed max-w-xs">
              We'll send a secure reset link to your registered email address.
            </p>
            <p className="mt-3 text-xs text-slate-400 leading-relaxed max-w-xs">
              If you don't receive the email within a few minutes, check your spam folder or contact your system administrator.
            </p>

            <div className="mt-12 pt-8 border-t border-white/10">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                © {new Date().getFullYear()} Odyssey Diagnostic Clinic
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12 relative">
        {/* Orange top accent mobile */}
        <div className="lg:hidden absolute top-0 left-0 right-0 h-1 bg-orange-600" />

        {/* Mobile logo */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-3">
          <img src="/odc.jpg" alt="ODC Logo" className="h-9 w-9 object-contain" />
          <p className="text-sm font-extrabold text-slate-950 uppercase tracking-widest">Odyssey Clinic</p>
        </div>

        <div className="w-full max-w-sm animate-fade-up">
          {/* Back link */}
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-500 hover:text-slate-800 mb-8 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to Sign In
          </Link>

          {/* Heading */}
          <div className="mb-8">
            <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Account Recovery</p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-950 tracking-tight">Reset password</h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Enter your account email and we'll send you a link to reset your password.
            </p>
          </div>

          <PasswordResetForm />
        </div>
      </div>
    </div>
  );
}
