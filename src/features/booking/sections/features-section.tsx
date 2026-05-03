import {
  CalendarPlus,
  FlaskConical,
  Headset,
  ShieldCheck,
  type LucideIcon,
  Video,
  FileText,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';
import { defaultClinicSettings } from '../../../config/clinic';
import { isModuleEnabled } from '../../../config/modules';
import { useClinicSettingsData } from '../../../hooks/use-clinic-data';
import { useAuth } from '../../auth/auth-context';
import {
  PORTAL_SECTION_FULL_WIDTH,
  PORTAL_SECTION_PX,
  portalSectionLeadClassnames,
  portalSectionTitleClassnames,
} from '../portal-section-shell';

const FEATURE_ROWS: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: Video,
    title: 'Online medical consultation',
    description:
      'Book video visits, lock a time slot, and join from a quiet space. Checks run before visits start calmly',
  },
  {
    icon: ShieldCheck,
    title: 'Verified specialists',
    description:
      'Credentials, licenses, and clinic alignment are reviewed before a profile goes live. You see clarity, not guesswork',
  },
  {
    icon: FlaskConical,
    title: 'Laboratory requests',
    description:
      'Submit lab orders in the portal, track status from draw to results, and keep everything together',
  },
  {
    icon: FileText,
    title: 'Medical summary',
    description:
      'Key notes and follow-ups roll into one friendly summary before your next booking. Fewer repeats, fewer gaps',
  },
  {
    icon: Headset,
    title: 'Staff support',
    description:
      'Call or message the team for scheduling, paperwork, or directions. Quick answers stay on record',
  },
];

const iconToneClass =
  'text-[color-mix(in_srgb,var(--color-primary)_62%,rgb(71_85_105)))]';

/** Minimal grid: five feature tiles + branded CTA (below Services on portal home). */
export function FeaturesSection() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { isAuthenticated } = useAuth();
  const bookingEnabled = isModuleEnabled('booking_appointments', clinic.enabledModules);

  const bookTarget = bookingEnabled ? (isAuthenticated ? '/portal/book' : '/portal/register') : '/portal';

  return (
    <section
      className="relative isolate overflow-x-clip bg-[#f6f5f3] py-12 sm:py-16 lg:py-20 xl:py-[5.25rem]"
      aria-labelledby="portal-features-heading"
    >
      <div className={`relative z-[1] ${PORTAL_SECTION_PX} ${PORTAL_SECTION_FULL_WIDTH}`}>
        <ScrollReveal className="mx-auto max-w-3xl text-center" yOffset={16}>
          <p className="font-sans text-[10px] font-semibold uppercase leading-none tracking-[0.26em] text-[var(--color-accent)] sm:text-[11px] sm:tracking-[0.24em]">
            Features
          </p>
          <h2
            id="portal-features-heading"
            className={portalSectionTitleClassnames('mx-auto mt-4 max-w-none text-balance sm:mt-[1.125rem]')}
          >
            Care you can count on
          </h2>
          <p
            className={portalSectionLeadClassnames(
              'mx-auto mt-7 max-w-[31rem] px-2 text-center sm:mt-[1.75rem] sm:max-w-[32.5rem] sm:px-0 lg:mt-8',
            )}
          >
            One calm system for visits, labs, and follow-through. Spacious layout and no clutter. Care that shows up when you need it.
          </p>
        </ScrollReveal>

        <div className="mx-auto mt-9 grid w-full max-w-[min(100%,36rem)] grid-cols-1 items-stretch gap-3 sm:max-w-[min(100%,76rem)] sm:grid-cols-2 sm:gap-4 lg:mt-11 lg:max-w-[min(100%,87rem)] lg:grid-cols-3 lg:gap-4">
          {FEATURE_ROWS.map((row, idx) => {
            const Icon = row.icon;
            return (
              <ScrollReveal key={row.title} className="h-full min-h-0" delayMs={idx * 50} yOffset={18}>
                <article className="mx-auto flex h-full w-full max-w-[34.5rem] min-h-[11.5rem] flex-col rounded-[1.5rem] bg-white p-5 shadow-[0_16px_44px_-32px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_-34px_rgba(15,23,42,0.18)] sm:max-w-none sm:min-h-[12rem] sm:rounded-[1.625rem] sm:p-6 lg:min-h-[12.5rem]">
                  <Icon
                    aria-hidden
                    className={`size-10 shrink-0 sm:size-11 ${iconToneClass}`}
                    strokeWidth={1.35}
                  />
                  <div className="mt-auto min-w-0 pt-5 text-left sm:pt-6">
                    <h3 className="font-display text-lg font-semibold leading-snug tracking-tight text-slate-900 sm:text-xl sm:text-[1.3rem]">
                      {row.title}
                    </h3>
                    <p className="mt-2.5 font-sans text-[15px] leading-relaxed tracking-tight text-slate-500 sm:mt-3 sm:text-[16px] sm:leading-[1.68] lg:text-[1.0625rem] lg:leading-[1.72]">
                      {row.description}
                    </p>
                  </div>
                </article>
              </ScrollReveal>
            );
          })}

          <ScrollReveal className="h-full min-h-0" delayMs={5 * 50} yOffset={18}>
            <Link
              to={bookTarget}
              className="group relative mx-auto flex h-full min-h-[11.5rem] w-full max-w-[34.5rem] flex-col overflow-hidden rounded-[1.5rem] p-5 text-left text-white shadow-[0_26px_60px_-28px_rgb(21_71_52/0.45)] outline-none transition hover:brightness-[1.03] focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f5f3] sm:max-w-none sm:min-h-[12rem] sm:rounded-[1.625rem] sm:p-6 lg:min-h-[12.5rem]"
              style={{
                backgroundImage: `
                  linear-gradient(
                    152deg,
                    color-mix(in srgb, var(--color-primary) 58%, rgb(22 64 52)) 0%,
                    color-mix(in srgb, var(--color-primary) 22%, rgb(15 52 43)) 100%
                  )`,
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-white/[0.07]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full bg-white/[0.06]"
              />
              <CalendarPlus
                aria-hidden
                className="relative z-[1] size-10 shrink-0 text-white/95 sm:size-11"
                strokeWidth={1.35}
              />
              <div className="relative z-[1] mt-auto min-w-0 pt-5 text-left font-display leading-[1.12] tracking-tight sm:pt-6">
                <span className="block text-lg font-semibold text-white/[0.88] opacity-95 sm:text-xl lg:text-[clamp(1.15rem,0.95vw+1rem,1.55rem)]">
                Simple appointments with no hassle, just care when you need it
                </span>
                <span className="mt-3 inline-block border-b border-white/45 pb-0.5 font-sans text-[12px] font-semibold uppercase tracking-[0.16em] text-white/85 transition group-hover:border-white group-hover:text-white sm:mt-4 sm:text-[13px]">
                  {bookingEnabled ? 'Start booking' : 'Portal home'} →
                </span>
              </div>
            </Link>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
