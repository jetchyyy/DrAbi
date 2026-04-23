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
  { from: '#ea580c', text: 'text-orange-600', ring: 'ring-orange-200', numColor: 'text-orange-100' },
  { from: '#0369a1', text: 'text-sky-600', ring: 'ring-sky-200', numColor: 'text-sky-100' },
  { from: '#059669', text: 'text-emerald-600', ring: 'ring-emerald-200', numColor: 'text-emerald-100' },
  { from: '#7c3aed', text: 'text-violet-600', ring: 'ring-violet-200', numColor: 'text-violet-100' },
  { from: '#be123c', text: 'text-rose-600', ring: 'ring-rose-200', numColor: 'text-rose-100' },
  { from: '#b45309', text: 'text-amber-600', ring: 'ring-amber-200', numColor: 'text-amber-100' },
];

export function ServicesSection() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { data: services = [] } = useBookableServices();
  const { isAuthenticated } = useAuth();
  const bookingEnabled = isModuleEnabled('booking_appointments', clinic.enabledModules);

  // Build flat render list: inject featured clinic card at index 1, photo card at end
  type RenderItem =
    | { type: 'service'; idx: number }
    | { type: 'featured' }
    | { type: 'photo' };

  const renderList: RenderItem[] = [];
  services.forEach((_, i) => {
    if (i === 1) renderList.push({ type: 'featured' });
    renderList.push({ type: 'service', idx: i });
  });
  if (services.length <= 1) renderList.push({ type: 'featured' });
  renderList.push({ type: 'photo' });

  return (
    <section className="relative overflow-hidden rounded-3xl bg-white px-8 py-16 shadow-sm ring-1 ring-orange-100" id="services" style={{ borderRadius: '1.5rem' }}>
      {/* Section header — split layout like reference */}
      <ScrollReveal className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end" yOffset={18}>
        <div>
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-950">
            Our medical<br />services
            <span className="ml-3 text-xl font-semibold text-slate-400">{'{ What you get }'}</span>
          </h2>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <p className="max-w-xs text-sm leading-relaxed text-slate-500 md:text-right">
            We provide a full range of medical services — from consultation to diagnosis and treatment.
          </p>
          <Link
            className="text-sm font-bold text-orange-600 underline-offset-2 transition-colors hover:underline"
            to="#services"
          >
            See all services →
          </Link>
        </div>
      </ScrollReveal>

      {/* Bento grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
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

          /* ── Clinic photo card ── */
          if (item.type === 'photo') {
            return (
              <ScrollReveal key="photo" delayMs={90 + renderIdx * 45} yOffset={16} className="col-span-2">
                <div
                  className="overflow-hidden rounded-3xl"
                  style={{ minHeight: '260px', borderRadius: '1.5rem' }}
                >
                  <img
                    src="/services-clinic-photo.jpg"
                    alt="Our Clinic"
                    className="h-full w-full object-cover"
                    style={{ minHeight: '260px' }}
                  />
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
                <p className={`mb-4 flex-1 text-xs leading-relaxed ${palette.text}`}>
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
                  <span className="text-xs font-extrabold text-slate-400">{formatCurrency(service.price)}</span>
                </div>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}
