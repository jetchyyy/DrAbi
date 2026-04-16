import { Activity, ClipboardPlus, MoveLeft, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { LoginForm } from './components/login-form';

const benefits = [
  {
    icon: ClipboardPlus,
    title: 'Referral Inbox',
    desc: 'Review patients referred by generalists and keep case communication in one place.',
  },
  {
    icon: Activity,
    title: 'SOAP Documentation',
    desc: 'Record specialist findings, recommendations, and follow-up notes securely.',
  },
  {
    icon: ShieldCheck,
    title: 'Partner Access',
    desc: 'Use a dedicated external portal without entering the clinic’s internal operations workspace.',
  },
];

export function SpecialistLoginPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-[54%] xl:w-[58%] flex-col relative overflow-hidden bg-[#020617]">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at top right, rgba(14,165,233,0.28), transparent 28%), radial-gradient(circle at bottom left, rgba(56,189,248,0.14), transparent 26%), linear-gradient(180deg, #020617 0%, #0f172a 100%)',
          }}
        />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 44px, #fff 44px, #fff 45px)' }} />
        <div className="relative z-10 flex h-full flex-col px-14 py-12">
          <Link
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-sky-200/70 transition-colors hover:text-sky-100"
            to="/portal"
          >
            <MoveLeft className="size-3.5" />
            Back to main portal
          </Link>

          <div className="mt-10">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.35em] text-sky-300">External Specialist Access</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight text-white">
              Specialist care
              <br />
              workspace
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
              This portal is for partner specialists outside the clinic. Accept referrals, review patient history, manage your availability, and send SOAP-based findings back to the referring team.
            </p>
          </div>

          <div className="mt-auto space-y-5">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex items-start gap-4">
                <div className="rounded-sm bg-sky-500/15 p-2.5 text-sky-200">
                  <benefit.icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-white">{benefit.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="text-xs font-extrabold uppercase tracking-widest text-sky-600">Specialist Portal</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Sign in</h2>
          <p className="mt-2 text-sm text-slate-500">
            Use your specialist account to access referrals, availability, patient charts, and SOAP documentation.
          </p>

          <div className="mt-8">
            <LoginForm defaultRedirectTo="/specialist/profile" />
          </div>
        </div>
      </div>
    </div>
  );
}
