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
import { useAuth } from '../auth/auth-context';
import { useMyBookings } from './hooks/use-bookings';

export function MyBookingsPage() {
  const { profile, session } = useAuth();
  const { data: bookings = [] } = useMyBookings(session?.user.id ?? profile?.email ?? null);

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
    <div className="mx-auto max-w-4xl pb-16">

      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 animate-slide-left">
        <div className="border-l-4 border-orange-600 pl-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 uppercase">My Bookings</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">Track your appointment requests and their current status.</p>
        </div>
        <Link to="/portal/book">
          <button className="flex items-center gap-2 border border-orange-600 text-orange-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-widest hover:bg-orange-50 transition-colors">
            <Plus className="size-3.5" />
            New Booking
          </button>
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 bg-white p-16 flex flex-col items-center text-center animate-fade-in">
          <div className="w-16 h-16 bg-orange-50 border border-orange-100 flex items-center justify-center mb-5">
            <CalendarClock className="size-8 text-orange-600" />
          </div>
          <h3 className="font-extrabold text-base uppercase tracking-wide text-slate-950 mb-2">No Bookings Yet</h3>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
            Sign into a patient account or submit your first booking request to get started.
          </p>
          <Link
            to="/portal/book"
            className="inline-flex items-center gap-2 bg-orange-600 text-white px-6 py-3 text-xs font-extrabold uppercase tracking-widest hover:bg-orange-700 transition-colors"
          >
            Book an Appointment <CalendarClock className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking, i) => (
            <div
              key={booking.id}
              className={`border border-slate-200 border-l-[5px] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-fade-up ${getStatusColor(booking.status)}`}
              style={{ animationDelay: `${0.05 * i}s` }}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="p-2.5 bg-slate-50 border border-slate-100 shrink-0 mt-0.5">
                    {getStatusIcon(booking.status)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-lg text-slate-950 uppercase tracking-tight leading-tight truncate">{booking.serviceName}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500 flex items-center gap-1.5 uppercase tracking-wide">
                      <Stethoscope className="size-3.5 text-orange-600 shrink-0" />
                      {booking.doctorName ?? 'Any Available Specialist'}
                    </p>
                  </div>
                </div>
                <Badge
                  className="rounded-none uppercase tracking-widest text-[10px] font-extrabold whitespace-nowrap shrink-0"
                  intent={booking.status === 'confirmed' ? 'success' : booking.status === 'cancelled' ? 'danger' : 'info'}
                >
                  {booking.status}
                </Badge>
              </div>

              {/* Details row */}
              <div className="border-t border-slate-100 mx-6 mb-5 pt-4 grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">Schedule</p>
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="size-3.5 text-orange-600" />
                    {booking.preferredDate} &nbsp;at&nbsp; {booking.preferredTime}
                  </p>
                </div>
                {booking.intakeNotes && (
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">Reason / Notes</p>
                    <p className="text-sm text-slate-600 italic leading-relaxed line-clamp-2 border-l-2 border-slate-200 pl-2">
                      {booking.intakeNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
