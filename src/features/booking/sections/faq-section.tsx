import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';

const FAQ_ITEMS = [
  {
    question: 'Can I reschedule my appointment after booking?',
    answer:
      'Yes. Open your booking in the portal and request a reschedule. The clinic team will confirm the updated slot.',
  },
  {
    question: 'What if I miss my appointment schedule?',
    answer:
      'You can create a new booking from the portal. For urgent concerns, contact the clinic directly for immediate assistance.',
  },
  {
    question: 'Do I need to print anything before visiting?',
    answer:
      'No printing is required. Bring your booking details on your phone and present your reference at check-in.',
  },
  {
    question: 'How do teleconsultation appointments work?',
    answer:
      'For teleconsultation, join from your scheduled booking page. Make sure your camera, mic, and internet are ready beforehand.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number>(0);

  return (
    <section className="bg-slate-50 px-5 py-16 sm:px-8" id="faq">
      <ScrollReveal className="mx-auto max-w-4xl text-center" yOffset={18}>
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Frequently Asked Questions</h2>
        <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Here are quick answers to the most common questions patients ask before and after booking.
        </p>
      </ScrollReveal>

      <div className="mx-auto mt-10 max-w-4xl space-y-3">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          const panelId = `faq-panel-${index}`;
          return (
            <ScrollReveal delayMs={110 + index * 50} key={item.question} yOffset={16}>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  aria-controls={panelId}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  onClick={() => setOpenIndex((current) => (current === index ? -1 : index))}
                  type="button"
                >
                  <span className="text-sm font-semibold text-slate-900 sm:text-base">{item.question}</span>
                  <ChevronDown className={`size-5 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen ? (
                  <div className="border-t border-slate-100 px-5 py-4" id={panelId}>
                    <p className="text-sm leading-relaxed text-slate-600">{item.answer}</p>
                  </div>
                ) : null}
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}

