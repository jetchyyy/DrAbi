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

import { defaultClinicSettings } from '../../config/clinic';
import { isModuleEnabled } from '../../config/modules';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useBookableServices, useClinicSettingsData, useDoctorDirectory } from '../../hooks/use-clinic-data';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';

const doctorPhotos = [
  { objectPosition: 'top left', name: 'Dr. Ricardo Santos', specialty: 'Internal Medicine' },
  { objectPosition: 'top right', name: 'Dr. Maria Reyes', specialty: 'Pediatrics' },
  { objectPosition: 'bottom left', name: 'Dr. Eduardo Lim', specialty: 'General Surgery' },
  { objectPosition: 'bottom right', name: 'Dr. Angela Cruz', specialty: 'Obstetrics & Gynecology' },
];

const SERVICE_PALETTES = [
  { from: '#ea580c', to: '#f97316', light: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  { from: '#0369a1', to: '#0ea5e9', light: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  { from: '#059669', to: '#10b981', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { from: '#7c3aed', to: '#a855f7', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  { from: '#be123c', to: '#f43f5e', light: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { from: '#b45309', to: '#f59e0b', light: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
];

export function PortalHomePage() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { data: services = [] } = useBookableServices();
  const { data: doctors = [] } = useDoctorDirectory();
  const { isAuthenticated } = useAuth();
  const bookingEnabled = isModuleEnabled('booking_appointments', clinic.enabledModules);

  return (
    <div className="space-y-0 pb-0">
      <section className="relative overflow-hidden border border-slate-200 shadow-sm">
        <div
          className="absolute inset-0 animate-aurora"
          style={{
            background:
              'linear-gradient(135deg, #0f1f2e 0%, #ea580c 20%, #f59e0b 38%, #172937 52%, #dc2626 68%, #f97316 82%, #0f1f2e 100%)',
            backgroundSize: '400% 400%',
          }}
        />
        <div className="absolute inset-0 bg-[#0f1f2e]/40" />

        <div
          className="pointer-events-none absolute animate-orb-1"
          style={{
            top: '-120px',
            right: '-100px',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,146,60,0.65) 0%, rgba(234,88,12,0.2) 60%, transparent 80%)',
          }}
        />
        <div
          className="pointer-events-none absolute animate-orb-2"
          style={{
            bottom: '-80px',
            left: '5%',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,158,11,0.55) 0%, rgba(217,119,6,0.15) 65%, transparent 85%)',
          }}
        />
        <div
          className="pointer-events-none absolute animate-orb-3"
          style={{
            top: '30%',
            left: '20%',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,113,133,0.45) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 grid min-h-[460px] lg:grid-cols-[1fr_400px]">
          <div className="flex flex-col justify-center p-8 md:p-14">
            <Badge
              className="mb-6 w-fit rounded-none border border-white/20 bg-white/10 font-bold uppercase tracking-widest text-orange-200 animate-fade-in"
              intent="neutral"
            >
              Patient Portal
            </Badge>
            <h1 className="animate-slide-left delay-100 text-5xl font-extrabold leading-[1.05] tracking-tight text-white md:text-6xl">
              Your health,
              <br />
              <span className="text-orange-400">your schedule.</span>
            </h1>
            <p className="mt-6 max-w-lg animate-slide-left delay-200 text-base leading-relaxed text-orange-100/80">
              Book appointments, browse our services, and meet our specialists - all in one place. Fast, simple, and always available.
            </p>
            <div className="mt-10 flex flex-wrap gap-3 animate-fade-up delay-300">
              {bookingEnabled ? (
                <>
                  {isAuthenticated ? (
                    <Link to="/portal/book">
                      <Button className="flex items-center gap-2 rounded-none bg-orange-500 px-8 py-6 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-orange-400">
                        Book an appointment <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Link to="/portal/register">
                        <Button className="flex items-center gap-2 rounded-none bg-orange-500 px-8 py-6 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-orange-400">
                          Create account <ArrowRight className="size-4" />
                        </Button>
                      </Link>
                      <Link to="/login">
                        <Button className="rounded-none border border-white/20 bg-white/10 px-8 py-6 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/20" variant="secondary">
                          Sign in to book
                        </Button>
                      </Link>
                    </>
                  )}
                  <Link to="/portal/my-bookings">
                    <Button className="rounded-none border border-white/20 bg-white/10 px-8 py-6 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/20" variant="secondary">
                      View my bookings
                    </Button>
                  </Link>
                </>
              ) : (
                <div className="border border-white/20 bg-white/10 px-6 py-4 text-sm font-semibold text-orange-100">
                  Online booking is not included in this client plan right now.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-center border-l border-white/10 bg-white/10 p-8 backdrop-blur-sm md:p-10 animate-slide-right delay-200">
            <p className="mb-6 text-xs font-extrabold uppercase tracking-widest text-orange-300">Clinic Information</p>
            <ul className="space-y-5">
              {[
                { icon: MapPin, label: 'Address', value: clinic.address },
                { icon: Phone, label: 'Contact', value: clinic.contactNumber },
                { icon: CalendarRange, label: 'Booking Window', value: `Up to ${clinic.bookingLeadDays} days in advance` },
                { icon: Clock3, label: 'Slot Duration', value: `${clinic.appointmentSlotMinutes} minutes per appointment` },
              ].map(({ icon: Icon, label, value }) => (
                <li key={label} className="flex items-start gap-4">
                  <div className="shrink-0 bg-orange-500/80 p-2 text-white">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-orange-300">{label}</p>
                    <p className="text-sm font-semibold text-white">{value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 border-b border-slate-200 md:grid-cols-3">
        {[
          { icon: CalendarCheck2, label: 'Easy Scheduling', desc: 'Pick a date & time that works for you - no phone calls needed.' },
          { icon: ShieldCheck, label: 'Verified Specialists', desc: 'All our doctors are licensed professionals in their fields.' },
          { icon: PhoneCall, label: 'Staff Support', desc: 'Our front desk is ready to assist with any booking concerns.' },
        ].map((feature, i) => (
          <div
            key={feature.label}
            className={`animate-fade-up flex items-start gap-4 border-slate-200 bg-white p-6 transition-colors duration-200 hover:bg-orange-50 ${i < 2 ? 'border-b md:border-b-0 md:border-r' : ''}`}
            style={{ animationDelay: `${0.1 + i * 0.1}s` }}
          >
            <div className="shrink-0 border border-orange-100 bg-orange-50 p-3 text-orange-600">
              <feature.icon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-slate-950">{feature.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{feature.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="pb-6 pt-14" id="services">
        <div className="mb-10 animate-fade-up">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-widest text-orange-600">What We Offer</p>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-950">Our Services</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            From routine check-ups to specialist consultations - we have a service tailored for your every health need.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => {
            const palette = SERVICE_PALETTES[i % SERVICE_PALETTES.length];
            return (
              <div
                key={service.id}
                className="group animate-fade-up flex cursor-default flex-col overflow-hidden border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{ animationDelay: `${0.07 * i}s` }}
              >
                <div className="h-2 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${palette.from}, ${palette.to})` }} />

                <div className="flex flex-1 flex-col p-6">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className={`shrink-0 border ${palette.border} ${palette.light} p-2.5`}>
                      <Stethoscope className={`size-5 ${palette.text}`} />
                    </div>
                    <span className={`shrink-0 whitespace-nowrap border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${palette.border} ${palette.light} ${palette.text}`}>
                      {service.durationMinutes} min
                    </span>
                  </div>

                  <h3 className="mb-2 text-lg font-extrabold leading-tight tracking-tight text-slate-950 transition-colors group-hover:text-orange-700">
                    {service.name}
                  </h3>
                  <p className="mb-5 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-500">{service.description}</p>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <div>
                      <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Starting at</p>
                      <span className="text-2xl font-extrabold" style={{ color: palette.from }}>
                        {formatCurrency(service.price)}
                      </span>
                    </div>
                    <Link to={bookingEnabled ? "/portal/book" : "/portal"}>
                      <button className={`flex items-center gap-1.5 border px-4 py-2 text-xs font-extrabold uppercase tracking-widest transition-opacity hover:opacity-80 ${palette.border} ${palette.light} ${palette.text}`}>
                        {bookingEnabled ? 'Book' : 'View'} <ArrowRight className="size-3" />
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-[#172937] px-8 py-7 animate-fade-up">
          <div>
            <p className="mb-1 text-xs font-extrabold uppercase tracking-widest text-orange-400">Ready to get started?</p>
            <p className="text-lg font-bold leading-tight text-white">Book your appointment in under 2 minutes.</p>
          </div>
          <Link to={bookingEnabled ? (isAuthenticated ? '/portal/book' : '/portal/register') : '/portal'}>
            <Button className="flex items-center gap-2 rounded-none bg-orange-600 px-8 py-4 text-sm font-extrabold uppercase tracking-widest transition-colors hover:bg-orange-500">
              {bookingEnabled ? (isAuthenticated ? 'Book an Appointment' : 'Create Account') : 'View Portal'} <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="pb-14 pt-10">
        <div className="mb-8 animate-fade-up">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-widest text-orange-600">Our Medical Team</p>
          <h2 className="flex items-center gap-3 text-3xl font-extrabold uppercase tracking-tight text-slate-950">
            <UserCog className="size-7 text-orange-600" /> Meet Our Doctors
          </h2>
        </div>

        <div className="grid gap-px border border-slate-200 bg-slate-200 md:grid-cols-2 lg:grid-cols-4">
          {doctorPhotos.map((doctor, i) => (
            <div
              key={doctor.name}
              className="group animate-fade-up cursor-default overflow-hidden bg-white transition-all duration-300 hover:shadow-lg"
              style={{ animationDelay: `${0.1 + i * 0.12}s` }}
            >
              <div className="relative overflow-hidden" style={{ height: '220px' }}>
                <img
                  src="/doctor-portraits.png"
                  alt={doctor.name}
                  className="absolute inset-0 h-[200%] w-[200%] object-cover transition-transform duration-500 group-hover:scale-105"
                  style={{ objectPosition: doctor.objectPosition }}
                />
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#172937]/80 to-transparent" />
              </div>
              <div className="border-t border-slate-100 p-5">
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-950 transition-colors group-hover:text-orange-700">{doctor.name}</h3>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-600">{doctor.specialty}</p>
              </div>
            </div>
          ))}
        </div>

        {doctors.length > 0 ? (
          <div className="mt-px grid gap-px border border-slate-200 bg-slate-200 md:grid-cols-2 lg:grid-cols-4">
            {doctors.map((doctor, i) => (
              <div
                key={doctor.id}
                className="group flex cursor-default flex-col items-center bg-white p-6 text-center transition-colors duration-200 hover:bg-orange-50 animate-fade-up"
                style={{ animationDelay: `${0.5 + i * 0.1}s` }}
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center border-2 border-orange-200 bg-orange-100 transition-colors group-hover:bg-orange-200">
                  <UserCog className="size-8 text-orange-600" />
                </div>
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-950">{doctor.fullName}</h3>
                {doctor.specialtyName ? <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-600">{doctor.specialtyName}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
