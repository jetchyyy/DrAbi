import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useDoctorDirectory } from '../../hooks/use-clinic-data';
import { formatDateLabel } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useCreateReferral } from '../referrals/hooks/use-referrals';
import { 
  useCreateConsultation, 
  usePatientAppointments, 
  usePatientConsultations, 
  usePatientDetail 
} from '../patients/hooks/use-patients';

const consultationSchema = z.object({
  appointmentId: z.string().optional(),
  consultationType: z.string().min(2, 'Consultation type is required'),
  consultationDate: z.string().min(1, 'Consultation date is required'),
  consultationTime: z.string().min(1, 'Consultation time is required'),
  providerName: z.string().min(2, 'Provider name is required'),
  
  // Step 1: Patient History
  presentIllnessHistory: z.string().min(4, 'Present illness history is required'),
  reviewOfSymptoms: z.string().optional(),
  allergies: z.string().optional(),
  referToSpecialist: z.boolean(),
  specialistDoctorId: z.string().optional(),
  specialistReason: z.string().optional(),
  specialistNotes: z.string().optional(),
  
  // Step 2: Findings
  vitals: z.string().optional(),
  medications: z.string().optional(),
  labResults: z.string().optional(),
  
  // Step 3: Diagnoses
  diagnosis: z.string().optional(),
  differentialDiagnosis: z.string().optional(),
  
  // Step 4: Clinical Assessment (SOAP)
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  
  // Step 5: Treatment & Summary
  clinicalSummary: z.string().min(4, 'Clinical summary is required'),
  treatmentPlan: z.string().optional(),
  outcome: z.string().optional(),
}).superRefine((values, context) => {
  if (values.referToSpecialist && !values.specialistDoctorId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['specialistDoctorId'],
      message: 'Please choose a specialist to refer this patient to.',
    });
  }
});

type ConsultationFormData = z.infer<typeof consultationSchema>;

interface Step {
  id: string;
  title: string;
  description: string;
  fields: (keyof ConsultationFormData)[];
}

const CONSULTATION_STEPS: Step[] = [
  {
    id: 'appointment',
    title: 'Appointment & Consultation Info',
    description: 'Select appointment and start consultation details',
    fields: ['consultationType', 'consultationDate', 'consultationTime', 'providerName'],
  },
  {
    id: 'history',
    title: 'Patient History',
    description: 'Document present illness, symptoms, and allergies',
    fields: ['presentIllnessHistory', 'reviewOfSymptoms', 'allergies'],
  },
  {
    id: 'findings',
    title: 'Clinical Findings',
    description: 'Record vitals, medications, and lab results',
    fields: ['vitals', 'medications', 'labResults'],
  },
  {
    id: 'diagnoses',
    title: 'Diagnoses',
    description: 'Primary and differential diagnoses',
    fields: ['diagnosis', 'differentialDiagnosis'],
  },
  {
    id: 'assessment',
    title: 'Clinical Assessment',
    description: 'SOAP notes: Subjective, Objective, Assessment, Plan',
    fields: ['subjective', 'objective', 'assessment', 'plan'],
  },
  {
    id: 'summary',
    title: 'Treatment & Summary',
    description: 'Clinical summary, treatment plan, and outcome',
    fields: ['clinicalSummary', 'treatmentPlan', 'outcome'],
  },
];

