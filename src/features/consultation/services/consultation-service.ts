import { getDatabase } from '../../../lib/local-db';
import { createConsultationLiveOrDemo, listAppointmentsByPatientIdLiveOrDemo, listConsultationsByPatientIdLiveOrDemo } from '../../../lib/supabase-clinic';
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

    if (!hasValue(payload.appointmentId)) {
      issues.push({ field: 'appointmentId', message: 'Appointment context is required.' });
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

    const key = `consultation-draft:${payload.patientId}:${payload.appointmentId}`;
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

    const consultation = await createConsultationLiveOrDemo(normalizedPayload);

    await appointmentService.markAppointmentCompletedWithConsultation(
      normalizedPayload.appointmentId,
      consultation.id,
      normalizedPayload.actor,
    );

    await transactionService.createConsultationTransaction({
      consultationId: consultation.id,
      appointmentId: normalizedPayload.appointmentId,
      patientId: normalizedPayload.patientId,
      providerId: normalizedPayload.doctorId,
      consultationType: normalizedPayload.consultationType,
      amount: Number(getDatabase().users.find((user) => user.id === normalizedPayload.doctorId)?.consultationFee ?? 0),
      actor: normalizedPayload.actor,
    });

    if (isSupabaseConfigured) {
      const client = requireSupabaseClient();
      const { error } = await client.from('patient_medical_history_entries').insert({
        patient_id: normalizedPayload.patientId,
        consultation_id: consultation.id,
        appointment_id: normalizedPayload.appointmentId,
        provider_id: normalizedPayload.doctorId,
        history_text: normalizedPayload.presentIllnessHistory,
        findings_text: [normalizedPayload.vitals, normalizedPayload.medications, normalizedPayload.labResults].filter(hasValue).join('\n'),
        diagnoses_text: [normalizedPayload.diagnosis, normalizedPayload.differentialDiagnosis].filter(hasValue).join('\n'),
        treatment_summary_text: normalizedPayload.clinicalSummary,
        soap_notes_text: [
          normalizedPayload.subjective,
          normalizedPayload.objective,
          normalizedPayload.assessment,
          normalizedPayload.plan,
        ]
          .filter(hasValue)
          .join('\n'),
        supplementary_docs_text: normalizedPayload.reviewOfSymptoms,
        actor: normalizedPayload.actor,
      } as never);

      if (error) {
        throw error;
      }
    }

    return consultation;
  },
};
