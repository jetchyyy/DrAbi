import { ArrowRight, Star } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';
import { defaultClinicSettings } from '../../../config/clinic';
import { isModuleEnabled } from '../../../config/modules';
import { useBookableServices, useClinicSettingsData } from '../../../hooks/use-clinic-data';
import { cn, formatCurrency } from '../../../lib/utils';
import { useAuth } from '../../auth/auth-context';
import {
  PORTAL_SECTION_FULL_WIDTH,
  PORTAL_SECTION_PX,
  portalSectionLeadClassnames,
  portalSectionTitleClassnames,
} from '../portal-section-shell';

function ServicePricingRow({
  name,
  description,
  priceLabel,
  isLast,
}: {
  name: string;
  description: string;
  priceLabel: string;
  isLast?: boolean;
}) {
  return (
    <div>
      <div className="flex min-w-0 items-end gap-x-3 sm:gap-x-4">
        <span className="min-w-0 max-w-[min(100%,22rem)] font-display text-lg font-semibold leading-snug tracking-tight text-slate-900 sm:max-w-[min(100%,38rem)] sm:text-xl lg:max-w-none lg:max-w-[62%] lg:text-[1.3125rem]">
          {name}
        </span>
        <span
          aria-hidden
          className="mb-[0.42em] h-px min-w-[1rem] flex-1 border-b border-dotted border-slate-300/95"
        />
        <span className="shrink-0 whitespace-nowrap font-sans text-[15px] font-medium tabular-nums tracking-tight text-slate-800 sm:text-base">
          {priceLabel}
        </span>
      </div>
      <p
        className={
          isLast ?
            'mt-2.5 max-w-xl font-sans text-[13px] font-normal leading-relaxed tracking-tight text-slate-500 sm:mt-3 sm:max-w-[36rem] sm:text-sm sm:leading-[1.6] lg:max-w-[38rem] lg:text-[0.9325rem] lg:leading-[1.62]'
          : 'mt-2.5 mb-7 max-w-xl font-sans text-[13px] font-normal leading-relaxed tracking-tight text-slate-500 sm:mt-3 sm:mb-8 sm:max-w-[36rem] sm:text-sm sm:leading-[1.6] lg:max-w-[38rem] lg:text-[0.9325rem] lg:leading-[1.62]'
        }
      >
        {description}
      </p>
    </div>
  );
}

const primaryCtaClass =
  'group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-green-900/10 ring-1 ring-black/[0.04] transition hover:brightness-[0.97] active:brightness-95';

/** Fractal noise tile for frost / glass grain (feTurbulence). */
const TESTIMONIAL_GLASS_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const SERVICES_IMAGE_TESTIMONIALS = [
  {
    quote:
      'We booked online without the usual phone tag. Check-in moved quickly, billing matched what they quoted upfront, and the consult didn’t feel rushed.',
    authorName: 'Ana Reyes',
  },
  {
    quote:
      'My lab results came back the same afternoon. Reception texted when the doctor was ready—no wandering the hallway wondering what’s next.',
    authorName: 'Marcus Tolentino',
  },
  {
    quote:
      'Straight answers on what the visit would cost before I committed. Rare in clinics. I’ll use the portal again for follow-up.',
    authorName: 'Lara Villanueva',
  },
] as const;

const TESTIMONIAL_AUTO_MS = 7000;

function FiveStarRating({ className }: { className?: string }) {
  return (
    <div className={cn('flex shrink-0 items-center gap-0.5', className)} aria-label="Rated 5 out of 5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star aria-hidden className="size-[1.05rem] fill-amber-400 text-amber-400 sm:size-[1.125rem]" key={String(i)} strokeWidth={0} />
      ))}
    </div>
  );
}

