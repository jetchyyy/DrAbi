import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '../../components/ui/badge';
import { Card, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { formatDateTimeLabel } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useMyTeleconsultAppointments } from '../teleconsult/hooks/use-teleconsult';
import { isTeleconsultJoinableStatus } from '../teleconsult/teleconsult-data';
import { useMyBookings } from './hooks/use-bookings';

export function MyBookingsPage() {
  const { profile, session } = useAuth();
  const { data: bookings = [] } = useMyBookings(session?.user.id ?? profile?.email ?? null);
  const { data: teleconsultAppointments = [] } = useMyTeleconsultAppointments();

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle className="text-3xl">My bookings</CardTitle>
        <p className="mt-3 text-sm text-slate-500">
          Patients can monitor status, reschedule requests, and keep intake information in one place.
        </p>
      </Card>

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
        <EmptyState
          description="Sign in with a patient account or submit your first booking request."
          icon={CalendarClock}
          title="No bookings yet"
        />
      ) : (
        bookings.map((booking) => (
          <Card key={booking.id}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-950">{booking.serviceName}</p>
                <p className="mt-2 text-sm text-slate-500">
                  {booking.preferredDate} at {booking.preferredTime}
                  {booking.doctorName ? ` with ${booking.doctorName}` : ''}
                </p>
                <p className="mt-2 text-sm text-slate-500">{booking.intakeNotes}</p>
              </div>
              <Badge intent={booking.status === 'confirmed' ? 'success' : booking.status === 'cancelled' ? 'danger' : 'info'}>
                {booking.status}
              </Badge>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
