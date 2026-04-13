import { getDatabase } from '../../../lib/local-db';
import { createAppointmentLiveOrDemo, createConsultationLiveOrDemo, listAppointmentsByPatientIdLiveOrDemo, listConsultationsByPatientIdLiveOrDemo } from '../../../lib/supabase-clinic';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import type { Appointment, Consultation } from '../../../types/domain';
import { appointmentService } from './appointment-service';
import { transactionService } from './transaction-service';

export type ConsultationSubmissionPayload = Omit<Consultation, 'id' | 'createdAt' | 'updatedAt'> & {
  actor: string;
};

export interface ConsultationContext {
  patientId: string;
  appointmentId: string | null;
  appointment: Appointment | null;
  appointments: Appointment[];
  consultations: Consultation[];
}

export interface ConsultationValidationIssue {
  field: string;
  message: string;
}

export interface ConsultationValidationResult {
  valid: boolean;
  issues: ConsultationValidationIssue[];
}

export class ConsultationServiceError extends Error {
  code: string;
  details: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ConsultationServiceError';
    this.code = code;
    this.details = details;
  }
}

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

function mapConsultationRowToDomain(row: {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  consultation_type: string | null;
  consultation_date: string | null;
  consultation_time: string | null;
  provider_name: string | null;
  clinical_summary: string | null;
  diagnosis: string | null;
  present_illness_history: string | null;
  review_of_symptoms: string | null;
  allergies: string | null;
  vitals: string | null;
  treatment_plan: string | null;
  medications: string | null;
  lab_results: string | null;
  differential_diagnosis: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}): Consultation {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    consultationType: row.consultation_type ?? '',
    consultationDate: row.consultation_date ?? '',
    consultationTime: row.consultation_time ?? '',
    providerName: row.provider_name ?? '',
    clinicalSummary: row.clinical_summary ?? '',
    diagnosis: row.diagnosis ?? '',
    presentIllnessHistory: row.present_illness_history ?? '',
    reviewOfSymptoms: row.review_of_symptoms ?? '',
    allergies: row.allergies ?? '',
    vitals: row.vitals ?? '',
    treatmentPlan: row.treatment_plan ?? '',
    medications: row.medications ?? '',
    labResults: row.lab_results ?? '',
    differentialDiagnosis: row.differential_diagnosis ?? '',
    subjective: row.subjective ?? '',
    objective: row.objective ?? '',
    assessment: row.assessment ?? '',
    plan: row.plan ?? '',
    outcome: row.outcome ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isRecoverableRpcError(error: unknown, rpcName: string) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? String(error.code ?? '') : '';
  const message = 'message' in error ? String(error.message ?? '') : '';
  if (code === 'PGRST202' || message.includes(rpcName)) {
    return true;
  }

  // Some deployed RPC revisions have naming collisions (e.g. appointment_id) that surface as 42702.
  if (code === '42702' && message.toLowerCase().includes('ambiguous')) {
    return true;
  }

  return false;
}

