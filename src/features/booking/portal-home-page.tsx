import { CalendarRange, Clock3, MapPin, PhoneCall } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { useBookableServices, useClinicSettingsData } from '../../hooks/use-clinic-data';
import { defaultClinicSettings } from '../../config/clinic';
import { formatCurrency } from '../../lib/utils';

export function PortalHomePage() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { data: services = [] } = useBookableServices();

  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-[36px] bg-slate-950 p-8 text-white lg:grid-cols-[1fr_0.9fr]">
        <div>
          <Badge className="bg-white/10 text-white" intent="neutral">
            Patient-first booking
          </Badge>
          <h1 className="mt-5 text-5xl font-semibold leading-tight">
            Book clinic visits in a few taps.
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-300">
            Browse services, choose your doctor or specialty, and manage upcoming appointments from one mobile-friendly portal.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/portal/book">
              <Button>Book an appointment</Button>
            </Link>
            <Link to="/portal/my-bookings">
              <Button variant="secondary">View my bookings</Button>
            </Link>
          </div>
        </div>

        <Card className="bg-white text-slate-950">
          <CardTitle>Clinic details</CardTitle>
          <div className="mt-5 space-y-4 text-sm text-slate-600">
            <p className="flex items-center gap-3"><MapPin className="size-4" /> {clinic.address}</p>
            <p className="flex items-center gap-3"><PhoneCall className="size-4" /> {clinic.contactNumber}</p>
            <p className="flex items-center gap-3"><CalendarRange className="size-4" /> {clinic.bookingLeadDays} day booking window</p>
            <p className="flex items-center gap-3"><Clock3 className="size-4" /> {clinic.appointmentSlotMinutes}-minute slots</p>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {services.map((service) => (
          <Card key={service.id}>
            <CardTitle>{service.name}</CardTitle>
            <p className="mt-3 text-sm text-slate-500">{service.description}</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-950">{formatCurrency(service.price)}</span>
              <span className="text-sm text-slate-500">{service.durationMinutes} mins</span>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
