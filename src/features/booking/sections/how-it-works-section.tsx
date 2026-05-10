import { CalendarCheck2, ClipboardCheck, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';
import {
  PORTAL_SECTION_FULL_WIDTH,
  PORTAL_SECTION_PX,
  portalSectionLeadClassnames,
  portalSectionTitleClassnames,
} from '../portal-section-shell';

/** Clinic-portal steps; layout mirrors reference (timeline + icon treatment). */
const STEPS: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Reference-style “filled” first icon on primary green. */
  variant: 'accent' | 'muted';
}[] = [
  {
    icon: UserPlus,
    variant: 'accent',
    title: 'Create your account',
    description:
      'Sign up in the portal with your details and verify your contact information so we can reach you about your visit.',
  },
  {
    icon: CalendarCheck2,
    variant: 'muted',
    title: 'Book your appointment',
    description:
      'Choose a service, pick a time that fits you, and confirm your slot. Availability updates in real time.',
  },
  {
    icon: ClipboardCheck,
    variant: 'muted',
    title: 'Visit or join online',
    description:
      'Come to the clinic with your booking reference ready, or join teleconsultation from your secure appointment link.',
  },
];

function MiniServicePlaceholder() {
  return (
    <div className="rounded-md border border-sky-100/90 bg-white p-1 shadow-sm sm:rounded-lg sm:p-2">
      <div className="aspect-square rounded-sm bg-gradient-to-br from-sky-100 to-sky-200/85 sm:rounded-md" />
      <div className="mt-1 space-y-0.5 sm:mt-2 sm:space-y-1">
        <div className="h-1 w-4/5 rounded-full bg-sky-200/90 sm:h-1.5" />
        <div className="h-[3px] w-3/5 rounded-full bg-sky-100 sm:h-1" />
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative isolate flex min-h-[min(100dvh,100svh)] flex-col overflow-x-clip bg-white"
    >
      <div
        className={`flex flex-1 flex-col justify-center py-12 sm:py-14 lg:py-16 xl:py-20 ${PORTAL_SECTION_PX} ${PORTAL_SECTION_FULL_WIDTH}`}
      >
        <div className="relative z-[1] mx-auto w-full max-w-[1200px] xl:max-w-[1280px]">
          {/* ── Centered header (reference: Simple Steps + title + tagline) ── */}
          <ScrollReveal className="mx-auto max-w-3xl text-center" yOffset={18}>
            <p className="font-sans text-[11px] font-semibold uppercase leading-none tracking-[0.26em] text-[var(--color-accent)] sm:tracking-[0.24em]">
              Simple steps
            </p>
            <h2 className={portalSectionTitleClassnames('mt-4 lg:mt-5')}>How it works</h2>
            <p
              className={portalSectionLeadClassnames(
                'mx-auto mt-7 max-w-[31rem] px-2 text-center sm:mt-[1.75rem] sm:max-w-[32.5rem] sm:px-0 lg:mt-8',
              )}
            >
              Every stage from registration to your visit is spelled out so you always know what comes
              next, without guesswork.
            </p>
          </ScrollReveal>

          {/* ── 50 / 50 body: visual left, steps right ── */}
          <div className="mt-14 grid grid-cols-1 gap-14 sm:gap-16 lg:mt-[4.75rem] lg:grid-cols-2 lg:items-center lg:gap-x-16 lg:gap-y-14 xl:mt-[5.25rem] xl:gap-x-20">
            {/* Left: compact top-left photo + floating UI in lower-right negative space */}
            <ScrollReveal className="relative mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none lg:justify-self-start" yOffset={22}>
              <div className="relative isolate min-h-[min(420px,88vw)] w-full max-w-[min(420px,100%)] sm:min-h-[440px] sm:max-w-[460px] lg:min-h-[460px] lg:max-w-[500px]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-[-8%] top-[-6%] h-[70%] w-[78%] rounded-[3rem] opacity-90 sm:left-[-6%] sm:top-[-4%]"
                  style={{
                    background:
                      'radial-gradient(ellipse 68% 58% at 38% 38%, color-mix(in srgb, var(--color-primary) 44%, transparent) 0%, transparent 64%)',
                  }}
                />

                <div className="relative z-[1] w-[min(286px,calc(100%-2.5rem))] sm:w-[min(312px,calc(100%-3rem))] lg:w-[min(332px,calc(100%-2rem))]">
                  <div className="aspect-[0.92/1] overflow-hidden rounded-[1.75rem] shadow-[0_28px_60px_-28px_rgba(15,23,42,0.38)] ring-1 ring-slate-900/[0.06] sm:rounded-[2rem]">
                    <img
                      alt="Professional portrait of a smiling young male doctor wearing a white lab coat and stethoscope."
                      className="h-full w-full object-cover object-[center_15%]"
                      decoding="async"
                      src="/doctors/doctor-3.jpg"
                    />
                  </div>
                </div>

                <div className="absolute bottom-0 right-0 z-[25] w-[min(226px,calc(100%-0.5rem))] sm:bottom-1 sm:w-[min(304px,calc(100%-1rem))] lg:bottom-2">
                  <div className="isolate">
                    <div className="relative rounded-xl border border-slate-200/80 bg-white/95 p-2.5 shadow-[0_20px_44px_-22px_rgba(15,23,42,0.26)] ring-1 ring-slate-900/[0.05] backdrop-blur-sm sm:rounded-2xl sm:p-5 sm:shadow-[0_28px_56px_-24px_rgba(15,23,42,0.28)]">
                      <p className="font-sans text-[10px] font-semibold leading-tight text-slate-800 sm:text-xs">
                        Popular services
                      </p>
                      <div className="mt-2 grid grid-cols-4 gap-1 sm:mt-3 sm:gap-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <MiniServicePlaceholder key={i} />
                        ))}
                      </div>
                    </div>
                    <div className="absolute right-3 top-0 z-[100] flex max-w-[calc(100%-1rem)] -translate-y-[38%] items-center sm:right-7 sm:-translate-y-[42%] sm:max-w-[calc(100%-1.25rem)]">
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-2.5 py-1.5 font-sans text-[11px] font-semibold leading-tight text-white shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--color-primary)_78%,transparent)] ring-1 ring-black/[0.06] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm sm:shadow-[0_14px_32px_-14px_color-mix(in_srgb,var(--color-primary)_80%,transparent)]">
                        Start booking
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Right: step list */}
            <ScrollReveal className="relative min-w-0 w-full max-w-xl justify-self-start lg:max-w-none lg:justify-self-auto" yOffset={20}>
              <ul className="flex list-none flex-col gap-0 p-0" role="list">
                {STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const accent = step.variant === 'accent';
                  const isLast = index === STEPS.length - 1;
                  const spineClass = index === 0 ? 'bg-emerald-800' : 'bg-slate-200';
                  return (
                    <li
                      key={step.title}
                      className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-stretch gap-x-5 gap-y-0 sm:gap-x-6 lg:gap-x-7"
                    >
                      <div className="flex h-full min-h-0 w-14 flex-col items-center pt-1">
                        <span
                          className={
                            accent ?
                              'flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white shadow-[0_12px_28px_-12px_color-mix(in_srgb,var(--color-primary)_75%,transparent)] ring-1 ring-black/[0.05]'
                            : 'flex size-14 shrink-0 items-center justify-center rounded-2xl border border-sky-200/85 bg-white text-slate-800 shadow-sm'
                          }
                        >
                          <Icon className="size-6" strokeWidth={accent ? 2.25 : 2} />
                        </span>
                        {!isLast ? (
                          <div
                            aria-hidden
                            className={`mx-auto mt-0 min-h-[1rem] w-[3px] flex-1 basis-0 self-stretch rounded-full ${spineClass}`}
                          />
                        ) : null}
                      </div>
                      <div className="min-h-0 min-w-0 pb-0.5 pt-1 lg:pb-1">
                        <h3 className="font-display text-xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-[1.35rem]">
                          {step.title}
                        </h3>
                        <p className="mt-3 max-w-xl font-sans text-[15px] leading-relaxed tracking-tight text-slate-600 sm:text-base sm:leading-relaxed lg:leading-[1.65]">
                          {step.description}
                        </p>
                      </div>
                      {!isLast ? (
                        <div
                          aria-hidden
                          className="col-span-2 flex h-12 w-full items-start justify-start sm:h-14"
                        >
                          <div
                            className={`mb-0 ml-[calc(1.75rem-1.5px)] h-full w-[3px] shrink-0 rounded-full ${spineClass}`}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
