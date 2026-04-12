import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '../../../app/query-client';
import { queryKeys } from '../../../lib/query-keys';
import { createAppointmentLiveOrDemo, deleteAppointmentLiveOrDemo, listAppointmentsLiveOrDemo, updateAppointmentLiveOrDemo } from '../../teleconsult/teleconsult-data';
import type { Appointment } from '../../../types/domain';

export function useAppointments() {
  return useQuery({
    queryKey: queryKeys.appointments,
    queryFn: async () => listAppointmentsLiveOrDemo(),
  });
}

export function useCreateAppointment() {
  return useMutation({
    mutationFn: async (payload: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>) => createAppointmentLiveOrDemo(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
      void queryClient.invalidateQueries({ queryKey: ['my-teleconsult-appointments'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    },
  });
}

export function useUpdateAppointment() {
  return useMutation({
    mutationFn: async ({ appointmentId, payload }: { appointmentId: string; payload: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'> }) =>
      updateAppointmentLiveOrDemo(appointmentId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
      void queryClient.invalidateQueries({ queryKey: ['my-teleconsult-appointments'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    },
  });
}

export function useDeleteAppointment() {
  return useMutation({
    mutationFn: async (appointmentId: string) => deleteAppointmentLiveOrDemo(appointmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
      void queryClient.invalidateQueries({ queryKey: ['my-teleconsult-appointments'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    },
  });
}
