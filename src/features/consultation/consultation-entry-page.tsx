import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Camera, ChevronLeft, ChevronRight, CheckCircle2, ImagePlus, StopCircle, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useProviderDirectory } from '../../hooks/use-clinic-data';
import { formatDateLabel, formatDateTimeLabel } from '../../lib/utils';
import { getHomePathForRole } from '../../lib/role-routing';
import type { Booking } from '../../types/domain';
import { useAuth } from '../auth/auth-context';
import { useCreateReferral } from '../referrals/hooks/use-referrals';
import { validatePatientConsultationAccess } from './services/consultation-access-service';
import { serializeLabResultsContent, type LabResultImageRecord } from './lab-results-media';
import { AppointmentLabRequestsCard } from '../lab-requests/components/appointment-lab-requests-card';
import { 
  useCreateConsultation, 
  usePatientAppointments, 
  usePatientBookings,
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: providers = [] } = useProviderDirectory();
  
  const patientQuery = usePatientDetail(patientId || null);
  const { data: patient } = patientQuery;
  const { data: visits = [] } = usePatientAppointments(patientId || null);
  const { data: bookings = [] } = usePatientBookings(patientId || null);
  const { data: consultations = [] } = usePatientConsultations(patientId || null);
  
  const createConsultation = useCreateConsultation();
  const createReferral = useCreateReferral(patientId || null);
  const currentDoctor = providers.find((doctor) => doctor.profileId === profile?.id);
  const assignableDoctors = providers.filter(
    (doctor) =>
      doctor.role === 'specialist' &&
      doctor.id !== currentDoctor?.id &&
      doctor.profileId !== profile?.id,
  );
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [accessState, setAccessState] = useState<'checking' | 'allowed' | 'blocked' | 'error'>('checking');
  const [accessError, setAccessError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [labResultImages, setLabResultImages] = useState<LabResultImageRecord[]>([]);
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'unsupported' | 'denied'>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const [blockingAlert, setBlockingAlert] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: '', message: '' });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentStep = CONSULTATION_STEPS[currentStepIndex];
  
  const consultationAppointmentIds = new Set(consultations.map((consultation: any) => consultation.appointmentId));
  const pendingSoapVisits = visits.filter((visit: any) => !consultationAppointmentIds.has(visit.id));
  const activeConsultationBookings = bookings.filter((booking: any) => booking.status !== 'cancelled');
  
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

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraState((current) => (current === 'unsupported' ? current : 'idle'));
    setCameraMessage('');
  };

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    if (cameraState !== 'requesting' && cameraState !== 'active') {
      return;
    }

    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;
    void video.play().catch(() => {
      setCameraMessage('Camera is ready. Tap Start camera again if preview does not appear.');
    });
  }, [cameraState]);

  useEffect(() => {
    if (!patientId) {
      return;
    }

    if (profile?.role === 'specialist') {
      setAccessState('allowed');
      setAccessError('');
      return;
    }

    let isCancelled = false;

    void (async () => {
      setAccessState('checking');
      setAccessError('');

      const access = await validatePatientConsultationAccess(patientId);
      if (isCancelled) {
        return;
      }

      if (!access.allowed) {
        if (access.reason === 'unpaid_balance' || access.reason === 'no_invoice') {
          setBlockingAlert({
            open: true,
            title: 'Unpaid Balance',
            message: access.message,
          });
          setAccessState('blocked');
          return;
        }

        setAccessState('error');
        setAccessError(access.message);
        return;
      }

      const requestedAppointmentId = searchParams.get('appointmentId');
      const nextAppointmentId = requestedAppointmentId || access.appointmentId;
      if (nextAppointmentId && !form.getValues('appointmentId')) {
        form.setValue('appointmentId', nextAppointmentId);
      }

      setAccessState('allowed');
    })();

    return () => {
      isCancelled = true;
    };
  }, [patientId, profile?.role, retryToken, searchParams, form]);

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

  if (accessState === 'checking') {
    return (
      <Card>
        <CardTitle>Validating latest payment status...</CardTitle>
        <p className="mt-2 text-sm text-slate-500">
          Please wait while we verify the latest invoice and prepare the appointment for consultation.
        </p>
      </Card>
    );
  }

  if (accessState === 'error') {
    return (
      <Card>
        <CardTitle>Payment validation unavailable</CardTitle>
        <p className="mt-2 text-sm text-rose-600">{accessError}</p>
        <div className="mt-4 flex gap-3">
          <Button type="button" onClick={() => setRetryToken((value) => value + 1)}>
            Retry validation
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(getHomePathForRole(profile?.role))}>
            Back to appointment queue
          </Button>
        </div>
      </Card>
    );
  }

  if (accessState === 'blocked') {
    return (
      <>
        <FeedbackModal
          open={blockingAlert.open}
          title={blockingAlert.title}
          message={blockingAlert.message}
          variant="error"
          autoCloseMs={120000}
          onClose={() => {
            setBlockingAlert({ open: false, title: '', message: '' });
            void navigate(getHomePathForRole(profile?.role));
          }}
        />
        <Card>
          <CardTitle>Consultation blocked</CardTitle>
          <p className="mt-2 text-sm text-slate-500">
            This consultation cannot proceed until the latest invoice is paid.
          </p>
        </Card>
      </>
    );
  }

  const selectedAppointmentId = form.watch('appointmentId');
  const selectedAppointment = visits.find((visit: any) => visit.id === selectedAppointmentId) ?? null;
  const latestBookingWithDoctor = activeConsultationBookings.find((booking: any) => Boolean(booking.doctorId));
  
  const soapDoctorId = currentDoctor?.id ?? selectedAppointment?.doctorId ?? latestBookingWithDoctor?.doctorId ?? profile?.id ?? 'user_owner';

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
        labResults: serializeLabResultsContent({
          summary: values.labResults ?? '',
          images: labResultImages,
        }),
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
          targetSpecialtyId: providers.find((doctor) => doctor.id === values.specialistDoctorId)?.specialtyId ?? null,
          reason: values.specialistReason?.trim() || values.diagnosis || values.consultationType,
          clinicalSummary: values.clinicalSummary,
          referralNotes: values.specialistNotes?.trim() || values.outcome || '',
        });

        toast.success('Specialist referral created.');
      }

      setTimeout(() => {
        const patientRoutePrefix = profile?.role === 'specialist' ? '/specialist/patients' : '/app/patients';
        navigate(`${patientRoutePrefix}/${patientId}`);
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

  const addImageAttachment = (image: Omit<LabResultImageRecord, 'id'>) => {
    setLabResultImages((current) => [
      ...current,
      {
        ...image,
        id: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      },
    ]);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      setCameraMessage('This device or browser does not support camera access.');
      return;
    }

    stopCamera();
    setCameraState('requesting');
    setCameraMessage('Requesting camera permission...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;
      setCameraState('active');
      setCameraMessage('Camera ready. Position the lab result document inside the frame.');
    } catch {
      setCameraState('denied');
      setCameraMessage('Camera permission was denied. You can still upload an image file instead.');
    }
  };

  const captureCameraImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error('Camera preview is not ready yet.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      toast.error('Unable to capture the camera image.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    addImageAttachment({
      name: `Lab result capture ${labResultImages.length + 1}.jpg`,
      dataUrl,
      mimeType: 'image/jpeg',
    });
    toast.success('Lab result image captured.');
  };

  const handleLabImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    try {
      const images = await Promise.all(
        files
          .filter((file) => file.type.startsWith('image/'))
          .map(
            (file) =>
              new Promise<Omit<LabResultImageRecord, 'id'>>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result !== 'string') {
                    reject(new Error('Unable to read the selected file.'));
                    return;
                  }

                  resolve({
                    name: file.name,
                    dataUrl: reader.result,
                    mimeType: file.type || 'image/*',
                  });
                };
                reader.onerror = () => reject(new Error('Unable to read the selected file.'));
                reader.readAsDataURL(file);
              }),
          ),
      );

      if (images.length === 0) {
        toast.error('Please choose an image file.');
        return;
      }

      setLabResultImages((current) => [
        ...current,
        ...images.map((image, index) => ({
          ...image,
          id: `${Date.now()}-${index}-${crypto.randomUUID().slice(0, 8)}`,
        })),
      ]);
      toast.success(`${images.length} lab result image${images.length > 1 ? 's' : ''} added.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to upload the selected image.');
    } finally {
      event.target.value = '';
    }
  };

  const removeLabImage = (imageId: string) => {
    setLabResultImages((current) => current.filter((image) => image.id !== imageId));
  };

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
                      {formatDateTimeLabel(visit.scheduledAt)} - {visit.reason}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">You can save this consultation without linking it to an appointment.</p>
              </FormField>

              {activeConsultationBookings.length > 0 && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                  <p className="text-sm font-medium text-sky-900">Active booking requests</p>
                  <ul className="mt-2 space-y-1">
                    {activeConsultationBookings.map((booking: Booking) => (
                      <li key={booking.id} className="text-xs text-sky-700">
                        {booking.preferredDate} at {booking.preferredTime} — {booking.intakeNotes || 'General consultation'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
                <div className="space-y-4">
                  <Textarea
                    {...form.register('labResults')}
                    placeholder={stepFields.labResults.placeholder}
                    rows={4}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Attach lab result image</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Capture from camera or upload an image file. Saved images will also be visible in the patient history.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button className="gap-2" onClick={() => void startCamera()} type="button" variant="secondary">
                          <Camera className="size-4" />
                          {cameraState === 'active' ? 'Restart camera' : 'Start camera'}
                        </Button>
                        {cameraState === 'active' ? (
                          <>
                            <Button className="gap-2" onClick={captureCameraImage} type="button">
                              <ImagePlus className="size-4" />
                              Capture image
                            </Button>
                            <Button className="gap-2" onClick={stopCamera} type="button" variant="secondary">
                              <StopCircle className="size-4" />
                              Stop camera
                            </Button>
                          </>
                        ) : null}
                        <Button className="gap-2" onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">
                          <Upload className="size-4" />
                          Upload file
                        </Button>
                      </div>
                    </div>

                    <input
                      accept="image/*"
                      className="hidden"
                      multiple
                      onChange={handleLabImageUpload}
                      ref={fileInputRef}
                      type="file"
                    />

                    {cameraMessage ? (
                      <p className="mt-3 text-sm text-slate-600">{cameraMessage}</p>
                    ) : null}

                    {cameraState === 'requesting' || cameraState === 'active' ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-black">
                        <video className="aspect-video w-full object-cover" muted playsInline ref={videoRef} />
                        <canvas className="hidden" ref={canvasRef} />
                      </div>
                    ) : null}

                    {labResultImages.length > 0 ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {labResultImages.map((image) => (
                          <div key={image.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <img alt={image.name} className="aspect-[4/3] w-full object-cover" src={image.dataUrl} />
                            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2">
                              <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">{image.name}</p>
                              <button
                                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                                onClick={() => removeLabImage(image.id)}
                                type="button"
                              >
                                <Trash2 className="size-3.5" />
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
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

      <AppointmentLabRequestsCard
        appointmentId={selectedAppointmentId || null}
        canCreate={Boolean(selectedAppointmentId && (profile?.role === 'doctor' || profile?.role === 'owner_admin'))}
        patientId={patient.id}
        requestedBy={profile?.id ?? soapDoctorId}
        title="Appointment lab requests"
      />
    </div>
  );
}