function ServicesAreaTestimonialsSlider() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (paused || reduceMotion) return undefined;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SERVICES_IMAGE_TESTIMONIALS.length);
    }, TESTIMONIAL_AUTO_MS);
    return () => window.clearInterval(id);
  }, [paused, reduceMotion]);

  const goTo = useCallback((index: number) => {
    setActive(index);
  }, []);

  return (
    <div
      className="relative z-[1]"
      onBlurCapture={(event) => {
        const next = event.relatedTarget as Node | null;
        if (!next || !event.currentTarget.contains(next)) {
          setPaused(false);
        }
      }}
      onFocusCapture={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div aria-live={reduceMotion ? 'polite' : 'off'} className="relative min-h-0" role="group">
        {SERVICES_IMAGE_TESTIMONIALS.map((item, index) => {
          const headingId = `services-testimonial-author-${index}`;
          const isCurrent = index === active;

          return (
            <div
              aria-hidden={!isCurrent}
              aria-roledescription="slide"
              className={cn(
                'transition-opacity duration-500 ease-out motion-reduce:transition-none',
                isCurrent ?
                  'relative z-[2] opacity-100'
                : 'pointer-events-none absolute inset-x-0 top-0 z-0 opacity-0 motion-reduce:duration-75',
              )}
              key={index}
            >
              <div className="flex items-center justify-between gap-3">
                <p
                  className="min-w-0 flex-1 font-sans text-[15px] font-bold leading-tight tracking-tight text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)] sm:text-[0.975rem]"
                  id={isCurrent ? headingId : undefined}
                >
                  {item.authorName}
                </p>
                <FiveStarRating />
              </div>
              <blockquote
                aria-labelledby={isCurrent ? headingId : undefined}
                className="mt-5 border-0 p-0 sm:mt-6"
              >
                <p className="font-sans text-[14px] font-normal leading-[1.58] tracking-[-0.01em] text-white/[0.9] drop-shadow-[0_1px_12px_rgba(0,0,0,0.35)] sm:text-[15px] sm:leading-[1.55]">
                  {item.quote}
                </p>
              </blockquote>
            </div>
          );
        })}
      </div>

      <div aria-label="Choose testimonial" className="mt-5 flex items-center justify-center gap-2 sm:mt-6" role="tablist">
        {SERVICES_IMAGE_TESTIMONIALS.map((_, index) => (
          <button
            aria-label={`Show testimonial ${index + 1} of ${SERVICES_IMAGE_TESTIMONIALS.length}`}
            aria-selected={index === active}
            role="tab"
            className={cn(
              'h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              index === active ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/55',
            )}
            key={`dot-${index}`}
            tabIndex={index === active ? 0 : -1}
            type="button"
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Clinic services: full-width (hero-style horizontal pad) pricing list + hero image column.
 */
export function ServicesSection() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { data: services = [] } = useBookableServices();
  const { isAuthenticated } = useAuth();
  const bookingEnabled = isModuleEnabled('booking_appointments', clinic.enabledModules);

  const bookTo = bookingEnabled ? (isAuthenticated ? '/portal/book' : '/portal/register') : '/portal';

  return (
    <section
      className="relative isolate w-full max-w-none overflow-x-clip bg-[#f7f9fc] py-12 sm:py-16 lg:py-20 xl:py-[5.25rem]"
      id="services"
    >
      <div
        className={`relative z-[1] flex w-full min-w-0 max-w-none flex-col ${PORTAL_SECTION_PX} ${PORTAL_SECTION_FULL_WIDTH}`}
      >
        <ScrollReveal className="w-full text-center" yOffset={16}>
          <p className="inline-flex items-center justify-center gap-2 font-sans text-[11px] font-semibold uppercase leading-none tracking-[0.22em] text-[var(--color-accent)] sm:tracking-[0.26em]">
            Medical services
          </p>
          <h2 className={`${portalSectionTitleClassnames('mx-auto mt-5 max-w-6xl text-balance')} sm:mt-6`}>
            Comprehensive Care, All in One Clinic
          </h2>
          <p
            className={portalSectionLeadClassnames(
              'mx-auto mt-7 max-w-[31rem] px-2 text-center sm:mt-[1.75rem] sm:max-w-3xl sm:px-0 lg:mt-8 lg:max-w-[46rem]',
            )}
          >
            From consultations to certifications, everything you need is available in one clinic. No long queues, no multiple stops, just straightforward care when you need it
          </p>
        </ScrollReveal>

        <div className="mt-12 grid w-full min-w-0 grid-cols-1 gap-10 sm:mt-14 sm:gap-12 lg:mt-16 lg:grid-cols-2 lg:items-stretch lg:gap-x-12 lg:gap-y-12 xl:gap-x-16 xl:gap-y-14">
          <ScrollReveal
            className="min-w-0 w-full lg:flex lg:h-full lg:min-h-0 lg:flex-col"
            yOffset={20}
          >
            <div className="relative flex min-h-[220px] w-full min-w-0 flex-col overflow-hidden rounded-[1.85rem] bg-slate-200/40 shadow-[0_26px_64px_-40px_rgba(15,23,42,0.35)] sm:rounded-[2.15rem] lg:min-h-0 lg:flex-1">
              <img
                alt="Bright clinic reception and waiting area with seating, natural light, and plants."
                className="aspect-[4/5] w-full object-cover object-center sm:aspect-[10/13] lg:aspect-auto lg:h-full lg:min-h-0 lg:flex-1"
                decoding="async"
                src="/servicebg.png"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/10 via-40% to-transparent"
              />
              <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-3.5 sm:p-5 lg:p-6">
                <figure
                  className="pointer-events-auto relative isolate w-full max-w-[20.5rem] overflow-hidden rounded-[1.35rem] border border-white/[0.07] bg-neutral-950/14 p-6 shadow-[0_36px_72px_-36px_rgba(0,0,0,0.62),inset_0_1px_0_0_rgba(255,255,255,0.2),inset_1px_1px_0_0_rgba(255,255,255,0.08),inset_0_-1px_0_0_rgba(0,0,0,0.28)] backdrop-blur-3xl backdrop-saturate-125 sm:max-w-[24rem] sm:rounded-[1.5rem] sm:p-7 lg:max-w-[28rem] lg:rounded-2xl lg:p-8"
                  aria-roledescription="carousel"
                  role="region"
                  aria-label={`Patient testimonials, ${SERVICES_IMAGE_TESTIMONIALS.length} slides`}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.085] mix-blend-overlay"
                    style={{ backgroundImage: TESTIMONIAL_GLASS_NOISE }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/[0.06] via-transparent to-white/[0.02]"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-white/[0.028] blur-3xl"
                  />
                  <ServicesAreaTestimonialsSlider />
                </figure>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal className="flex min-h-0 min-w-0 w-full flex-col lg:h-full lg:min-h-0" delayMs={60} yOffset={18}>
            {services.length ? (
              <ul className="list-none space-y-0 p-0" role="list">
                {services.map((service, idx) => (
                  <li key={service.id}>
                    <ServicePricingRow
                      name={service.name}
                      description={
                        service.description?.trim()
                          ? service.description.trim()
                          : 'Ask your clinician what this visit includes when you confirm your booking.'
                      }
                      isLast={idx === services.length - 1}
                      priceLabel={`From ${formatCurrency(service.price)}`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-3">
                <p className="font-sans text-[15px] leading-relaxed text-slate-600">
                  We&apos;re updating the service list. Please call reception to ask about appointments and pricing
                  {clinic.contactNumber ? (
                    <>
                      {' '}
                      at{' '}
                      <a className="font-semibold text-[var(--color-accent)] hover:underline" href={`tel:${clinic.contactNumber.replace(/\s+/g, '')}`}>
                        {clinic.contactNumber}
                      </a>
                      .
                    </>
                  ) : (
                    '.'
                  )}
                </p>
              </div>
            )}

            <div className="mt-10 sm:mt-11">
              {bookingEnabled ? (
                <Link className={primaryCtaClass} to={bookTo}>
                  Book a visit
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                </Link>
              ) : (
                <Link className={primaryCtaClass} to="/portal">
                  Open portal
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                </Link>
              )}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
