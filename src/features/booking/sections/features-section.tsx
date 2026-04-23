import { CalendarCheck2, PhoneCall, ShieldCheck } from 'lucide-react';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';

const FEATURES = [
  {
    icon: CalendarCheck2,
    tone: 'orange',
    label: 'Easy Scheduling',
    desc: 'Pick a date and time that works for you directly from the portal.',
    proof: 'Average booking time under 2 minutes',
    grad: 'from-orange-400 to-orange-600',
    cardGrad: 'from-orange-500 to-orange-600',
    ring: 'ring-orange-200/70',
    accent: 'bg-orange-500',
    soft: 'from-orange-50 to-orange-100/70',
  },
  {
    icon: ShieldCheck,
    tone: 'sky',
    label: 'Verified Specialists',
    desc: 'All our doctors are licensed professionals in their fields.',
    proof: 'Credential checks built into onboarding',
    grad: 'from-sky-400 to-sky-600',
    cardGrad: 'from-sky-500 to-sky-700',
    ring: 'ring-sky-200/70',
    accent: 'bg-sky-500',
    soft: 'from-sky-50 to-sky-100/70',
  },
  {
    icon: PhoneCall,
    tone: 'emerald',
    label: 'Staff Support',
    desc: 'Our front desk is ready to assist with any booking concerns.',
    proof: 'Fast replies during clinic operating hours',
    grad: 'from-emerald-400 to-emerald-600',
    cardGrad: 'from-emerald-500 to-emerald-700',
    ring: 'ring-emerald-200/70',
    accent: 'bg-emerald-500',
    soft: 'from-emerald-50 to-emerald-100/70',
  },
];

export function FeaturesSection() {
  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-white px-5 py-12 shadow-sm ring-1 ring-orange-100 sm:px-8 sm:py-16"
      style={{ borderRadius: '1.5rem' }}
      aria-labelledby="portal-features-heading"
    >
      {/* Decorative atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-orange-100/50 blur-xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-orange-50 blur-xl" />
        <div
          className="absolute left-1/2 top-1/2 h-[300px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(251,146,60,0.06) 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 35px, rgba(15,23,42,0.12) 35px, rgba(15,23,42,0.12) 36px), repeating-linear-gradient(90deg, transparent, transparent 35px, rgba(15,23,42,0.12) 35px, rgba(15,23,42,0.12) 36px)',
          }}
        />
      </div>

      <ScrollReveal className="relative z-10 mb-10 grid gap-6 border-b border-orange-100/80 pb-8 lg:mb-12 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-10 lg:pb-10" yOffset={18}>
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-1.5 shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600">Portal Advantages</span>
          </div>
          <h2 id="portal-features-heading" className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Designed for Faster,
            <span className="block text-orange-500">Calmer Clinic Visits</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            The portal removes avoidable steps from scheduling, verification, and support so patients can focus on care.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-3 sm:gap-4">
          <ScrollReveal delayMs={70} yOffset={12}>
            <div className="rounded-2xl border-t-2 border-orange-300 bg-white px-3 py-3 text-center shadow-sm ring-1 ring-orange-100 sm:px-4">
              <p className="text-lg font-black text-slate-950 sm:text-xl">3</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">Core Benefits</p>
            </div>
          </ScrollReveal>
          <ScrollReveal delayMs={130} yOffset={12}>
            <div className="rounded-2xl border-t-2 border-sky-300 bg-white px-3 py-3 text-center shadow-sm ring-1 ring-orange-100 sm:px-4">
              <p className="text-lg font-black text-slate-950 sm:text-xl">24/7</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">Booking Access</p>
            </div>
          </ScrollReveal>
          <ScrollReveal delayMs={190} yOffset={12}>
            <div className="rounded-2xl border-t-2 border-emerald-300 bg-white px-3 py-3 text-center shadow-sm ring-1 ring-orange-100 sm:px-4">
              <p className="text-lg font-black text-slate-950 sm:text-xl">100%</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">Licensed Team</p>
            </div>
          </ScrollReveal>
        </div>
      </ScrollReveal>

      <div className="relative z-10 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
        {FEATURES.map((feature, i) => (
          <ScrollReveal key={feature.label} delayMs={120 + i * 80} yOffset={22}>
            <div
              className={`group relative flex min-h-[252px] flex-col items-center overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-center text-white shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl sm:p-7 ${feature.cardGrad}`}
              style={{ borderRadius: '1.5rem' }}
            >
              <div className="absolute -bottom-10 -right-10 h-36 w-36 rounded-full bg-white/10" />
              <div className="absolute -left-7 -top-7 h-24 w-24 rounded-full bg-white/10" />
              <div className="absolute left-1/3 top-1/3 h-16 w-16 rounded-full bg-white/10" />
              <div className="absolute right-4 top-4 text-6xl font-black leading-none text-white/20">0{i + 1}</div>

              <div className="relative z-10 mb-5 flex items-center justify-center">
                <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-white/30 ${feature.grad}`}>
                  <feature.icon className="size-7" aria-hidden="true" />
                </div>
              </div>

              <div className="relative z-10 flex flex-col items-center gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Benefit</span>
                <h3 className="text-base font-black uppercase tracking-wide text-white">{feature.label}</h3>
              </div>

              <p className="relative z-10 mt-2 text-sm leading-relaxed text-white/90">{feature.desc}</p>
              <p className="relative z-10 mt-2 text-xs font-semibold text-white/75">{feature.proof}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
