import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '../../../app/query-client';
import { createReferral, listReferralsByPatient, listReferralsByTargetDoctor, updateReferralOutcome } from '../../../lib/local-db';
import { queryKeys } from '../../../lib/query-keys';
import type { Referral, ReferralStatus } from '../../../types/domain';
import { referralService } from '../services/referral-service';

export function useReferrals(patientId: string | null) {
  return useQuery({
    queryKey: queryKeys.referrals(patientId),
    queryFn: async () => {
      if (!patientId) return [];
      return referralService.listByPatient(patientId);
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
      referralService.create({
        patientId: payload.patientId,
        appointmentId: payload.appointmentId,
        sourceConsultationId: null,
        referringDoctorId: payload.referringDoctorId,
        targetDoctorId: payload.targetDoctorId ?? '',
        reason: payload.reason,
        clinicalSummary: payload.clinicalSummary,
        generalistNotes: payload.referralNotes,
        slotDate: null,
        slotTime: null,
        specialistScheduleId: null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['referrals'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.referrals(patientId) });
    },
  });
}

export function useSpecialistReferrals(doctorId: string | null) {
  return useQuery({
    queryKey: queryKeys.specialistReferrals(doctorId),
    queryFn: async () => {
      if (!doctorId) return [];
      return listReferralsByTargetDoctor(doctorId);
    },
    enabled: Boolean(doctorId),
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
    }) => referralService.updateOutcome(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referrals(patientId) });
    },
  });
}

export function useUpdateReferralStatus(patientId: string | null) {
  return useMutation({
    mutationFn: async (payload: {
      referralId: string;
      status: 'confirmed' | 'cancelled' | 'declined';
      referralNotes: string;
    }) => referralService.updateStatus(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['referrals'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.referrals(patientId) });
    },
  });
}
