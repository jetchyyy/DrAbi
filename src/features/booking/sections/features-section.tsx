import { CalendarCheck2, ClipboardList, FlaskConical, PhoneCall, ShieldCheck } from 'lucide-react';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';

const FEATURES = [
  {
    icon: CalendarCheck2,
    label: 'Online Medical Consultation',
  },
  {
    icon: ShieldCheck,
    label: 'Verified Specialists',
  },
  {
    icon: FlaskConical,
    label: 'Laboratory Requests',
  },
  {
    icon: ClipboardList,
    label: 'Medical Summary',
  },
  {
    icon: PhoneCall,
    label: 'Staff Support',
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-white px-5 py-16 sm:px-8 sm:py-25" aria-labelledby="portal-features-heading">
      <ScrollReveal className="mx-auto max-w-4xl text-center" yOffset={18}>
        <div>
          <h2 id="portal-features-heading" className="text-4xl font-extrabold tracking-tight text-slate-900">
            Our Services
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-xl">
            We&apos;re committed to providing exceptional healthcare with a patient-first approach.
          </p>
        </div>
      </ScrollReveal>

      <div className="mx-auto mt-12 grid max-w-6xl grid-cols-2 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
        {FEATURES.map((feature, i) => (
          <ScrollReveal key={feature.label} delayMs={110 + i * 70} yOffset={20}>
            <div className="group flex flex-col items-center px-3 text-center">
              <div className="relative mb-4">
                <span className="absolute -left-4 top-6 h-4 w-4 rounded-full bg-emerald-300/80" />
                <span className="absolute -right-5 -top-2 h-4 w-4 rounded-full bg-sky-300/90" />
                <span className="absolute right-2 top-9 h-4 w-4 rounded-full bg-slate-200/90" />
                <feature.icon className="relative z-10 size-10 text-slate-700 transition-colors group-hover:text-slate-900" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-2xl">{feature.label}</h3>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
