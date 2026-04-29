import { CalendarCheck2, ClipboardCheck, UserPlus } from 'lucide-react';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';

const STEPS = [
  {
    icon: UserPlus,
    title: 'Create Account',
    description: 'Sign up in the portal and complete your profile with basic contact details.',
  },
  {
    icon: CalendarCheck2,
    title: 'Book Appointment',
    description: 'Choose a service, preferred date, and time slot based on clinic availability.',
  },
  {
    icon: ClipboardCheck,
    title: 'Visit or Join Online',
    description: 'Arrive at the clinic or join teleconsultation with your booking reference ready.',
  },
];

export function HowItWorksSection() {
  return (
    <section className="bg-white px-5 py-16 sm:px-8" id="how-it-works">
      <ScrollReveal className="mx-auto max-w-4xl text-center" yOffset={18}>
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">How It Works</h2>
        <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Booking in our portal is simple. Follow these three steps to schedule and complete your consultation smoothly.
        </p>
      </ScrollReveal>

      <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-3 md:gap-6">
        {STEPS.map((step, index) => (
          <ScrollReveal className="h-full" delayMs={100 + index * 70} key={step.title} yOffset={20}>
            <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <step.icon className="size-5" />
                </span>
                <span className="text-2xl font-black text-slate-200">0{index + 1}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}

