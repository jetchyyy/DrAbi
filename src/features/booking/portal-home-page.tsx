import { ArrowRight, CalendarCheck2, CalendarRange, Clock3, MapPin, Phone, PhoneCall, ShieldCheck, Stethoscope, UserCog } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

import { useBookableServices, useClinicSettingsData, useDoctorDirectory } from '../../hooks/use-clinic-data';
import { defaultClinicSettings } from '../../config/clinic';
import { formatCurrency } from '../../lib/utils';

export function PortalHomePage() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { data: services = [] } = useBookableServices();
  const { data: doctors = [] } = useDoctorDirectory();

  return (
    <div className="space-y-0 pb-0">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 shadow-sm">
        <div className="grid lg:grid-cols-[1fr_420px] min-h-[420px]">

          {/* Left: headline */}
          <div className="flex flex-col justify-center p-8 md:p-12 border-r border-slate-100">
            <Badge className="w-fit bg-orange-50 text-orange-700 border border-orange-200 font-bold uppercase tracking-widest rounded-none mb-6" intent="neutral">
              Patient Portal
            </Badge>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05] text-slate-950">
              Your health,<br />
              <span className="text-orange-600">your schedule.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base text-slate-500 leading-relaxed">
              Book appointments, browse our services, and meet our specialists — all in one place. Fast, simple, and always available.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/portal/book">
                <Button className="rounded-none bg-orange-600 text-white font-bold uppercase tracking-wider px-8 py-6 text-sm hover:bg-orange-700 flex items-center gap-2">
                  Book an appointment <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/portal/my-bookings">
                <Button className="rounded-none font-bold uppercase tracking-wider px-8 py-6 text-sm" variant="secondary">
                  View my bookings
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: clinic info card */}
          <div className="bg-slate-50 flex flex-col justify-center p-8 md:p-10 border-t lg:border-t-0 border-slate-200">
            <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600 mb-5">Clinic Information</p>
            <ul className="space-y-5">
              <li className="flex items-start gap-4">
                <div className="p-2 bg-orange-600 text-white shrink-0">
                  <MapPin className="size-4" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-0.5">Address</p>
                  <p className="text-sm font-semibold text-slate-800">{clinic.address}</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="p-2 bg-orange-600 text-white shrink-0">
                  <Phone className="size-4" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-0.5">Contact</p>
                  <p className="text-sm font-semibold text-slate-800">{clinic.contactNumber}</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="p-2 bg-orange-600 text-white shrink-0">
                  <CalendarRange className="size-4" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-0.5">Booking Window</p>
                  <p className="text-sm font-semibold text-slate-800">Up to {clinic.bookingLeadDays} days in advance</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="p-2 bg-orange-600 text-white shrink-0">
                  <Clock3 className="size-4" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-0.5">Slot Duration</p>
                  <p className="text-sm font-semibold text-slate-800">{clinic.appointmentSlotMinutes} minutes per appointment</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Feature highlights strip ─────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-200">
        {[
          { icon: CalendarCheck2, label: 'Easy Scheduling', desc: 'Pick a date & time that works for you — no phone calls needed.' },
          { icon: ShieldCheck, label: 'Verified Specialists', desc: 'All our doctors are licensed professionals in their fields.' },
          { icon: PhoneCall, label: 'Staff Support', desc: 'Our front desk is ready to assist with any booking concerns.' },
        ].map((feature, i) => (
          <div key={i} className={`flex items-start gap-4 p-6 bg-white ${i < 2 ? 'border-b md:border-b-0 md:border-r' : ''} border-slate-200`}>
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
      <section className="pt-12 pb-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600 mb-2">What we offer</p>
            <h2 className="text-3xl font-extrabold uppercase tracking-tight text-slate-950 flex items-center gap-3">
              <Stethoscope className="size-7 text-orange-600" /> Our Services
            </h2>
          </div>
          <Link to="/portal/book">
            <Button variant="secondary" className="rounded-none font-bold uppercase tracking-wide text-xs px-5 hidden md:flex items-center gap-2">
              Book now <ArrowRight className="size-3" />
            </Button>
          </Link>
        </div>
        <div className="grid gap-px bg-slate-200 border border-slate-200 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div key={service.id} className="bg-white p-6 hover:bg-orange-50 transition-colors duration-200 group cursor-default">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-extrabold text-base uppercase tracking-wide text-slate-950 group-hover:text-orange-700 transition-colors">{service.name}</h3>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{service.durationMinutes} min</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-5">{service.description}</p>
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xl font-extrabold text-slate-950">{formatCurrency(service.price)}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 group-hover:underline">Select →</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Our Specialists ──────────────────────────────────── */}
      <section className="pt-8 pb-12">
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600 mb-2">Meet the team</p>
          <h2 className="text-3xl font-extrabold uppercase tracking-tight text-slate-950 flex items-center gap-3">
            <UserCog className="size-7 text-orange-600" /> Our Specialists
          </h2>
        </div>
        <div className="grid gap-px bg-slate-200 border border-slate-200 md:grid-cols-2 lg:grid-cols-4">
          {doctors.map((doctor) => (
            <div key={doctor.id} className="bg-white p-6 flex flex-col items-center text-center hover:bg-orange-50 transition-colors duration-200 group cursor-default">
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
      </section>

    </div>
  );
}

