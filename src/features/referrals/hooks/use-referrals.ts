import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '../../../app/query-client';
import { createReferral, listReferralsByPatient, updateReferralOutcome } from '../../../lib/local-db';
import { queryKeys } from '../../../lib/query-keys';
import type { Referral, ReferralStatus } from '../../../types/domain';

export function useReferrals(patientId: string | null) {
  return useQuery({
    queryKey: queryKeys.referrals(patientId),
    queryFn: async () => {
      if (!patientId) return [];
      return listReferralsByPatient(patientId);
    },
    enabled: Boolean(patientId),
  });
}

export function useCreateReferral(patientId: string | null) {
  return useMutation({
    mutationFn: async (
      payload: Pick<
        Referral,
        'patientId' | 'appointmentId' | 'referringDoctorId' | 'targetDoctorId' | 'targetSpecialtyId' | 'reason' | 'clinicalSummary' | 'referralNotes'
      >,
    ) =>
      createReferral({
        ...payload,
        status: 'sent',
        specialistFindings: '',
        specialistRecommendations: '',
        referredAt: new Date().toISOString(),
        specialistVisitedAt: null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referrals(patientId) });
    },
  });
}

export function useUpdateReferralOutcome(patientId: string | null) {
  return useMutation({
    mutationFn: async (payload: {
      referralId: string;
      status: ReferralStatus;
      specialistFindings: string;
      specialistRecommendations: string;
      specialistVisitedAt: string | null;
    }) => updateReferralOutcome(payload.referralId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referrals(patientId) });
    },
  });
}
