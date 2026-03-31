import {
  ArrowRight,
  CalendarCheck2,
  CalendarRange,
  Clock3,
  MapPin,
  Phone,
  PhoneCall,
  ShieldCheck,
  Stethoscope,
  UserCog,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useBookableServices, useClinicSettingsData, useDoctorDirectory } from '../../hooks/use-clinic-data';
import { defaultClinicSettings } from '../../config/clinic';
import { formatCurrency } from '../../lib/utils';

// Sample doctor portraits — one combined sheet split into quadrants via object-position
const doctorPhotos = [
  { objectPosition: 'top left',     name: 'Dr. Ricardo Santos', specialty: 'Internal Medicine' },
  { objectPosition: 'top right',    name: 'Dr. Maria Reyes',    specialty: 'Pediatrics' },
  { objectPosition: 'bottom left',  name: 'Dr. Eduardo Lim',    specialty: 'General Surgery' },
  { objectPosition: 'bottom right', name: 'Dr. Angela Cruz',    specialty: 'Obstetrics & Gynecology' },
];

const SERVICE_PALETTES = [
  { from: '#ea580c', to: '#f97316', light: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200'  },
  { from: '#0369a1', to: '#0ea5e9', light: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200'     },
  { from: '#059669', to: '#10b981', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { from: '#7c3aed', to: '#a855f7', light: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200'  },
  { from: '#be123c', to: '#f43f5e', light: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200'    },
  { from: '#b45309', to: '#f59e0b', light: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
];

export function PortalHomePage() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { data: services = [] } = useBookableServices();
  const { data: doctors = [] } = useDoctorDirectory();

  return (
    <div className="space-y-0 pb-0">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border border-slate-200 shadow-sm">

        {/* Vivid aurora mesh background */}
        <div
          className="absolute inset-0 animate-aurora"
          style={{
            background:
              'linear-gradient(135deg, #0f1f2e 0%, #ea580c 20%, #f59e0b 38%, #172937 52%, #dc2626 68%, #f97316 82%, #0f1f2e 100%)',
            backgroundSize: '400% 400%',
          }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[#0f1f2e]/40" />

        {/* Orb 1 — large vivid orange bloom, top-right */}
        <div
          className="absolute animate-orb-1 pointer-events-none"
          style={{
            top: '-120px', right: '-100px', width: '480px', height: '480px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,146,60,0.65) 0%, rgba(234,88,12,0.2) 60%, transparent 80%)',
          }}
        />
        {/* Orb 2 — amber glow, bottom-left */}
        <div
          className="absolute animate-orb-2 pointer-events-none"
          style={{
            bottom: '-80px', left: '5%', width: '320px', height: '320px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,158,11,0.55) 0%, rgba(217,119,6,0.15) 65%, transparent 85%)',
          }}
        />
        {/* Orb 3 — rose accent, center */}
        <div
          className="absolute animate-orb-3 pointer-events-none"
          style={{
            top: '30%', left: '20%', width: '200px', height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,113,133,0.45) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 grid lg:grid-cols-[1fr_400px] min-h-[460px]">
          {/* Left: headline */}
          <div className="flex flex-col justify-center p-8 md:p-14">
            <Badge
              className="w-fit bg-white/10 text-orange-200 border border-white/20 font-bold uppercase tracking-widest rounded-none mb-6 animate-fade-in"
              intent="neutral"
            >
              Patient Portal
            </Badge>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05] text-white animate-slide-left delay-100">
              Your health,<br />
              <span className="text-orange-400">your schedule.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base text-orange-100/80 leading-relaxed animate-slide-left delay-200">
              Book appointments, browse our services, and meet our specialists — all in one place. Fast, simple, and always available.
            </p>
            <div className="mt-10 flex flex-wrap gap-3 animate-fade-up delay-300">
              <Link to="/portal/book">
                <Button className="rounded-none bg-orange-500 text-white font-bold uppercase tracking-wider px-8 py-6 text-sm hover:bg-orange-400 transition-colors flex items-center gap-2 shadow-lg shadow-orange-900/30">
                  Book an appointment <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/portal/my-bookings">
                <Button className="rounded-none font-bold uppercase tracking-wider px-8 py-6 text-sm bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors" variant="secondary">
                  View my bookings
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: clinic info */}
          <div className="bg-white/10 backdrop-blur-sm flex flex-col justify-center p-8 md:p-10 border-l border-white/10 animate-slide-right delay-200">
            <p className="text-xs font-extrabold uppercase tracking-widest text-orange-300 mb-6">Clinic Information</p>
            <ul className="space-y-5">
              {[
                { icon: MapPin,        label: 'Address',        value: clinic.address },
                { icon: Phone,         label: 'Contact',        value: clinic.contactNumber },
                { icon: CalendarRange, label: 'Booking Window', value: `Up to ${clinic.bookingLeadDays} days in advance` },
                { icon: Clock3,        label: 'Slot Duration',  value: `${clinic.appointmentSlotMinutes} minutes per appointment` },
              ].map(({ icon: Icon, label, value }) => (
                <li key={label} className="flex items-start gap-4">
                  <div className="p-2 bg-orange-500/80 text-white shrink-0">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-orange-300 font-bold mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-white">{value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Feature highlights strip ─────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-200">
        {[
          { icon: CalendarCheck2, label: 'Easy Scheduling',     desc: 'Pick a date & time that works for you — no phone calls needed.' },
          { icon: ShieldCheck,    label: 'Verified Specialists', desc: 'All our doctors are licensed professionals in their fields.' },
          { icon: PhoneCall,      label: 'Staff Support',        desc: 'Our front desk is ready to assist with any booking concerns.' },
        ].map((feature, i) => (
          <div
            key={i}
            className={`flex items-start gap-4 p-6 bg-white hover:bg-orange-50 transition-colors duration-200 animate-fade-up ${i < 2 ? 'border-b md:border-b-0 md:border-r' : ''} border-slate-200`}
            style={{ animationDelay: `${0.1 + i * 0.1}s` }}
          >
            <div className="p-3 bg-orange-50 text-orange-600 border border-orange-100 shrink-0">
              <feature.icon className="size-5" />
            </div>
            <div>
              <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">{feature.label}</p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{feature.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ── Our Services ─────────────────────────────────────── */}
      <section className="pt-14 pb-6" id="services">

        {/* Section header */}
        <div className="mb-10 animate-fade-up">
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600 mb-2">What We Offer</p>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-950">Our Services</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md leading-relaxed">
            From routine check-ups to specialist consultations — we have a service tailored for your every health need.
          </p>
        </div>

        {/* Service cards grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => {
            const palette = SERVICE_PALETTES[i % SERVICE_PALETTES.length];
            return (
              <div
                key={service.id}
                className="group bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default overflow-hidden flex flex-col animate-fade-up"
                style={{ animationDelay: `${0.07 * i}s` }}
              >
                {/* Colored gradient top strip */}
                <div
                  className="h-2 w-full shrink-0"
                  style={{ background: `linear-gradient(90deg, ${palette.from}, ${palette.to})` }}
                />

                <div className="p-6 flex flex-col flex-1">
                  {/* Icon + duration pill */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className={`p-2.5 ${palette.light} border ${palette.border} shrink-0`}>
                      <Stethoscope className={`size-5 ${palette.text}`} />
                    </div>
                    <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 ${palette.light} ${palette.text} border ${palette.border} whitespace-nowrap shrink-0`}>
                      {service.durationMinutes} min
                    </span>
                  </div>

                  <h3 className="font-extrabold text-lg text-slate-950 tracking-tight leading-tight mb-2 transition-colors group-hover:text-orange-700">
                    {service.name}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 flex-1 mb-5">
                    {service.description}
                  </p>

                  {/* Footer: price + Book CTA */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">Starting at</p>
                      <span className="text-2xl font-extrabold" style={{ color: palette.from }}>
                        {formatCurrency(service.price)}
                      </span>
                    </div>
                    <Link to="/portal/book">
                      <button className={`text-xs font-extrabold uppercase tracking-widest px-4 py-2 border ${palette.border} ${palette.text} ${palette.light} hover:opacity-80 transition-opacity flex items-center gap-1.5`}>
                        Book <ArrowRight className="size-3" />
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full-width CTA strip */}
        <div className="mt-6 bg-[#172937] px-8 py-7 flex flex-wrap items-center justify-between gap-4 animate-fade-up">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-orange-400 mb-1">Ready to get started?</p>
            <p className="text-white font-bold text-lg leading-tight">Book your appointment in under 2 minutes.</p>
          </div>
          <Link to="/portal/book">
            <Button className="rounded-none bg-orange-600 hover:bg-orange-500 font-extrabold uppercase tracking-widest text-sm px-8 py-4 flex items-center gap-2 transition-colors">
              Book an Appointment <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Meet our Doctors ─────────────────────────────────── */}
      <section className="pt-10 pb-14">
        <div className="mb-8 animate-fade-up">
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600 mb-2">Our Medical Team</p>
          <h2 className="text-3xl font-extrabold uppercase tracking-tight text-slate-950 flex items-center gap-3">
            <UserCog className="size-7 text-orange-600" /> Meet Our Doctors
          </h2>
        </div>

        <div className="grid gap-px bg-slate-200 border border-slate-200 md:grid-cols-2 lg:grid-cols-4">
          {doctorPhotos.map((doc, i) => (
            <div
              key={i}
              className="bg-white group cursor-default hover:shadow-lg transition-all duration-300 animate-fade-up overflow-hidden"
              style={{ animationDelay: `${0.1 + i * 0.12}s` }}
            >
              <div className="relative overflow-hidden" style={{ height: '220px' }}>
                <img
                  src="/doctor-portraits.png"
                  alt={doc.name}
                  className="absolute inset-0 w-[200%] h-[200%] object-cover transition-transform duration-500 group-hover:scale-105"
                  style={{ objectPosition: doc.objectPosition }}
                />
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#172937]/80 to-transparent" />
              </div>
              <div className="p-5 border-t border-slate-100">
                <h3 className="font-extrabold text-sm text-slate-950 uppercase tracking-wide leading-tight group-hover:text-orange-700 transition-colors">{doc.name}</h3>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-600">{doc.specialty}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Live doctors from database */}
        {doctors.length > 0 && (
          <div className="mt-px border border-slate-200 bg-slate-200 grid gap-px md:grid-cols-2 lg:grid-cols-4">
            {doctors.map((doctor, i) => (
              <div
                key={doctor.id}
                className="bg-white p-6 flex flex-col items-center text-center hover:bg-orange-50 transition-colors duration-200 group cursor-default animate-fade-up"
                style={{ animationDelay: `${0.5 + i * 0.1}s` }}
              >
                <div className="w-16 h-16 bg-orange-100 border-2 border-orange-200 flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
                  <UserCog className="size-8 text-orange-600" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-950 uppercase tracking-wide leading-tight">{doctor.fullName}</h3>
                {doctor.specialtyName && (
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-600">{doctor.specialtyName}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
