import { CalendarClock } from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { Card, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { useAuth } from '../auth/auth-context';
import { useMyBookings } from './hooks/use-bookings';

export function MyBookingsPage() {
  const { profile, session } = useAuth();
  const { data: bookings = [] } = useMyBookings(session?.user.id ?? profile?.email ?? null);

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle className="text-3xl">My bookings</CardTitle>
        <p className="mt-3 text-sm text-slate-500">
          Patients can monitor status, reschedule requests, and keep intake information in one place.
        </p>
      </Card>

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