export function ConsultationEntryPage() {
  const { patientId = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: doctors = [] } = useDoctorDirectory();
  
  const patientQuery = usePatientDetail(patientId || null);
  const { data: patient } = patientQuery;
  const { data: visits = [] } = usePatientAppointments(patientId || null);
  const { data: consultations = [] } = usePatientConsultations(patientId || null);
  
  const createConsultation = useCreateConsultation();
  const createReferral = useCreateReferral(patientId || null);
  const currentDoctor = doctors.find((doctor) => doctor.profileId === profile?.id);
  const assignableDoctors = doctors.filter((doctor) => doctor.id !== currentDoctor?.id);
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = CONSULTATION_STEPS[currentStepIndex];
  
  const consultationAppointmentIds = new Set(consultations.map((consultation: any) => consultation.appointmentId));
  const pendingSoapVisits = visits.filter((visit: any) => !consultationAppointmentIds.has(visit.id));
  
  const form = useForm<ConsultationFormData>({
    resolver: zodResolver(consultationSchema),
    mode: 'onBlur',
    defaultValues: {
      appointmentId: '',
      consultationType: 'Initial Consultation',
      consultationDate: new Date().toISOString().slice(0, 10),
      consultationTime: new Date().toISOString().slice(11, 16),
      providerName: profile?.fullName ?? '',
      presentIllnessHistory: '',
      reviewOfSymptoms: '',
      allergies: patient?.allergies ?? '',
      referToSpecialist: false,
      specialistDoctorId: '',
      specialistReason: '',
      specialistNotes: '',
      vitals: '',
      medications: '',
      labResults: '',
      diagnosis: '',
      differentialDiagnosis: '',
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      clinicalSummary: '',
      treatmentPlan: '',
      outcome: 'For follow-up monitoring.',
    },
  });

  useEffect(() => {
    if (patient?.allergies && !form.getValues('allergies')) {
      form.setValue('allergies', patient.allergies);
    }
  }, [patient, form]);

  if (patientQuery.isLoading) {
    return (
      <Card>
        <CardTitle>Loading patient record...</CardTitle>
      </Card>
    );
  }

  if (!patient) {
    return (
      <Card>
        <CardTitle>Patient not found</CardTitle>
      </Card>
    );
  }

  const selectedAppointmentId = form.watch('appointmentId');
  const selectedAppointment = visits.find((visit: any) => visit.id === selectedAppointmentId) ?? null;
  
  const soapDoctorId = currentDoctor?.id ?? selectedAppointment?.doctorId ?? profile?.id ?? 'user_owner';

  const canProceedToNext = async () => {
    const fieldsToValidate = currentStep.fields as string[];
    const result = await form.trigger(fieldsToValidate as any[]);
    return result;
  };

  const handleNext = async () => {
    const canProceed = await canProceedToNext();
    if (canProceed && currentStepIndex < CONSULTATION_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const consultation = await createConsultation.mutateAsync({
        appointmentId: selectedAppointmentId || null,
        patientId: patient.id,
        doctorId: soapDoctorId,
        actor: profile?.id ?? soapDoctorId,
        consultationType: values.consultationType,
        consultationDate: values.consultationDate,
        consultationTime: values.consultationTime,
        providerName: values.providerName,
        clinicalSummary: values.clinicalSummary,
        diagnosis: values.diagnosis,
        presentIllnessHistory: values.presentIllnessHistory,
        reviewOfSymptoms: values.reviewOfSymptoms,
        allergies: values.allergies,
        vitals: values.vitals,
        treatmentPlan: values.treatmentPlan,
        medications: values.medications,
        labResults: values.labResults,
        differentialDiagnosis: values.differentialDiagnosis,
        subjective: values.subjective,
        objective: values.objective,
        assessment: values.assessment,
        plan: values.plan,
        outcome: values.outcome,
      });

      toast.success('Consultation saved successfully!');

      if (values.referToSpecialist && values.specialistDoctorId) {
        await createReferral.mutateAsync({
          patientId: patient.id,
          appointmentId: consultation.appointmentId,
          referringDoctorId: soapDoctorId,
          targetDoctorId: values.specialistDoctorId,
          targetSpecialtyId: doctors.find((doctor) => doctor.id === values.specialistDoctorId)?.specialtyId ?? null,
          reason: values.specialistReason?.trim() || values.diagnosis || values.consultationType,
          clinicalSummary: values.clinicalSummary,
          referralNotes: values.specialistNotes?.trim() || values.outcome || '',
        });

        toast.success('Specialist referral created.');
      }

      setTimeout(() => {
        navigate(`/app/patients/${patientId}`);
      }, 1500);
    } catch (error) {
      console.error('Consultation submission error:', error);
      if (error instanceof Error && error.message.includes('incomplete')) {
        toast.error('Please complete all required fields in each step.');
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to save consultation.');
      }
    }
  });

  const stepFields: Record<string, { label: string; placeholder: string; required: boolean }> = {
    appointmentId: {
      label: 'Select Appointment',
      placeholder: 'Optional: choose a pending appointment',
      required: false,
    },
    consultationType: {
      label: 'Consultation Type',
      placeholder: 'e.g., Initial Consultation, Follow-up',
      required: true,
    },
    consultationDate: {
      label: 'Consultation Date',
      placeholder: 'YYYY-MM-DD',
      required: true,
    },
    consultationTime: {
      label: 'Consultation Time',
      placeholder: 'HH:MM',
      required: true,
    },
    providerName: {
      label: 'Provider Name',
      placeholder: 'Your full name',
      required: true,
    },
    presentIllnessHistory: {
      label: 'Present Illness History',
      placeholder: 'Describe the patient\'s current illness, onset, and progression...',
      required: true,
    },
    reviewOfSymptoms: {
      label: 'Review of Symptoms',
      placeholder: 'Document symptoms review...',
      required: false,
    },
    allergies: {
      label: 'Allergies',
      placeholder: 'Known allergies and reactions...',
      required: false,
    },
    referToSpecialist: {
      label: 'Refer to Specialist',
      placeholder: '',
      required: false,
    },
    specialistDoctorId: {
      label: 'Specialist',
      placeholder: 'Choose a specialist',
      required: false,
    },
    specialistReason: {
      label: 'Referral Reason',
      placeholder: 'Why is the patient being referred?',
      required: false,
    },
    specialistNotes: {
      label: 'Referral Notes',
      placeholder: 'Additional notes for the specialist...',
      required: false,
    },
    vitals: {
      label: 'Vitals',
      placeholder: 'BP, HR, RR, Temperature, O2 sat, etc.',
      required: false,
    },
    medications: {
      label: 'Current Medications',
      placeholder: 'List current medications...',
      required: false,
    },
    labResults: {
      label: 'Lab Results',
      placeholder: 'Recent relevant lab findings...',
      required: false,
    },
    diagnosis: {
      label: 'Primary Diagnosis',
      placeholder: 'Main diagnosis...',
      required: false,
    },
    differentialDiagnosis: {
      label: 'Differential Diagnosis',
      placeholder: 'Other diagnostic considerations...',
      required: false,
    },
    subjective: {
      label: 'Subjective (S)',
      placeholder: 'Patient\'s report of symptoms and concerns...',
      required: false,
    },
    objective: {
      label: 'Objective (O)',
      placeholder: 'Measurable findings, vitals, exam results...',
      required: false,
    },
    assessment: {
      label: 'Assessment (A)',
      placeholder: 'Clinical impression and interpretation...',
      required: false,
    },
    plan: {
      label: 'Plan (P)',
      placeholder: 'Treatment plan and next steps...',
      required: false,
    },
    clinicalSummary: {
      label: 'Clinical Summary',
      placeholder: 'Provide a comprehensive summary of the consultation...',
      required: true,
    },
    treatmentPlan: {
      label: 'Treatment Plan',
      placeholder: 'Detailed treatment recommendations...',
      required: false,
    },
    outcome: {
      label: 'Consultation Outcome',
      placeholder: 'Expected outcome and follow-up notes...',
      required: false,
    },
  };

  const isLastStep = currentStepIndex === CONSULTATION_STEPS.length - 1;
  const isFirstStep = currentStepIndex === 0;

  return (
    <div className="space-y-6">
      {/* Patient Header Card */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Patient Record</p>
            <CardTitle className="mt-2 text-3xl">
              {patient.firstName} {patient.lastName}
            </CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              {patient.email} • {patient.mobileNumber}
            </p>
            {patient.birthDate && (
              <p className="mt-1 text-sm text-slate-500">
                DOB: {formatDateLabel(patient.birthDate)}
              </p>
            )}
          </div>
          <Badge className="text-sm bg-blue-100 text-blue-800 border-blue-200">
            Consultation Entry
          </Badge>
        </div>
      </Card>

      {/* Progress Indicator */}
      <Card>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-slate-700">
              Step {currentStepIndex + 1} of {CONSULTATION_STEPS.length}
            </h3>
            <div className="mt-3 flex gap-2">
              {CONSULTATION_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    index < currentStepIndex
                      ? 'bg-emerald-500'
                      : index === currentStepIndex
                        ? 'bg-blue-500'
                        : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900">{currentStep.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{currentStep.description}</p>
          </div>
        </div>
      </Card>

      {/* Form Content */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {currentStep.id === 'appointment' && (
            <div className="space-y-4">
              {/* Appointment Selection */}
              <FormField
                label={stepFields.appointmentId.label}
                error={form.formState.errors.appointmentId?.message}
              >
                <select
                  {...form.register('appointmentId')}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">No appointment linked</option>
                  {pendingSoapVisits.map((visit: any) => (
                    <option key={visit.id} value={visit.id}>
                      {formatDateLabel(visit.appointmentDate)} at {visit.timeSlot} - {visit.type ?? 'Consultation'}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">You can save this consultation without linking it to an appointment.</p>
              </FormField>

              <FormField
                label={`${stepFields.consultationType.label} *`}
                error={form.formState.errors.consultationType?.message}
              >
                <input
                  type="text"
                  {...form.register('consultationType')}
                  placeholder={stepFields.consultationType.placeholder}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label={`${stepFields.consultationDate.label} *`}
                  error={form.formState.errors.consultationDate?.message}
                >
                  <input
                    type="date"
                    {...form.register('consultationDate')}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </FormField>

                <FormField
                  label={`${stepFields.consultationTime.label} *`}
                  error={form.formState.errors.consultationTime?.message}
                >
                  <input
                    type="time"
                    {...form.register('consultationTime')}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </FormField>
              </div>

              <FormField
                label={`${stepFields.providerName.label} *`}
                error={form.formState.errors.providerName?.message}
              >
                <input
                  type="text"
                  {...form.register('providerName')}
                  placeholder={stepFields.providerName.placeholder}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>
            </div>
          )}

          {currentStep.id === 'history' && (
            <div className="space-y-4">
              <FormField
                label={`${stepFields.presentIllnessHistory.label} *`}
                error={form.formState.errors.presentIllnessHistory?.message}
              >
                <Textarea
                  {...form.register('presentIllnessHistory')}
                  placeholder={stepFields.presentIllnessHistory.placeholder}
                  rows={5}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <FormField
                label={stepFields.reviewOfSymptoms.label}
                error={form.formState.errors.reviewOfSymptoms?.message}
              >
                <Textarea
                  {...form.register('reviewOfSymptoms')}
                  placeholder={stepFields.reviewOfSymptoms.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <FormField
                label={stepFields.allergies.label}
                error={form.formState.errors.allergies?.message}
              >
                <Textarea
                  {...form.register('allergies')}
                  placeholder={stepFields.allergies.placeholder}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>
            </div>
          )}

          {currentStep.id === 'findings' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-700">At least one finding (vitals, medications, or lab results) is required.</p>
                </div>
              </div>

              <FormField
                label={stepFields.vitals.label}
                error={form.formState.errors.vitals?.message}
              >
                <Textarea
                  {...form.register('vitals')}
                  placeholder={stepFields.vitals.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <FormField
                label={stepFields.medications.label}
                error={form.formState.errors.medications?.message}
              >
                <Textarea
                  {...form.register('medications')}
                  placeholder={stepFields.medications.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <FormField
                label={stepFields.labResults.label}
                error={form.formState.errors.labResults?.message}
              >
                <Textarea
                  {...form.register('labResults')}
                  placeholder={stepFields.labResults.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>
            </div>
          )}

          {currentStep.id === 'diagnoses' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-700">At least one diagnosis type (primary or differential) is required.</p>
                </div>
              </div>

              <FormField
                label={stepFields.diagnosis.label}
                error={form.formState.errors.diagnosis?.message}
              >
                <Textarea
                  {...form.register('diagnosis')}
                  placeholder={stepFields.diagnosis.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <FormField
                label={stepFields.differentialDiagnosis.label}
                error={form.formState.errors.differentialDiagnosis?.message}
              >
                <Textarea
                  {...form.register('differentialDiagnosis')}
                  placeholder={stepFields.differentialDiagnosis.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>
            </div>
          )}

          {currentStep.id === 'assessment' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Complete the SOAP notes structure for clinical documentation.
              </p>

              <FormField
                label={stepFields.subjective.label}
                error={form.formState.errors.subjective?.message}
              >
                <Textarea
                  {...form.register('subjective')}
                  placeholder={stepFields.subjective.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <FormField
                label={stepFields.objective.label}
                error={form.formState.errors.objective?.message}
              >
                <Textarea
                  {...form.register('objective')}
                  placeholder={stepFields.objective.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <FormField
                label={stepFields.assessment.label}
                error={form.formState.errors.assessment?.message}
              >
                <Textarea
                  {...form.register('assessment')}
                  placeholder={stepFields.assessment.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <FormField
                label={stepFields.plan.label}
                error={form.formState.errors.plan?.message}
              >
                <Textarea
                  {...form.register('plan')}
                  placeholder={stepFields.plan.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>
            </div>
          )}

          {currentStep.id === 'summary' && (
            <div className="space-y-4">
              <FormField
                label={`${stepFields.clinicalSummary.label} *`}
                error={form.formState.errors.clinicalSummary?.message}
              >
                <Textarea
                  {...form.register('clinicalSummary')}
                  placeholder={stepFields.clinicalSummary.placeholder}
                  rows={5}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <FormField
                label={stepFields.treatmentPlan.label}
                error={form.formState.errors.treatmentPlan?.message}
              >
                <Textarea
                  {...form.register('treatmentPlan')}
                  placeholder={stepFields.treatmentPlan.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <FormField
                label={stepFields.outcome.label}
                error={form.formState.errors.outcome?.message}
              >
                <Textarea
                  {...form.register('outcome')}
                  placeholder={stepFields.outcome.placeholder}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </FormField>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    {...form.register('referToSpecialist')}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0 flex-1 space-y-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Refer to specialist after saving</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Create a referral from this consultation before returning to the patient chart.
                      </p>
                    </div>

                    {form.watch('referToSpecialist') ? (
                      <>
                        <FormField
                          label={stepFields.specialistDoctorId.label}
                          error={form.formState.errors.specialistDoctorId?.message}
                        >
                          <Select {...form.register('specialistDoctorId')}>
                            <option value="">Select specialist</option>
                            {assignableDoctors.map((doctor) => (
                              <option key={doctor.id} value={doctor.id}>
                                {doctor.fullName}{doctor.specialtyName ? ` (${doctor.specialtyName})` : ''}
                              </option>
                            ))}
                          </Select>
                        </FormField>

                        <FormField
                          label={stepFields.specialistReason.label}
                          error={form.formState.errors.specialistReason?.message}
                        >
                          <Textarea
                            {...form.register('specialistReason')}
                            placeholder={stepFields.specialistReason.placeholder}
                            rows={3}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                          />
                        </FormField>

                        <FormField
                          label={stepFields.specialistNotes.label}
                          error={form.formState.errors.specialistNotes?.message}
                        >
                          <Textarea
                            {...form.register('specialistNotes')}
                            placeholder={stepFields.specialistNotes.placeholder}
                            rows={3}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                          />
                        </FormField>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 border-t border-slate-200 pt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={handlePrevious}
              disabled={isFirstStep}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {isLastStep ? (
              <Button
                type="submit"
                disabled={createConsultation.isPending}
                className="ml-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                {createConsultation.isPending ? 'Submitting...' : 'Save Consultation'}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                className="ml-auto flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