async function submitConsultationWithRpc(payload: ConsultationSubmissionPayload): Promise<Consultation> {
  const client = requireSupabaseClient();
  const amount = Number(getDatabase().users.find((user) => user.id === payload.doctorId)?.consultationFee ?? 0);

  const { data: rpcData, error: rpcError } = await (client as any).rpc('complete_consultation_and_appointment', {
    p_appointment_id: payload.appointmentId,
    p_patient_id: payload.patientId,
    p_doctor_id: payload.doctorId,
    p_consultation_type: payload.consultationType,
    p_consultation_date: payload.consultationDate || null,
    p_consultation_time: payload.consultationTime || null,
    p_provider_name: payload.providerName,
    p_clinical_summary: payload.clinicalSummary,
    p_diagnosis: payload.diagnosis || '',
    p_present_illness_history: payload.presentIllnessHistory,
    p_review_of_symptoms: payload.reviewOfSymptoms || '',
    p_allergies: payload.allergies || '',
    p_vitals: payload.vitals || '',
    p_treatment_plan: payload.treatmentPlan || '',
    p_medications: payload.medications || '',
    p_lab_results: payload.labResults || '',
    p_differential_diagnosis: payload.differentialDiagnosis || '',
    p_subjective: payload.subjective || '',
    p_objective: payload.objective || '',
    p_assessment: payload.assessment || '',
    p_plan: payload.plan || '',
    p_outcome: payload.outcome || '',
    p_completed_by: payload.actor,
    p_amount: amount,
  });

  if (rpcError) {
    throw rpcError;
  }

  const rows = (rpcData ?? []) as Array<{ consultation_id: string }>;
  const consultationId = rows[0]?.consultation_id;
  if (!consultationId) {
    throw new Error('Consultation RPC did not return a consultation id.');
  }

  const { data, error } = await client.from('consultations').select('*').eq('id', consultationId).single();
  if (error) {
    throw error;
  }

  return mapConsultationRowToDomain(data as {
    id: string;
    appointment_id: string;
    patient_id: string;
    doctor_id: string;
    consultation_type: string | null;
    consultation_date: string | null;
    consultation_time: string | null;
    provider_name: string | null;
    clinical_summary: string | null;
    diagnosis: string | null;
    present_illness_history: string | null;
    review_of_symptoms: string | null;
    allergies: string | null;
    vitals: string | null;
    treatment_plan: string | null;
    medications: string | null;
    lab_results: string | null;
    differential_diagnosis: string | null;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    outcome: string | null;
    created_at: string;
    updated_at: string;
  });
}

function normalizePayload(payload: ConsultationSubmissionPayload): ConsultationSubmissionPayload {
  return {
    ...payload,
    consultationType: payload.consultationType.trim(),
    providerName: payload.providerName.trim(),
    clinicalSummary: payload.clinicalSummary.trim(),
    diagnosis: payload.diagnosis ? payload.diagnosis.trim() : '',
    presentIllnessHistory: payload.presentIllnessHistory.trim(),
    reviewOfSymptoms: payload.reviewOfSymptoms ? payload.reviewOfSymptoms.trim() : '',
    allergies: payload.allergies ? payload.allergies.trim() : '',
    vitals: payload.vitals ? payload.vitals.trim() : '',
    treatmentPlan: payload.treatmentPlan ? payload.treatmentPlan.trim() : '',
    medications: payload.medications ? payload.medications.trim() : '',
    labResults: payload.labResults ? payload.labResults.trim() : '',
    differentialDiagnosis: payload.differentialDiagnosis ? payload.differentialDiagnosis.trim() : '',
    subjective: payload.subjective ? payload.subjective.trim() : '',
    objective: payload.objective ? payload.objective.trim() : '',
    assessment: payload.assessment ? payload.assessment.trim() : '',
    plan: payload.plan ? payload.plan.trim() : '',
    outcome: payload.outcome ? payload.outcome.trim() : '',
    actor: payload.actor.trim(),
  };
}

