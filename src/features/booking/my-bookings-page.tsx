import {
  CalendarClock,
  CheckCircle,
  Clock,
  Clock4,
  Plus,
  Stethoscope,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '../../components/ui/badge';
import { Card, CardTitle } from '../../components/ui/card';
import { formatCurrency, formatDateTimeLabel } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useMyTeleconsultAppointments } from '../teleconsult/hooks/use-teleconsult';
import { isTeleconsultJoinableStatus } from '../teleconsult/teleconsult-data';
import { BookingReceiptCard } from './components/booking-receipt-card';
import { useMyBookings } from './hooks/use-bookings';

function formatFeeLabel(feeType: 'consultation' | 'follow_up' | 'service_fee') {
  if (feeType === 'follow_up') return 'Follow-up Fee';
  if (feeType === 'consultation') return 'Consultation Fee';
  return 'Medical Service Fee';
}

export function MyBookingsPage() {
  const { profile, session } = useAuth();
  const { data: bookings = [] } = useMyBookings(session?.user.id ?? profile?.email ?? null);
  const { data: teleconsultAppointments = [] } = useMyTeleconsultAppointments();

  const getStatusColor = (status: string) => {
    if (status === 'confirmed') return 'border-l-emerald-500 bg-white';
    if (status === 'cancelled') return 'border-l-rose-500 bg-white';
    return 'border-l-orange-500 bg-white';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'confirmed') return <CheckCircle className="size-5 text-emerald-600" />;
    if (status === 'cancelled') return <XCircle className="size-5 text-rose-600" />;
    return <Clock4 className="size-5 text-orange-600" />;
  };

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 animate-slide-left">
        <div className="border-l-4 border-orange-600 pl-4">
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-950">My Bookings</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Track your appointment requests, receipt QR, and cashier payment status.</p>
        </div>
        <Link to="/portal/book">
          <button className="flex items-center gap-2 border border-orange-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-widest text-orange-600 transition-colors hover:bg-orange-50">
            <Plus className="size-3.5" />
            New Booking
          </button>
        </Link>
      </div>

      {teleconsultAppointments.length > 0 ? (
        <Card>
          <CardTitle>My teleconsult rooms</CardTitle>
          <div className="mt-5 space-y-4">
            {teleconsultAppointments.map((appointment) => (
              <div key={appointment.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">{appointment.serviceName}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      {formatDateTimeLabel(appointment.scheduledAt)} with {appointment.doctorName}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">{appointment.teleconsultationAccessInstructions}</p>
                  </div>
                  <div className="text-right">
                    <Badge intent="info">{appointment.teleconsultationPlatform}</Badge>
                    {isTeleconsultJoinableStatus(appointment.status) ? (
                      <Link className="mt-3 inline-flex text-sm font-semibold text-[var(--color-primary)]" to={appointment.joinPath}>
                        Join teleconsult
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center border-2 border-dashed border-slate-200 bg-white p-16 text-center animate-fade-in">
          <div className="mb-5 flex h-16 w-16 items-center justify-center border border-orange-100 bg-orange-50">
            <CalendarClock className="size-8 text-orange-600" />
          </div>
          <h3 className="mb-2 text-base font-extrabold uppercase tracking-wide text-slate-950">No Bookings Yet</h3>
          <p className="mb-6 max-w-xs text-sm leading-relaxed text-slate-500">
            Sign into a patient account or submit your first booking request to get started.
          </p>
          <Link
            to="/portal/book"
            className="inline-flex items-center gap-2 bg-orange-600 px-6 py-3 text-xs font-extrabold uppercase tracking-widest text-white transition-colors hover:bg-orange-700"
          >
            Book an Appointment <CalendarClock className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking, index) => (
            <div
              key={booking.id}
              className={`animate-fade-up border border-slate-200 border-l-[5px] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${getStatusColor(booking.status)}`}
              style={{ animationDelay: `${0.05 * index}s` }}
            >
              <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="mt-0.5 shrink-0 border border-slate-100 bg-slate-50 p-2.5">
                    {getStatusIcon(booking.status)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-extrabold uppercase leading-tight tracking-tight text-slate-950">{booking.serviceName}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      <Stethoscope className="size-3.5 shrink-0 text-orange-600" />
                      {booking.doctorName ?? 'Clinic medical service'}
                    </p>
                  </div>
                </div>
                <Badge
                  className="shrink-0 whitespace-nowrap rounded-none text-[10px] font-extrabold uppercase tracking-widest"
                  intent={booking.status === 'confirmed' ? 'success' : booking.status === 'cancelled' ? 'danger' : 'info'}
                >
                  {booking.status}
                </Badge>
              </div>

              <div className="mx-6 mb-5 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Schedule</p>
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Clock className="size-3.5 text-orange-600" />
                    {booking.preferredDate} at {booking.preferredTime}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Booking charge</p>
                  <p className="text-sm font-bold text-slate-900">
                    {formatFeeLabel(booking.feeType)} - {formatCurrency(booking.feeAmount)}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Receipt / Payment</p>
                  <p className="text-sm font-bold text-slate-900">{booking.receiptCode}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {booking.paymentStatus === 'paid' ? 'Paid at cashier' : 'Pending cashier payment'}
                  </p>
                </div>
                {booking.intakeNotes ? (
                  <div>
                    <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Reason / Notes</p>
                    <p className="line-clamp-2 border-l-2 border-slate-200 pl-2 text-sm italic leading-relaxed text-slate-600">
                      {booking.intakeNotes}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mx-6 mb-6 border-t border-slate-100 pt-4">
                <BookingReceiptCard booking={booking} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
