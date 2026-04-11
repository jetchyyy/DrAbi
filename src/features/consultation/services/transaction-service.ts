import { isSupabaseConfigured, supabase } from '../../../lib/supabase';

export interface ConsultationTransactionInput {
  consultationId: string;
  appointmentId: string | null;
  patientId: string;
  providerId: string;
  consultationType: string;
  amount: number;
  actor: string;
}

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  return supabase;
}

export const transactionService = {
  async createConsultationTransaction(input: ConsultationTransactionInput) {
    if (!input.consultationId) {
      throw new Error('consultationId is required.');
    }

    if (!isSupabaseConfigured) {
      return null;
    }

    const client = requireSupabaseClient();

    const { data: existing, error: existingError } = await client
      .from('medical_services_transactions')
      .select('id')
      .eq('consultation_id', input.consultationId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return existing;
    }

    const { data, error } = await client
      .from('medical_services_transactions')
      .insert({
        consultation_id: input.consultationId,
        appointment_id: input.appointmentId,
        patient_id: input.patientId,
        provider_id: input.providerId,
        consultation_type: input.consultationType,
        amount: input.amount,
        actor: input.actor,
      } as never)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return data;
  },
};
