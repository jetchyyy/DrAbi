import type { Appointment } from '../../../types/domain';
import { getDatabase, updateDatabase } from '../../../lib/local-db';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  return supabase;
}

export const appointmentService = {
  async getAppointmentById(appointmentId: string): Promise<Appointment | null> {
    if (!appointmentId) {
      return null;
    }

    if (!isSupabaseConfigured) {
      return getDatabase().appointments.find((appointment) => appointment.id === appointmentId) ?? null;
    }

    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const row = data as {
      id: string;
      patient_id: string;
      doctor_id: string | null;
      specialty_id: string | null;
      service_id: string | null;
      scheduled_at: string;
      status: Appointment['status'];
      source: Appointment['source'];
      visit_type: Appointment['visitType'];
      reason: string;
      notes: string;
      teleconsultation_platform: string | null;
      teleconsultation_url: string | null;
      teleconsultation_access_instructions: string | null;
      consultation_id: string | null;
      completed_by: string | null;
      completed_at: string | null;
      created_at: string;
      updated_at: string;
    };

    return {
      id: row.id,
      patientId: row.patient_id,
      doctorId: row.doctor_id ?? '',
      specialtyId: row.specialty_id ?? '',
      serviceId: row.service_id ?? '',
      scheduledAt: row.scheduled_at,
      status: row.status,
      source: row.source,
      visitType: row.visit_type,
      reason: row.reason,
      notes: row.notes,
      teleconsultationPlatform: row.teleconsultation_platform,
      teleconsultationUrl: row.teleconsultation_url,
      teleconsultationAccessInstructions: row.teleconsultation_access_instructions,
      consultationId: row.consultation_id,
      completedBy: row.completed_by,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async markAppointmentCompletedWithConsultation(
    appointmentId: string,
    consultationId: string,
    completedBy: string,
  ): Promise<void> {
    if (!appointmentId || !consultationId) {
      return;
    }

    if (!isSupabaseConfigured) {
      updateDatabase((draft) => {
        const appointment = draft.appointments.find((item) => item.id === appointmentId);
        if (!appointment) {
          return;
        }

        if (appointment.consultationId === consultationId && appointment.status === 'completed') {
          return;
        }

        appointment.status = 'completed';
        appointment.consultationId = consultationId;
        appointment.completedBy = completedBy;
        appointment.completedAt = new Date().toISOString();
        appointment.updatedAt = new Date().toISOString();
      });
      return;
    }

    const client = requireSupabaseClient();

    const { data: current, error: currentError } = await client
      .from('appointments')
      .select('id, consultation_id, status')
      .eq('id', appointmentId)
      .maybeSingle();

    if (currentError) {
      throw currentError;
    }

    if (!current) {
      throw new Error('Appointment not found.');
    }

    const currentRow = current as {
      consultation_id: string | null;
      status: string;
    };

    if (currentRow.consultation_id === consultationId && currentRow.status === 'completed') {
      return;
    }

    const { error } = await client
      .from('appointments')
      .update({
        status: 'completed',
        consultation_id: consultationId,
        completed_by: completedBy,
        completed_at: new Date().toISOString(),
      } as never)
      .eq('id', appointmentId);

    if (error) {
      throw error;
    }
  },
};
