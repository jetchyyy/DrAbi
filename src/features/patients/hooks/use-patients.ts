import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '../../../app/query-client';
import { listPatients, upsertPatient } from '../../../lib/local-db';
import { queryKeys } from '../../../lib/query-keys';
import type { Patient } from '../../../types/domain';

export function usePatients() {
  return useQuery({
    queryKey: queryKeys.patients,
    queryFn: async () => listPatients(),
  });
}

export function useCreatePatient() {
  return useMutation({
    mutationFn: async (payload: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>) => upsertPatient(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients });
    },
  });
}

