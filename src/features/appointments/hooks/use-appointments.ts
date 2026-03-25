import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '../../../app/query-client';
import { createAppointment, listAppointments } from '../../../lib/local-db';
import { queryKeys } from '../../../lib/query-keys';
import type { Appointment } from '../../../types/domain';

export function useAppointments() {
  return useQuery({
    queryKey: queryKeys.appointments,
    queryFn: async () => listAppointments(),
  });
}

export function useCreateAppointment() {
  return useMutation({
    mutationFn: async (payload: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>) => createAppointment(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
    },
  });
}

