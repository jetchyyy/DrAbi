import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';
import { defaultClinicSettings } from '../../../config/clinic';
import { isModuleEnabled } from '../../../config/modules';
import { useBookableServices, useClinicSettingsData } from '../../../hooks/use-clinic-data';
import { formatCurrency } from '../../../lib/utils';
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

        <div className="mt-12 grid w-full min-w-0 grid-cols-1 gap-10 sm:mt-14 sm:gap-12 lg:mt-16 lg:grid-cols-2 lg:items-start lg:gap-x-12 lg:gap-y-12 xl:gap-x-16 xl:gap-y-14">
          <ScrollReveal className="min-w-0 w-full" yOffset={20}>
            <div className="overflow-hidden rounded-[1.85rem] bg-slate-200/40 shadow-[0_26px_64px_-40px_rgba(15,23,42,0.35)] sm:rounded-[2.15rem]">
              <img
                alt="Bright clinic reception and waiting area with seating, natural light, and plants."
                className="aspect-[4/5] h-full min-h-[220px] w-full object-cover object-center sm:aspect-[10/13] lg:aspect-auto lg:min-h-[min(520px,calc(100vh-14rem))] lg:max-h-[640px]"
                decoding="async"
                src="/servicebg.png"
              />
            </div>
          </ScrollReveal>

          <ScrollReveal className="flex min-h-0 min-w-0 w-full flex-col" delayMs={60} yOffset={18}>
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
