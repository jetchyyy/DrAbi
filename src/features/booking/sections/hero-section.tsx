import {
  ArrowUpRight,
  CalendarCheck,
  HeartHandshake,
  ImagePlus,
  Star,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { defaultClinicSettings } from '../../../config/clinic';
import { isModuleEnabled } from '../../../config/modules';
import { useClinicSettingsData } from '../../../hooks/use-clinic-data';
import { summarizeOperatingHours } from '../../../lib/clinic-hours-summary';
import { useAuth } from '../../auth/auth-context';
import { PORTAL_SECTION_PX } from '../portal-section-shell';

function HeroMetricFloat({
  icon: Icon,
  stat,
  caption,
  positionClass,
}: {
  icon: LucideIcon;
  stat: string;
  caption: string;
  positionClass: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute z-[2] hidden w-[10.5rem] lg:block xl:w-[11.25rem] ${positionClass}`}
      role="presentation"
    >
      <div className="rounded-2xl border border-white/60 bg-white/88 px-3.5 py-2.5 shadow-[0_22px_46px_-14px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.035] backdrop-blur-md">
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-primary)_16%,transparent)] text-[var(--color-primary)]">
            <Icon aria-hidden className="size-[17px]" strokeWidth={2} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-sans text-[1.0625rem] font-bold leading-none tracking-tight text-slate-900">{stat}</p>
            <p className="mt-1 font-sans text-[11px] font-medium leading-snug text-slate-500">{caption}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full-width hero section (not an inset card): white canvas + sky wash + column grid, serif headline. */
export function HeroSection() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { isAuthenticated } = useAuth();
  const bookingEnabled = isModuleEnabled('booking_appointments', clinic.enabledModules);
  const [imgError, setImgError] = useState(false);

  const telHref = clinic.contactNumber ? `tel:${clinic.contactNumber.replace(/\s+/g, '')}` : '';

  const directionsHref =
    clinic.address ?
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.address)}`
    : '';

  const hoursSummary = summarizeOperatingHours(clinic.operatingHours).filter(
    (row) => row.value !== 'Closed',
  );

  const primaryCtaClass =
    'group inline-flex max-w-max min-w-0 shrink-0 items-center justify-center gap-1 rounded-full bg-[var(--color-primary)] px-3 py-2.5 text-[11px] font-semibold leading-tight text-white shadow-md shadow-green-900/10 ring-1 ring-black/[0.04] transition hover:brightness-[0.97] active:brightness-95 sm:gap-2 sm:px-7 sm:py-3.5 sm:text-sm sm:shadow-lg';

  const heroSecondaryCtaClass =
    'group inline-flex max-w-max min-w-0 shrink-0 items-center justify-center gap-1 rounded-full border-[1.5px] border-slate-900/[0.10] bg-white/95 px-3 py-2.5 text-[11px] font-semibold leading-tight tracking-tight text-slate-800 shadow-sm backdrop-blur-sm transition hover:border-slate-300/80 hover:bg-slate-50/90 sm:gap-2.5 sm:px-6 sm:py-3 sm:text-sm';

  return (
    <section
      id="portal-hero"
      className="relative isolate flex min-h-[100svh] w-full max-w-none flex-col overflow-x-clip bg-white pb-10 pt-[calc(env(safe-area-inset-top)+5.25rem)] sm:pb-0 sm:pt-[calc(env(safe-area-inset-top)+5.5rem)] lg:h-[min(100dvh,100svh)] lg:min-h-[100svh] lg:overflow-x-visible lg:pb-0 lg:pt-[calc(env(safe-area-inset-top)+5.85rem)]"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top_left,rgba(52,178,249,0.4)_0%,rgba(199,236,253,0.16)_28%,rgba(255,255,255,0)_56%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg,transparent,transparent 76px,rgba(148,163,184,0.078) 76px,rgba(148,163,184,0.078) 77px)',
        }}
        aria-hidden
      />

      <div
        className={`relative z-[1] flex min-h-0 w-full max-w-none flex-1 flex-col pb-0 ${PORTAL_SECTION_PX}`}
      >
          {/* Mobile: natural stacking. Desktop: side-by-side, image anchors to viewport bottom. */}
          <div className="grid grid-cols-1 gap-8 pt-6 sm:gap-10 sm:pt-8 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:grid-rows-1 lg:items-stretch lg:gap-x-12 lg:auto-rows-[minmax(0,1fr)] lg:pt-8 xl:gap-x-16">
            <div className="relative z-[3] mt-1 sm:mt-2 lg:mt-5">
              <div className="flex min-w-0 flex-col justify-start font-sans">
                <p className="mt-5 inline-flex w-fit max-w-[min(40rem,100%)] flex-wrap items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--color-primary)_35%,white)] bg-[color-mix(in_srgb,var(--color-primary)_18%,white)] px-4 py-2 font-sans text-[0.8125rem] font-semibold leading-snug tracking-tight text-slate-500 shadow-[0_1px_2px_color-mix(in_srgb,var(--color-primary)_14%,transparent)] sm:mt-10 sm:gap-2.5 sm:px-[1.125rem] sm:text-sm lg:mt-[4.75rem] xl:mt-[5.75rem]">
                  <HeartHandshake
                    aria-hidden
                    className="size-3.5 shrink-0 text-current opacity-90 sm:size-4"
                    strokeWidth={2.25}
                  />
                  <span>Serving patients with care since 2024</span>
                </p>
                <h1 className="mt-3 font-display text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.032em] text-slate-900 sm:mt-3.5 sm:text-[3.5rem] md:text-[4rem] lg:mt-4 lg:w-max lg:max-w-none lg:whitespace-nowrap lg:text-[5.05rem] xl:mt-4 xl:text-[clamp(4.95rem,4.4vw+2.1rem,6.375rem)] 2xl:text-[clamp(5.35rem,3.85vw+3.35rem,6.875rem)]">
                  Healing begins here
                </h1>
                <p className="mt-5 max-w-[40rem] text-[1.0625rem] leading-relaxed tracking-tight text-slate-500 sm:mt-6 sm:max-w-[42rem] sm:text-[1.25rem] lg:mt-8 lg:text-[1.3125rem] xl:text-[1.375rem]">
                  Book online in minutes. Personalized consultations, clear guidance, and a care team focused on prevention
                  and follow-through.
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-2 sm:mt-9 sm:gap-3">
                  {bookingEnabled ? (
                  <>
                    {isAuthenticated ? (
                      <Link className={primaryCtaClass} to="/portal/my-bookings">
                        <span className="min-w-0 sm:whitespace-normal">My bookings</span>
                        <ArrowUpRight
                          aria-hidden
                          className="size-4 shrink-0 opacity-95 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:size-5"
                          strokeWidth={2.5}
                        />
                      </Link>
                    ) : (
                      <Link className={primaryCtaClass} to="/portal/register">
                        <span className="min-w-0 sm:whitespace-normal">Book online in minutes</span>
                        <ArrowUpRight
                          aria-hidden
                          className="size-4 shrink-0 opacity-95 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:size-5"
                          strokeWidth={2.5}
                        />
                      </Link>
                    )}
                    {isAuthenticated ? (
                      <Link className={heroSecondaryCtaClass} to="/portal/book">
                        <span className="min-w-0 sm:whitespace-normal">Book a visit</span>
                        <ArrowUpRight
                          aria-hidden
                          className="size-4 shrink-0 text-slate-800 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:size-5"
                          strokeWidth={2.5}
                        />
                      </Link>
                    ) : (
                      <a className={heroSecondaryCtaClass} href="#services">
                        <span className="min-w-0 sm:whitespace-normal">Explore services</span>
                        <ArrowUpRight
                          aria-hidden
                          className="size-4 shrink-0 text-slate-800 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:size-5"
                          strokeWidth={2.5}
                        />
                      </a>
                    )}
                  </>
                  ) : (
                      <p className="rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-medium text-slate-600">
                        Online booking opens soon; call {clinic.contactNumber}
                      </p>
                    )}
                </div>

                {/* Clinic summary card */}
                <div className="mt-7 w-full max-w-[34rem] sm:mt-10 lg:mt-12">
                  <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-slate-200/60 bg-white/90 px-2 py-2 backdrop-blur-sm sm:gap-3 sm:px-2.5 sm:py-2.5">
                    <div className="shrink-0">
                      <img
                        alt="CPR Medical Clinic and Laboratory building exterior."
                        className="size-[6.25rem] rounded-lg border border-slate-200/70 object-cover shadow-sm sm:size-[7.25rem]"
                        decoding="async"
                        src="/cprclinic.png"
                      />
                    </div>
                    <div className="mt-2 flex min-w-0 flex-1 flex-col gap-2 sm:mt-3.5">
                      {clinic.address ?
                        directionsHref ?
                          <a
                            className="min-w-0 whitespace-normal break-words font-sans text-sm font-semibold leading-snug text-slate-900 transition hover:underline sm:text-[15px]"
                            href={directionsHref}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {clinic.address.trim()}
                          </a>
                        : <p className="min-w-0 whitespace-normal break-words font-sans text-sm font-semibold leading-snug text-slate-900 sm:text-[15px]">
                            {clinic.address.trim()}
                          </p>
                      : null}
                      {clinic.contactNumber ?
                        <a
                          className="font-sans text-sm font-medium leading-snug text-slate-600 transition hover:text-slate-900 hover:underline sm:text-[15px]"
                          href={telHref}
                        >
                          {clinic.contactNumber}
                        </a>
                      : null}
                      {hoursSummary.length ?
                        <div className="font-sans text-sm font-medium leading-snug text-slate-600 sm:text-[15px]">
                          <span className="min-w-0 tabular-nums">
                            {hoursSummary.map((row) => (
                              <span key={row.label} className="block whitespace-normal">
                                {row.label}
                                <span className="opacity-70">{' - '}</span>
                                {row.value}
                              </span>
                            ))}
                          </span>
                        </div>
                      : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-[1] flex min-h-0 w-full flex-col justify-end leading-none max-lg:-mx-5 sm:max-lg:-mx-8 lg:mx-0 lg:h-full lg:min-h-0">
              {!imgError ? (
                <div className="relative z-[1] mx-0 w-full max-w-none overflow-visible lg:mx-0">
                  <HeroMetricFloat
                    icon={Star}
                    stat="4.9"
                    caption="Avg. care rating"
                    positionClass="top-[38%] left-0 -translate-x-[6%] xl:-translate-x-[14%]"
                  />
                  <HeroMetricFloat
                    icon={Users}
                    stat="20k+"
                    caption="Patients supported"
                    positionClass="top-[14%] right-2 xl:right-3 xl:top-[12%]"
                  />
                  <HeroMetricFloat
                    icon={CalendarCheck}
                    stat="Same day"
                    caption="Visits available"
                    positionClass="bottom-[28%] right-3 xl:bottom-[26%] xl:right-4"
                  />
                  <img
                    src="/newlogohero.png"
                    alt="Healthcare professional welcoming patients"
                    className="relative z-[1] block h-auto w-full max-h-[min(46dvh,26rem)] object-cover object-[center_bottom] max-lg:mx-0 max-lg:rounded-none sm:max-h-[min(54dvh,32rem)] lg:mx-auto lg:max-h-none lg:object-contain lg:object-bottom"
                    decoding="async"
                    loading="eager"
                    onError={() => setImgError(true)}
                  />
                </div>
              ) : (
                <div className="relative z-[1] flex w-full flex-col items-center justify-end gap-4 pb-2">
                  <div className="flex size-28 items-center justify-center rounded-[1.75rem] border border-slate-200 bg-slate-50 shadow-inner">
                    <ImagePlus className="size-12 text-slate-300" />
                  </div>
                  <p className="font-sans text-xs font-medium text-slate-400">Place /public/newlogohero.png</p>
                </div>
              )}
            </div>
          </div>
      </div>
    </section>
  );
}
