import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';
import {
  PORTAL_SECTION_FULL_WIDTH,
  PORTAL_SECTION_PX,
  PortalSectionBackdrop,
  portalSectionSubtitleClassnames,
  portalSectionTitleClassnames,
} from '../portal-section-shell';

type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Can I reschedule my appointment after booking?',
    answer:
      'Yes. Open your booking from the portal dashboard and tap reschedule. Pick a new slot. We will notify you when the clinic confirms the change.',
  },
  {
    question: 'How do I cancel a booking?',
    answer:
      'Use the cancellation option on your booking details page when it is within the allowed window. Outside of that window, phone the clinic so staff can arrange the next steps.',
  },
  {
    question: 'What should I bring to my visit?',
    answer:
      'Bring a valid photo ID and your booking confirmation (on your phone is fine). Bring any medicines you take regularly, relevant results or referral letters if you already have them, and your insurer or sponsor details if billing through them.',
  },
  {
    question: 'What if I miss my appointment?',
    answer:
      'Create a fresh booking online when it suits you. If you missed for an urgent reason or need care soon, reach out to the clinic by phone; we will prioritize where we can.',
  },
  {
    question: 'How do teleconsultation appointments work?',
    answer:
      'From your booked time, open your appointment link in the portal. Use a stable connection with working camera and microphone. Join a few minutes early to test hardware and silence notifications.',
  },
  {
    question: 'How do I reach the clinic in an emergency?',
    answer:
      "For life-threatening emergencies, call emergency services immediately. For urgent but non-emergency issues, phone the clinic's main line and follow voicemail prompts. We will steer you quickly to the right service.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="relative isolate flex flex-col overflow-x-clip bg-white py-14 sm:py-16 lg:py-20 xl:py-24"
    >
      {/* wash-only: sky wash without vertical stripe “columns” */}
      <PortalSectionBackdrop variant="wash-only" />

      <div className={`relative z-[1] flex flex-1 flex-col justify-center ${PORTAL_SECTION_PX} ${PORTAL_SECTION_FULL_WIDTH}`}>
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
          <ScrollReveal className="text-center" yOffset={18}>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
              Help centre
            </p>
            <h2 className={`${portalSectionTitleClassnames('mx-auto mt-3 max-w-[26ch] sm:max-w-[36ch]')}`}>
              Frequently asked questions
            </h2>
            <p
              className={portalSectionSubtitleClassnames(
                'mx-auto text-center sm:max-w-[48rem]',
              )}
            >
             Practical answers before and after booking. Still unsure? Reach out through contact details shown in the footer for quick assistance
            </p>
          </ScrollReveal>

          <div className="mx-auto mt-12 w-full min-w-0 pb-4 sm:mt-14">
            <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 shadow-[0_26px_64px_-32px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.04] backdrop-blur-[6px]">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openIndex === index;
                const panelId = `faq-panel-${index}`;
                const isLast = index === FAQ_ITEMS.length - 1;
                return (
                  <ScrollReveal delayMs={80 + index * 28} key={item.question} yOffset={12}>
                    <div className={!isLast ? 'border-b border-slate-200/65' : ''}>
                      <button
                        id={`faq-trigger-${index}`}
                        aria-controls={panelId}
                        aria-expanded={isOpen}
                        className="group flex w-full items-start justify-between gap-5 px-5 py-5 text-left transition-colors hover:bg-slate-50/80 focus-visible:bg-slate-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 sm:px-7 sm:py-6"
                        onClick={() =>
                          setOpenIndex((current) => (current === index ? null : index))
                        }
                        type="button"
                      >
                        <span className="min-w-0 pt-0.5 font-display text-[1.0625rem] font-semibold leading-snug tracking-tight text-slate-900 sm:text-xl sm:leading-snug lg:text-[1.275rem]">
                          {item.question}
                        </span>
                        <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/75 bg-white text-[var(--color-accent)] shadow-sm transition group-hover:border-slate-300/90 group-hover:shadow-[0_10px_28px_-16px_rgba(15,23,42,0.18)]"
                      >
                          <ChevronDown aria-hidden className="size-[1.375rem]" />
                        </motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            key={panelId}
                            id={panelId}
                            role="region"
                            aria-labelledby={`faq-trigger-${index}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div className="border-t border-slate-100/90 px-5 pb-6 sm:px-7 sm:pb-8">
                              <p className="pt-5 font-sans text-[15px] leading-relaxed tracking-tight text-slate-600 sm:text-[1.0625rem] sm:leading-[1.65] lg:text-[1.125rem]">
                                {item.answer}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
