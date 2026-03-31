import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../auth/auth-context';
import {
  getAuthorizedTeleconsultAppointmentForUser,
  getTeleconsultAppointmentsForUser,
} from '../teleconsult-data';

export function useMyTeleconsultAppointments() {
  const { profile, session } = useAuth();
  const userId = session?.user.id ?? null;
  const email = profile?.email ?? null;
  const role = profile?.role ?? null;

  return useQuery({
    queryKey: ['my-teleconsult-appointments', userId ?? email, role],
    queryFn: async () =>
      getTeleconsultAppointmentsForUser({
        userId,
        email,
        role,
      }),
    enabled: Boolean(profile && (role === 'patient' || role === 'doctor')),
  });
}

export function useAuthorizedTeleconsultAppointment(appointmentId: string) {
  const { profile, session } = useAuth();
  const userId = session?.user.id ?? null;
  const email = profile?.email ?? null;
  const role = profile?.role ?? null;

  return useQuery({
    queryKey: ['teleconsult-appointment', appointmentId, userId ?? email, role],
    queryFn: async () =>
      getAuthorizedTeleconsultAppointmentForUser({
        appointmentId,
        userId,
        email,
        role,
      }),
    enabled: Boolean(appointmentId && profile && (role === 'patient' || role === 'doctor')),
  });
}
