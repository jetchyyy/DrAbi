import { Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';
import { defaultClinicSettings } from '../../../config/clinic';
import { isModuleEnabled } from '../../../config/modules';
import { useBookableServices, useClinicSettingsData } from '../../../hooks/use-clinic-data';
import { formatCurrency } from '../../../lib/utils';
import { useAuth } from '../../auth/auth-context';

/*
 * Nano Banana prompt for /public/services-clinic-photo.jpg:
 * "A warm and inviting medical clinic interior, a doctor warmly interacting with a patient
 * in a bright modern consultation room, clean white and light neutral walls, soft natural
 * lighting, professional clinic atmosphere, photorealistic, wide landscape format 16:9,
 * orange and warm accent tones visible in decor or furniture, depth of field blur on
 * background, hopeful and caring mood"
 */

const SERVICE_PALETTES = [
  { from: '#ea580c', text: 'text-orange-700', ring: 'ring-orange-200', numColor: 'text-orange-300' },
  { from: '#0369a1', text: 'text-sky-700', ring: 'ring-sky-200', numColor: 'text-sky-300' },
  { from: '#059669', text: 'text-emerald-700', ring: 'ring-emerald-200', numColor: 'text-emerald-300' },
  { from: '#7c3aed', text: 'text-violet-700', ring: 'ring-violet-200', numColor: 'text-violet-300' },
  { from: '#be123c', text: 'text-rose-700', ring: 'ring-rose-200', numColor: 'text-rose-300' },
  { from: '#b45309', text: 'text-amber-700', ring: 'ring-amber-200', numColor: 'text-amber-300' },
];

export function ServicesSection() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { data: services = [] } = useBookableServices();
  const { isAuthenticated } = useAuth();
  const bookingEnabled = isModuleEnabled('booking_appointments', clinic.enabledModules);

  // Build flat render list: featured card first, then all services
  type RenderItem =
    | { type: 'service'; idx: number }
    | { type: 'featured' };

  const renderList: RenderItem[] = [{ type: 'featured' }, ...services.map((_, idx) => ({ type: 'service' as const, idx }))];

  return (
    <section className="relative overflow-hidden bg-white px-5 py-16 sm:px-8" id="services">
      {/* Background image + hero-style orange overlays */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'url(/services-clinic-photo.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'saturate(0.95)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.92) 0%, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.70) 32%, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.28) 62%, rgba(255,255,255,0.88) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 82% 18%, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.22) 0%, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.08) 35%, transparent 65%)',
        }}
      />

      {/* Centered section header */}
      <ScrollReveal className="relative z-10 mb-10 text-center" yOffset={18}>
        <div className="mx-auto max-w-3xl rounded-2xl bg-white/78 px-5 py-4 shadow-sm ring-1 ring-white/70 backdrop-blur-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700">Medical Services</p>
          <h2 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl">
            Our Services
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-relaxed text-slate-800 sm:text-base">
            Patient-first care delivered through consultation, diagnosis, and personalized treatment plans that match
            your needs.
          </p>
        </div>
      </ScrollReveal>

      {/* Bento grid */}
      <div className="relative z-10 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {renderList.map((item, renderIdx) => {
          /* ── Featured clinic card ── */
          if (item.type === 'featured') {
            return (
              <ScrollReveal key="featured" delayMs={80 + renderIdx * 45} yOffset={20}>
                <div
                  className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 p-6"
                  style={{ minHeight: '260px', borderRadius: '1.5rem' }}
                >
                  {/* Floating bubbles */}
                  <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
                  <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
                  <div className="absolute bottom-14 left-8 h-16 w-16 rounded-full bg-white/15" />
                  <div className="absolute right-8 top-12 h-10 w-10 rounded-full bg-white/20" />
                  <div className="absolute left-1/3 top-1/3 h-20 w-20 rounded-full bg-white/8" />
                  <div className="relative z-10 flex h-full flex-col justify-between gap-6 pt-1">
                    <div>
                      <p className="text-base font-extrabold uppercase tracking-tight text-white">{clinic.clinicName}</p>
                      <p className="mt-2 text-xs leading-relaxed text-orange-100/90">
                        From consultation and diagnosis to treatment with care and attention to detail.
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                      <Stethoscope className="size-5 text-white" />
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            );
          }

          /* ── Service card ── */
          const service = services[item.idx];
          const palette = SERVICE_PALETTES[item.idx % SERVICE_PALETTES.length];
          const num = String(item.idx + 1).padStart(2, '0');

          return (
            <ScrollReveal key={service.id} delayMs={100 + renderIdx * 45} yOffset={20}>
              <div
                className={`group flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${palette.ring}`}
                style={{ minHeight: '260px', borderRadius: '1.5rem' }}
              >
                {/* Faded number top-right */}
                <div className="mb-1 flex justify-end">
                  <span className={`text-5xl font-extrabold leading-none ${palette.numColor}`}>{num}</span>
                </div>

                {/* Icon + name */}
                <div className="mb-3 flex items-center gap-2">
                  <Stethoscope className={`size-5 shrink-0 ${palette.text}`} />
                  <h3 className="text-sm font-extrabold leading-snug tracking-tight text-slate-950 transition-colors group-hover:text-orange-700">
                    {service.name}
                  </h3>
                </div>

                {/* Description */}
                <p className="mb-4 flex-1 text-xs leading-relaxed text-slate-700">
                  {service.description ?? 'Professional medical care tailored to your individual needs.'}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <Link
                    className="text-xs font-bold text-orange-600 underline-offset-2 transition-colors hover:underline"
                    to={bookingEnabled ? (isAuthenticated ? '/portal/book' : '/portal/register') : '/portal'}
                  >
                    {bookingEnabled ? 'Make an appointment' : 'View portal'}
                  </Link>
                  <span className="text-xs font-extrabold text-slate-700">{formatCurrency(service.price)}</span>
                </div>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}