export const consultationService = {
  async getConsultationContext(patientId: string, appointmentId?: string | null): Promise<ConsultationContext> {
    const appointments = await listAppointmentsByPatientIdLiveOrDemo(patientId);
    const consultations = await listConsultationsByPatientIdLiveOrDemo(patientId);

    const selectedAppointmentId = appointmentId ?? appointments[0]?.id ?? null;
    const appointment = selectedAppointmentId
      ? appointments.find((item) => item.id === selectedAppointmentId) ?? (await appointmentService.getAppointmentById(selectedAppointmentId))
      : null;

    return {
      patientId,
      appointmentId: selectedAppointmentId,
      appointment,
      appointments,
      consultations,
    };
  },

  validateConsultationPayload(payload: ConsultationSubmissionPayload): ConsultationValidationResult {
    const issues: ConsultationValidationIssue[] = [];

    if (!hasValue(payload.patientId)) {
      issues.push({ field: 'patientId', message: 'Patient context is required.' });
    }

    if (!hasValue(payload.presentIllnessHistory)) {
      issues.push({
        field: 'presentIllnessHistory',
        message: 'Patient history step requires present illness history.',
      });
    }

    if (!hasValue(payload.vitals) && !hasValue(payload.medications) && !hasValue(payload.labResults)) {
      issues.push({
        field: 'findings',
        message: 'Findings step requires at least one of vitals, medications, or lab results.',
      });
    }

    if (!hasValue(payload.diagnosis) && !hasValue(payload.differentialDiagnosis)) {
      issues.push({
        field: 'diagnoses',
        message: 'Diagnoses step requires at least one diagnosis or differential diagnosis.',
      });
    }

    if (!hasValue(payload.clinicalSummary)) {
      issues.push({
        field: 'clinicalSummary',
        message: 'Treatment and summary step requires a clinical summary.',
      });
    }

    if (!hasValue(payload.actor)) {
      issues.push({ field: 'actor', message: 'Actor is required for auditability.' });
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  },

  saveConsultationDraft(payload: ConsultationSubmissionPayload) {
    if (typeof window === 'undefined') {
      return;
    }

    const key = `consultation-draft:${payload.patientId}:${payload.appointmentId ?? 'walk-in'}`;
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...payload,
        savedAt: new Date().toISOString(),
      }),
    );
  },

  async submitConsultation(payload: ConsultationSubmissionPayload): Promise<Consultation> {
    const normalizedPayload = normalizePayload(payload);
    const validation = this.validateConsultationPayload(normalizedPayload);

    if (!validation.valid) {
      throw new ConsultationServiceError(
        'CONSULTATION_VALIDATION_FAILED',
        'Consultation cannot be submitted because one or more required steps are incomplete.',
        validation.issues,
      );
    }

    this.saveConsultationDraft(normalizedPayload);

    let effectiveAppointmentId = normalizedPayload.appointmentId;

    if (!effectiveAppointmentId) {
      const fallbackAppointment = await createAppointmentLiveOrDemo({
        patientId: normalizedPayload.patientId,
        doctorId: normalizedPayload.doctorId,
        specialtyId: null,
        serviceId: null,
        bookingId: null,
        scheduledAt: new Date(`${normalizedPayload.consultationDate}T${normalizedPayload.consultationTime}:00`).toISOString(),
        status: 'completed',
        source: 'internal',
        visitType: 'in_person',
        reason: normalizedPayload.consultationType || 'Manual consultation',
        notes: normalizedPayload.clinicalSummary || normalizedPayload.presentIllnessHistory || '',
        teleconsultationPlatform: null,
        teleconsultationUrl: null,
        teleconsultationAccessInstructions: null,
        consultationId: null,
        completedBy: normalizedPayload.actor,
        completedAt: new Date().toISOString(),
        deletedAt: null,
      } as never);

      effectiveAppointmentId = fallbackAppointment.id;
    }

    const consultationPayload: ConsultationSubmissionPayload = {
      ...normalizedPayload,
      appointmentId: effectiveAppointmentId,
    };

    if (isSupabaseConfigured) {
      if (consultationPayload.appointmentId) {
        try {
          return await submitConsultationWithRpc(consultationPayload);
        } catch (error) {
          if (!isRecoverableRpcError(error, 'complete_consultation_and_appointment')) {
            throw error;
          }
        }
      }
    }

    const consultation = await createConsultationLiveOrDemo(consultationPayload);

    if (consultationPayload.appointmentId) {
      await appointmentService.markAppointmentCompletedWithConsultation(
        consultationPayload.appointmentId,
        consultation.id,
        consultationPayload.actor,
      );
    }

    await transactionService.createConsultationTransaction({
      consultationId: consultation.id,
      appointmentId: consultationPayload.appointmentId,
      patientId: consultationPayload.patientId,
      providerId: consultationPayload.doctorId,
      consultationType: consultationPayload.consultationType,
      amount: Number(getDatabase().users.find((user) => user.id === consultationPayload.doctorId)?.consultationFee ?? 0),
      actor: consultationPayload.actor,
    });

    return consultation;
  },
};
