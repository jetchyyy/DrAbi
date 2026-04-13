import { createReferral, getDatabase, listReferralsByPatient, updateReferralOutcome, updateReferralStatus } from '../../../lib/local-db';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import type { Referral, ReferralStatus } from '../../../types/domain';

export interface CreateReferralInput {
  patientId: string;
  appointmentId?: string | null;
  sourceConsultationId?: string | null;
  referringDoctorId: string;
  targetDoctorId: string;
  reason: string;
  clinicalSummary?: string;
  generalistNotes: string;
  slotDate?: string | null;
  slotTime?: string | null;
  specialistScheduleId?: string | null;
}

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

function assertFrontDeskGate(currentStatus: ReferralStatus, nextStatus: ReferralStatus) {
  if (nextStatus === 'accepted' || nextStatus === 'completed') {
    if (currentStatus !== 'confirmed' && currentStatus !== 'accepted' && currentStatus !== 'completed') {
      throw new Error('Referral must be confirmed by front desk before specialist acceptance/completion.');
    }
  }
}

function mapReferralRowToDomain(row: {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  referring_doctor_id: string;
  target_doctor_id: string | null;
  target_specialty_id: string | null;
  reason: string;
  clinical_summary: string;
  referral_notes: string;
  status: string;
  specialist_findings: string;
  specialist_recommendations: string;
  referred_at: string;
  specialist_visited_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}): Referral {
  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    referringDoctorId: row.referring_doctor_id,
    targetDoctorId: row.target_doctor_id,
    targetSpecialtyId: row.target_specialty_id,
    reason: row.reason,
    clinicalSummary: row.clinical_summary,
    referralNotes: row.referral_notes,
    status: (row.status as ReferralStatus) ?? 'sent',
    specialistFindings: row.specialist_findings,
    specialistRecommendations: row.specialist_recommendations,
    referredAt: row.referred_at,
    specialistVisitedAt: row.specialist_visited_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const referralService = {
  async listByPatient(patientId: string) {
    if (!patientId) {
      return [];
    }

    if (!isSupabaseConfigured) {
      return listReferralsByPatient(patientId);
    }

    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('referrals')
      .select('*')
      .eq('patient_id', patientId)
      .order('referred_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<{
      id: string;
      patient_id: string;
      appointment_id: string | null;
      referring_doctor_id: string;
      target_doctor_id: string | null;
      target_specialty_id: string | null;
      reason: string;
      clinical_summary: string;
      referral_notes: string;
      status: string;
      specialist_findings: string;
      specialist_recommendations: string;
      referred_at: string;
      specialist_visited_at: string | null;
      completed_at: string | null;
      created_at: string;
      updated_at: string;
    }>).map(mapReferralRowToDomain);
  },

  async create(input: CreateReferralInput) {
    if (!isSupabaseConfigured) {
      return createReferral({
        patientId: input.patientId,
        appointmentId: input.appointmentId ?? null,
        referringDoctorId: input.referringDoctorId,
        targetDoctorId: input.targetDoctorId,
        targetSpecialtyId: null,
        reason: input.reason,
        clinicalSummary: input.clinicalSummary ?? '',
        referralNotes: input.generalistNotes,
        status: 'pending',
        specialistFindings: '',
        specialistRecommendations: '',
        referredAt: new Date().toISOString(),
        specialistVisitedAt: null,
      });
    }

    const client = requireSupabaseClient();

    const { data: rpcData, error: rpcError } = await (client as any).rpc('create_referral_with_slot_lock', {
      p_patient_id: input.patientId,
      p_source_appointment_id: input.appointmentId ?? null,
      p_source_consultation_id: input.sourceConsultationId ?? null,
      p_referring_generalist_id: input.referringDoctorId,
      p_assigned_specialist_id: input.targetDoctorId,
      p_slot_date: input.slotDate ?? null,
      p_slot_time: input.slotTime ?? null,
      p_reason: input.reason,
      p_generalist_notes: input.generalistNotes,
      p_practice_location: {},
      p_specialist_schedule_id: input.specialistScheduleId ?? null,
      p_actor: null,
    });

    if (rpcError) {
      throw rpcError;
    }

    const created = (rpcData ?? []) as Array<{ referral_id: string }>;
    const referralId = created[0]?.referral_id;
    if (!referralId) {
      throw new Error('Referral RPC did not return a referral id.');
    }

    if (input.clinicalSummary) {
      const { error: patchError } = await client
        .from('referrals')
        .update({ clinical_summary: input.clinicalSummary } as never)
        .eq('id', referralId);

      if (patchError) {
        throw patchError;
      }
    }

    const { data, error } = await client.from('referrals').select('*').eq('id', referralId).single();
    if (error) {
      throw error;
    }

    return mapReferralRowToDomain(data as {
      id: string;
      patient_id: string;
      appointment_id: string | null;
      referring_doctor_id: string;
      target_doctor_id: string | null;
      target_specialty_id: string | null;
      reason: string;
      clinical_summary: string;
      referral_notes: string;
      status: string;
      specialist_findings: string;
      specialist_recommendations: string;
      referred_at: string;
      specialist_visited_at: string | null;
      completed_at: string | null;
      created_at: string;
      updated_at: string;
    });
  },

  async updateOutcome(input: {
    referralId: string;
    status: ReferralStatus;
    specialistFindings: string;
    specialistRecommendations: string;
    specialistVisitedAt: string | null;
  }) {
    if (!isSupabaseConfigured) {
      const current = getDatabase().referrals.find((item) => item.id === input.referralId);
      if (!current) {
        throw new Error('Referral not found.');
      }

      assertFrontDeskGate(current.status, input.status);

      return updateReferralOutcome(input.referralId, {
        status: input.status,
        specialistFindings: input.specialistFindings,
        specialistRecommendations: input.specialistRecommendations,
        specialistVisitedAt: input.specialistVisitedAt,
      });
    }

    const client = requireSupabaseClient();
    const { data: current, error: currentError } = await client
      .from('referrals')
      .select('status')
      .eq('id', input.referralId)
      .maybeSingle();

    if (currentError) {
      throw currentError;
    }

    const currentStatus = ((current as { status: ReferralStatus } | null)?.status ?? 'pending') as ReferralStatus;
    assertFrontDeskGate(currentStatus, input.status);

    const completedAt = input.status === 'completed' ? new Date().toISOString() : null;

    const { data, error } = await client
      .from('referrals')
      .update({
        status: input.status,
        specialist_findings: input.specialistFindings,
        specialist_recommendations: input.specialistRecommendations,
        specialist_visited_at: input.specialistVisitedAt,
        completed_at: completedAt,
      } as never)
      .eq('id', input.referralId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapReferralRowToDomain(data as {
      id: string;
      patient_id: string;
      appointment_id: string | null;
      referring_doctor_id: string;
      target_doctor_id: string | null;
      target_specialty_id: string | null;
      reason: string;
      clinical_summary: string;
      referral_notes: string;
      status: string;
      specialist_findings: string;
      specialist_recommendations: string;
      referred_at: string;
      specialist_visited_at: string | null;
      completed_at: string | null;
      created_at: string;
      updated_at: string;
    });
  },

  async updateStatus(input: {
    referralId: string;
    status: Extract<ReferralStatus, 'confirmed' | 'cancelled' | 'declined'>;
    referralNotes: string;
  }) {
    if (!isSupabaseConfigured) {
      return updateReferralStatus(input.referralId, {
        status: input.status,
        referralNotes: input.referralNotes,
      });
    }

    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('referrals')
      .update({
        status: input.status,
        referral_notes: input.referralNotes,
      } as never)
      .eq('id', input.referralId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapReferralRowToDomain(data as {
      id: string;
      patient_id: string;
      appointment_id: string | null;
      referring_doctor_id: string;
      target_doctor_id: string | null;
      target_specialty_id: string | null;
      reason: string;
      clinical_summary: string;
      referral_notes: string;
      status: string;
      specialist_findings: string;
      specialist_recommendations: string;
      referred_at: string;
      specialist_visited_at: string | null;
      completed_at: string | null;
      created_at: string;
      updated_at: string;
    });
  },
};
