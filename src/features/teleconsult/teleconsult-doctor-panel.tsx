import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  FlaskConical,
  Loader2,
  Pill,
  Plus,
  Printer,
  Stethoscope,
  Thermometer,
  Trash2,
  Wind,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useClinicSettingsData, useProviderDirectory } from '../../hooks/use-clinic-data';
import { evaluateVitalsAlerts } from '../../lib/vitals-alerts';
import { printHtmlDocument } from '../../lib/print';
import { formatDateLabel } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { buildLabRequestPrintDocument } from '../lab-requests/lab-request-print-document';
import {
  useCreateConsultation,
  useCreateMedicalCertificate,
  useCreatePrescription,
  usePatientConsultations,
  usePatientDetail,
} from '../patients/hooks/use-patients';
import { buildMedicalCertificatePrintDocument } from '../patients/medical-certificate-print-document';
import { buildPrescriptionPrintDocument } from '../patients/prescription-print-document';
import type { TeleconsultAppointmentSummary } from './teleconsult-data';

// ── Schemas ───────────────────────────────────────────────────────────────────

const vitalsSchema = z.object({
  temperature: z.string().optional(),
  bloodPressure: z.string().optional(),
  heartRate: z.string().optional(),
  o2Sat: z.string().optional(),
  respiratoryRate: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
});

const consultationSchema = z.object({
  consultationType: z.string().min(2, 'Required'),
  // Step 1 – Vitals (from vitalsSchema)
  temperature: z.string().optional(),
  bloodPressure: z.string().optional(),
  heartRate: z.string().optional(),
  o2Sat: z.string().optional(),
  respiratoryRate: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  // Step 2 – History
  presentIllnessHistory: z.string().min(4, 'Chief complaint is required'),
  reviewOfSymptoms: z.string().optional(),
  allergies: z.string().optional(),
  // Step 3 – Diagnosis
  diagnosis: z.string().optional(),
  differentialDiagnosis: z.string().optional(),
  // Step 4 – SOAP
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  // Step 5 – Summary
  clinicalSummary: z.string().min(4, 'Clinical summary is required'),
  treatmentPlan: z.string().optional(),
  outcome: z.string().optional(),
});

const medCertSchema = z.object({
  certificatePurpose: z.string().min(2, 'Purpose is required'),
  diagnosis: z.string().min(2, 'Diagnosis is required'),
  recommendation: z.string().min(2, 'Recommendation is required'),
  restFrom: z.string().optional(),
  restUntil: z.string().optional(),
  checkWork: z.boolean().optional(),
  checkSchool: z.boolean().optional(),
  checkFinancial: z.boolean().optional(),
});

type ConsultationFormData = z.infer<typeof consultationSchema>;
type MedCertFormData = z.infer<typeof medCertSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'consultation' | 'prescription' | 'medcert' | 'labrequest';

interface DraftMedication {
  id: string;
  genericName: string;
  brandName: string;
  dosage: string;
  instruction: string;
  numberOfMedications: string;
}

interface DoctorPanelProps {
  appointment: TeleconsultAppointmentSummary;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONSULTATION_STEPS = [
  { id: 'vitals', title: 'Vitals', description: 'Record patient vitals for this teleconsult' },
  { id: 'history', title: 'Patient History', description: 'Chief complaint, symptoms, and allergies' },
  { id: 'diagnosis', title: 'Diagnosis', description: 'Primary and differential diagnoses' },
  { id: 'soap', title: 'SOAP Assessment', description: 'Subjective · Objective · Assessment · Plan' },
  { id: 'summary', title: 'Summary & Plan', description: 'Clinical summary and treatment plan' },
] as const;

type StepId = (typeof CONSULTATION_STEPS)[number]['id'];

function getManilaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

function getManilaTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

function calcAge(birthDate: string): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return String(age);
}

function buildVitalsText(v: z.infer<typeof vitalsSchema>) {
  const lines: string[] = [];
  if (v.temperature) lines.push(`Temperature: ${v.temperature} C`);
  if (v.bloodPressure) lines.push(`Blood Pressure: ${v.bloodPressure} mmHg`);
  if (v.heartRate) lines.push(`Heart Rate: ${v.heartRate} bpm`);
  if (v.o2Sat) lines.push(`O2sat: ${v.o2Sat} %`);
  if (v.respiratoryRate) lines.push(`Respiratory Rate: ${v.respiratoryRate} breaths/min`);
  if (v.weight) lines.push(`Weight: ${v.weight} kg`);
  if (v.height) lines.push(`Height: ${v.height} cm`);
  return lines.join('\n');
}

// ── Small shared UI ───────────────────────────────────────────────────────────

function FL({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
      {children}{required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
  );
}

function FE({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1"><XCircle className="size-3" />{message}</p>;
}

function SC({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">{children}</div>;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{children}</p>;
}

/** Vital alert badge — uses semantic colours only (no primary) */
function VitalBadge({ level, status }: { level: string; status: string }) {
  const cls =
    level === 'critical'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : level === 'warning'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-50 text-slate-600 border-slate-200';
  const Icon = level === 'critical' ? XCircle : level === 'warning' ? AlertTriangle : CheckCircle2;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="size-2.5" />
      {status}
    </span>
  );
}

// ── Vitals Step ───────────────────────────────────────────────────────────────

type ConsultFormReturn = ReturnType<typeof useForm<ConsultationFormData>>;

function VitalsStep({ form }: { form: ConsultFormReturn }) {
  const watched = useWatch({
    control: form.control,
    name: ['temperature', 'bloodPressure', 'heartRate', 'o2Sat', 'respiratoryRate', 'weight', 'height'],
  });

  const alerts = useMemo(() => {
    const [temperature, bloodPressure, heartRate, o2Sat, respiratoryRate, weight, height] = watched;
    return evaluateVitalsAlerts({ temperature, bloodPressure, heartRate, o2Sat, respiratoryRate, weight, height });
  }, [watched]);

  const alertByKey = useMemo(() => {
    const map = new Map<string, typeof alerts[number]>();
    for (const a of alerts) map.set(a.key, a);
    return map;
  }, [alerts]);

  const fields: { key: keyof ConsultationFormData; label: string; unit: string; placeholder: string; icon: React.ElementType; alertKey?: string }[] = [
    { key: 'temperature', label: 'Temperature', unit: '°C', placeholder: 'e.g. 36.8', icon: Thermometer, alertKey: 'temperature' },
    { key: 'bloodPressure', label: 'Blood Pressure', unit: 'mmHg', placeholder: 'e.g. 120/80', icon: Activity, alertKey: 'bloodPressure' },
    { key: 'heartRate', label: 'Heart Rate', unit: 'bpm', placeholder: 'e.g. 80', icon: Activity, alertKey: 'heartRate' },
    { key: 'o2Sat', label: 'O2 Saturation', unit: '%', placeholder: 'e.g. 98', icon: Wind, alertKey: 'o2Sat' },
    { key: 'respiratoryRate', label: 'Respiratory Rate', unit: 'br/min', placeholder: 'e.g. 16', icon: Wind, alertKey: 'respiratoryRate' },
    { key: 'weight', label: 'Weight', unit: 'kg', placeholder: 'e.g. 65', icon: Activity, alertKey: 'bmi' },
    { key: 'height', label: 'Height', unit: 'cm', placeholder: 'e.g. 165', icon: Activity, alertKey: 'bmi' },
  ];

  const hasCritical = alerts.some((a) => a.level === 'critical');
  const hasWarning = alerts.some((a) => a.level === 'warning');

  return (
    <div className="space-y-4">
      {hasCritical && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
          <p className="text-xs text-rose-800 font-semibold">Critical vital sign detected — review before proceeding.</p>
        </div>
      )}
      {!hasCritical && hasWarning && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">Abnormal vital sign detected — please verify values.</p>
        </div>
      )}

      <SC>
        <SectionHeading>Vital Signs</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => {
            const alert = f.alertKey ? alertByKey.get(f.alertKey) : undefined;
            const alertLevel = alert?.level ?? 'normal';
            const borderCls =
              alertLevel === 'critical' ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' :
              alertLevel === 'warning'  ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-100' :
              'border-slate-200';
            return (
              <div key={f.key}>
                <FL>{f.label}</FL>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={f.placeholder}
                    {...form.register(f.key)}
                    className={`w-full rounded-lg border bg-white px-3 py-2 pr-12 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:ring-1 ${borderCls}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 pointer-events-none">
                    {f.unit}
                  </span>
                </div>
                {alert && <div className="mt-1"><VitalBadge level={alert.level} status={alert.status} /></div>}
              </div>
            );
          })}
        </div>
      </SC>
    </div>
  );
}

// ── History Step ──────────────────────────────────────────────────────────────

function HistoryStep({ form }: { form: ConsultFormReturn }) {
  return (
    <div className="space-y-4">
      <SC>
        <SectionHeading>Visit type</SectionHeading>
        <div>
          <FL required>Consultation type</FL>
          <Select {...form.register('consultationType')}>
            <option>Teleconsultation</option>
            <option>Follow-up Teleconsult</option>
            <option>Initial Teleconsult</option>
            <option>Emergency Teleconsult</option>
          </Select>
          <FE message={form.formState.errors.consultationType?.message} />
        </div>
      </SC>

      <SC>
        <SectionHeading>Patient History</SectionHeading>
        <div>
          <FL required>Present illness history</FL>
          <Textarea rows={3} placeholder="Chief complaint, onset, duration, and relevant history…" {...form.register('presentIllnessHistory')} />
          <FE message={form.formState.errors.presentIllnessHistory?.message} />
        </div>
        <div>
          <FL>Review of symptoms</FL>
          <Textarea rows={2} placeholder="Other relevant symptoms reported by the patient…" {...form.register('reviewOfSymptoms')} />
        </div>
        <div>
          <FL>Allergies</FL>
          <Textarea rows={2} placeholder="Known drug or food allergies…" {...form.register('allergies')} />
        </div>
      </SC>
    </div>
  );
}

// ── Diagnosis Step ────────────────────────────────────────────────────────────

function DiagnosisStep({ form }: { form: ConsultFormReturn }) {
  return (
    <SC>
      <SectionHeading>Diagnoses</SectionHeading>
      <div>
        <FL>Primary diagnosis</FL>
        <Textarea rows={3} placeholder="e.g. J06.9 Acute upper respiratory tract infection…" {...form.register('diagnosis')} />
      </div>
      <div>
        <FL>Differential diagnosis</FL>
        <Textarea rows={2} placeholder="Other diagnostic considerations…" {...form.register('differentialDiagnosis')} />
      </div>
    </SC>
  );
}

// ── SOAP Step ─────────────────────────────────────────────────────────────────

function SoapStep({ form }: { form: ConsultFormReturn }) {
  const soapFields: { key: keyof ConsultationFormData; label: string; placeholder: string }[] = [
    { key: 'subjective', label: 'Subjective (S)', placeholder: "Patient's own report — symptoms, complaints, pain level…" },
    { key: 'objective', label: 'Objective (O)', placeholder: 'Measurable findings — vitals, physical exam, lab results…' },
    { key: 'assessment', label: 'Assessment (A)', placeholder: 'Clinical impression and interpretation of findings…' },
    { key: 'plan', label: 'Plan (P)', placeholder: 'Treatment plan, medications, referrals, follow-up schedule…' },
  ];
  return (
    <SC>
      <SectionHeading>SOAP Notes</SectionHeading>
      {soapFields.map((f) => (
        <div key={f.key}>
          <FL>{f.label}</FL>
          <Textarea rows={3} placeholder={f.placeholder} {...form.register(f.key)} />
        </div>
      ))}
    </SC>
  );
}

// ── Summary Step ──────────────────────────────────────────────────────────────

function SummaryStep({ form }: { form: ConsultFormReturn }) {
  return (
    <SC>
      <SectionHeading>Treatment &amp; Summary</SectionHeading>
      <div>
        <FL required>Clinical summary</FL>
        <Textarea rows={4} placeholder="Comprehensive summary covering the full teleconsult encounter…" {...form.register('clinicalSummary')} />
        <FE message={form.formState.errors.clinicalSummary?.message} />
      </div>
      <div>
        <FL>Treatment plan</FL>
        <Textarea rows={3} placeholder="Detailed treatment plan, lifestyle advice, referrals…" {...form.register('treatmentPlan')} />
      </div>
      <div>
        <FL>Outcome &amp; follow-up</FL>
        <Textarea rows={2} placeholder="Expected outcome and follow-up instructions…" {...form.register('outcome')} />
      </div>
    </SC>
  );
}

// ── Consultation Tab (multi-step wizard) ──────────────────────────────────────

function ConsultationTab({
  appointment,
  patientId,
  doctorId,
  doctorName,
  onSaved,
}: {
  appointment: TeleconsultAppointmentSummary;
  patientId: string;
  doctorId: string;
  doctorName: string;
  onSaved: (id: string) => void;
}) {
  const { profile } = useAuth();
  const createConsultation = useCreateConsultation();
  const { data: consultations = [] } = usePatientConsultations(patientId);

  const existing = consultations.find((c: any) => c.appointmentId === appointment.id);

  const [step, setStep] = useState(0);
  const totalSteps = CONSULTATION_STEPS.length;
  const currentStep = CONSULTATION_STEPS[step];

  const form = useForm<ConsultationFormData>({
    resolver: zodResolver(consultationSchema),
    mode: 'onBlur',
    defaultValues: {
      consultationType: 'Teleconsultation',
      temperature: '', bloodPressure: '', heartRate: '', o2Sat: '',
      respiratoryRate: '', weight: '', height: '',
      presentIllnessHistory: '', reviewOfSymptoms: '', allergies: '',
      diagnosis: '', differentialDiagnosis: '',
      subjective: '', objective: '', assessment: '', plan: '',
      clinicalSummary: '', treatmentPlan: '', outcome: '',
    },
  });

  const stepFieldMap: Record<StepId, (keyof ConsultationFormData)[]> = {
    vitals: ['temperature', 'bloodPressure', 'heartRate', 'o2Sat', 'respiratoryRate', 'weight', 'height'],
    history: ['consultationType', 'presentIllnessHistory', 'reviewOfSymptoms', 'allergies'],
    diagnosis: ['diagnosis', 'differentialDiagnosis'],
    soap: ['subjective', 'objective', 'assessment', 'plan'],
    summary: ['clinicalSummary', 'treatmentPlan', 'outcome'],
  };

  const handleNext = async () => {
    const fields = stepFieldMap[currentStep.id];
    const valid = await form.trigger(fields as any);
    if (valid && step < totalSteps - 1) setStep((s) => s + 1);
  };

  const handlePrevious = () => { if (step > 0) setStep((s) => s - 1); };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const vitalsText = buildVitalsText(values);
      const result = await createConsultation.mutateAsync({
        appointmentId: appointment.id,
        patientId,
        doctorId,
        actor: profile?.id ?? doctorId,
        consultationType: values.consultationType,
        consultationDate: getManilaDate(),
        consultationTime: getManilaTime(),
        providerName: doctorName,
        presentIllnessHistory: values.presentIllnessHistory,
        reviewOfSymptoms: values.reviewOfSymptoms ?? '',
        allergies: values.allergies ?? '',
        vitals: vitalsText,
        diagnosis: values.diagnosis ?? '',
        differentialDiagnosis: values.differentialDiagnosis ?? '',
        subjective: values.subjective ?? '',
        objective: values.objective ?? '',
        assessment: values.assessment ?? '',
        plan: values.plan ?? '',
        clinicalSummary: values.clinicalSummary,
        treatmentPlan: values.treatmentPlan ?? '',
        outcome: values.outcome ?? '',
        medications: '',
        labResults: '',
      });
      toast.success('Consultation saved successfully');
      form.reset();
      setStep(0);
      onSaved(result.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save consultation');
    }
  });

  if (existing) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm text-center space-y-3">
        <div className="mx-auto w-fit rounded-full p-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, white)' }}>
          <CheckCircle2 className="size-8" style={{ color: 'var(--color-primary)' }} />
        </div>
        <p className="font-bold text-slate-900">Consultation Saved</p>
        <p className="text-xs text-slate-500">Recorded on {formatDateLabel(existing.createdAt)}</p>
        <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-2">
          Use the other tabs to issue prescriptions, certificates, or lab requests.
        </p>
      </div>
    );
  }

  const isLastStep = step === totalSteps - 1;

  return (
    <div className="space-y-4">
      {/* Step progress */}
      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500">Step {step + 1} of {totalSteps}</p>
          <p className="text-xs text-slate-400">{currentStep.title}</p>
        </div>
        <div className="flex gap-1.5">
          {CONSULTATION_STEPS.map((s, i) => (
            <div
              key={s.id}
              className="h-1.5 flex-1 rounded-full transition-all"
              style={{
                backgroundColor:
                  i < step
                    ? 'var(--color-primary)'
                    : i === step
                    ? 'color-mix(in srgb, var(--color-primary) 45%, white)'
                    : '#e2e8f0',
              }}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">{currentStep.description}</p>
      </div>

      {/* Step content */}
      {currentStep.id === 'vitals'    && <VitalsStep form={form} />}
      {currentStep.id === 'history'   && <HistoryStep form={form} />}
      {currentStep.id === 'diagnosis' && <DiagnosisStep form={form} />}
      {currentStep.id === 'soap'      && <SoapStep form={form} />}
      {currentStep.id === 'summary'   && <SummaryStep form={form} />}

      {/* Navigation */}
      <div className="flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={handlePrevious}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ChevronLeft className="size-3.5" /> Previous
          </button>
        )}

        {!isLastStep ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white transition hover:brightness-95 active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Next <ChevronRight className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            disabled={createConsultation.isPending}
            onClick={() => void onSubmit()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {createConsultation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            {createConsultation.isPending ? 'Saving…' : 'Save Consultation'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Prescription Tab ──────────────────────────────────────────────────────────

function PrescriptionTab({
  appointment,
  patientName,
  patientId,
  doctorId: _doctorId,
}: {
  appointment: TeleconsultAppointmentSummary;
  patientName: string;
  patientId: string;
  doctorId: string;
}) {
  const { profile } = useAuth();
  const { data: clinicSettings } = useClinicSettingsData();
  const { data: providers = [] } = useProviderDirectory();
  const createPrescription = useCreatePrescription();
  const { data: consultations = [] } = usePatientConsultations(patientId);

  const currentDoctor = providers.find((d) => d.profileId === profile?.id);
  const linkedConsultation =
    consultations.find((c: any) => c.appointmentId === appointment.id) ?? consultations[0] ?? null;

  const [medications, setMedications] = useState<DraftMedication[]>([]);
  const [draft, setDraft] = useState({ genericName: '', brandName: '', dosage: '', instruction: '', numberOfMedications: '' });
  const [draftErrors, setDraftErrors] = useState({ genericName: '', dosage: '', instruction: '' });
  const [isPrinting, setIsPrinting] = useState(false);

  const addMedication = () => {
    const errs = {
      genericName: draft.genericName.trim() ? '' : 'Required',
      dosage: draft.dosage.trim() ? '' : 'Required',
      instruction: draft.instruction.trim() ? '' : 'Required',
    };
    setDraftErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setMedications((prev) => [...prev, { ...draft, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }]);
    setDraft({ genericName: '', brandName: '', dosage: '', instruction: '', numberOfMedications: '' });
    setDraftErrors({ genericName: '', dosage: '', instruction: '' });
  };

  const handleSaveAndPrint = async () => {
    if (!medications.length) { toast.error('Add at least one medication'); return; }
    setIsPrinting(true);
    try {
      await Promise.all(
        medications.map((m) =>
          createPrescription.mutateAsync({
            patientId,
            consultationId: linkedConsultation?.id ?? '',
            prescriptionName: m.genericName,
            brandName: m.brandName || null,
            dosage: m.dosage,
            instruction: m.instruction,
            numberOfMedications: m.numberOfMedications ? Number(m.numberOfMedications) : null,
          } as any),
        ),
      );
      const doctorDisplayName = currentDoctor
        ? `${currentDoctor.fullName}${currentDoctor.title ? ' ' + currentDoctor.title : ''}`
        : appointment.doctorName;
      const html = buildPrescriptionPrintDocument({
        clinicName: clinicSettings?.clinicName ?? 'CPRMED Clinic',
        clinicAddress: clinicSettings?.address ?? '',
        clinicContactNumber: clinicSettings?.contactNumber ?? '',
        clinicEmail: clinicSettings?.email ?? '',
        doctorName: doctorDisplayName,
        doctorSpecialty: currentDoctor?.specialtyName ?? '',
        doctorLicenseNumber: currentDoctor?.licenseNumber ?? '',
        doctorBirNumber: currentDoctor?.birNumber ?? '',
        doctorPtrNumber: currentDoctor?.ptrNumber ?? '',
        doctorPrcQrData: '',
        patientName,
        issuedDate: new Date().toISOString(),
        medications: medications.map((m) => ({
          name: m.genericName,
          brandName: m.brandName || undefined,
          dosage: m.dosage,
          instruction: m.instruction,
          numberOfMedications: m.numberOfMedications || undefined,
        })),
        nextAppointment: '',
      });
      await printHtmlDocument(html);
      toast.success('Prescription saved and sent to printer');
      setMedications([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save prescription');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="space-y-4">
      {!linkedConsultation && (
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-slate-400" />
          Save a consultation first to link this prescription to the visit.
        </div>
      )}

      <SC>
        <SectionHeading>Add Medication</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FL required>Generic name</FL>
            <Input className="h-9 text-sm" placeholder="e.g. Amoxicillin" value={draft.genericName} onChange={(e) => setDraft((d) => ({ ...d, genericName: e.target.value }))} />
            <FE message={draftErrors.genericName} />
          </div>
          <div>
            <FL>Brand name</FL>
            <Input className="h-9 text-sm" placeholder="Optional" value={draft.brandName} onChange={(e) => setDraft((d) => ({ ...d, brandName: e.target.value }))} />
          </div>
          <div>
            <FL required>Dosage</FL>
            <Input className="h-9 text-sm" placeholder="e.g. 500mg" value={draft.dosage} onChange={(e) => setDraft((d) => ({ ...d, dosage: e.target.value }))} />
            <FE message={draftErrors.dosage} />
          </div>
          <div>
            <FL>Qty (#)</FL>
            <Input className="h-9 text-sm" type="number" min={1} placeholder="e.g. 10" value={draft.numberOfMedications} onChange={(e) => setDraft((d) => ({ ...d, numberOfMedications: e.target.value }))} />
          </div>
        </div>
        <div>
          <FL required>Sig — Instructions</FL>
          <Input className="h-9 text-sm" placeholder="e.g. 1 capsule TID × 7 days after meals" value={draft.instruction} onChange={(e) => setDraft((d) => ({ ...d, instruction: e.target.value }))} />
          <FE message={draftErrors.instruction} />
        </div>
        <button
          type="button"
          onClick={addMedication}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          <Plus className="size-3.5" /> Add to prescription list
        </button>
      </SC>

      {medications.length > 0 && (
        <SC>
          <div className="flex items-center justify-between">
            <SectionHeading>Prescription List</SectionHeading>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {medications.length} item{medications.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {medications.map((med, i) => (
              <div key={med.id} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{med.genericName}{med.brandName && <span className="ml-1 text-xs font-normal text-slate-400">({med.brandName})</span>}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{med.dosage} · {med.instruction}{med.numberOfMedications && ` · #${med.numberOfMedications}`}</p>
                </div>
                <button type="button" onClick={() => setMedications((p) => p.filter((m) => m.id !== med.id))} className="shrink-0 text-slate-300 hover:text-rose-500 transition-colors">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </SC>
      )}

      <button
        type="button"
        disabled={medications.length === 0 || isPrinting}
        onClick={handleSaveAndPrint}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPrinting ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
        {isPrinting ? 'Saving & printing…' : 'Save & Print Prescription'}
      </button>
    </div>
  );
}

// ── Medical Certificate Tab ───────────────────────────────────────────────────

function MedicalCertificateTab({
  appointment,
  patientName,
  patientId,
}: {
  appointment: TeleconsultAppointmentSummary;
  patientName: string;
  patientId: string;
}) {
  const { profile } = useAuth();
  const { data: clinicSettings } = useClinicSettingsData();
  const { data: providers = [] } = useProviderDirectory();
  const { data: patientData } = usePatientDetail(patientId);
  const createMedicalCertificate = useCreateMedicalCertificate();
  const { data: consultations = [] } = usePatientConsultations(patientId);

  const currentDoctor = providers.find((d) => d.profileId === profile?.id);
  const linkedConsultation = consultations.find((c: any) => c.appointmentId === appointment.id) ?? consultations[0] ?? null;
  const [isPrinting, setIsPrinting] = useState(false);

  const form = useForm<MedCertFormData>({
    resolver: zodResolver(medCertSchema),
    defaultValues: { certificatePurpose: '', diagnosis: '', recommendation: '', restFrom: '', restUntil: '', checkWork: false, checkSchool: false, checkFinancial: false },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsPrinting(true);
    try {
      const cert = await createMedicalCertificate.mutateAsync({
        patientId,
        consultationId: linkedConsultation?.id ?? '',
        certificatePurpose: values.certificatePurpose,
        diagnosis: values.diagnosis,
        recommendation: values.recommendation,
        restFrom: values.restFrom ?? null,
        restUntil: values.restUntil ?? null,
        checkFinancial: values.checkFinancial ?? false,
        checkSchool: values.checkSchool ?? false,
        checkWork: values.checkWork ?? false,
      } as any);

      const doctorDisplayName = currentDoctor
        ? `${currentDoctor.fullName}${currentDoctor.title ? ' ' + currentDoctor.title : ''}`
        : appointment.doctorName;

      const html = buildMedicalCertificatePrintDocument({
        certificateNumber: cert.certificateNumber != null ? String(cert.certificateNumber) : '',
        patientQrSvg: '', patientQrCode: '', patientReferenceCode: '',
        clinicName: clinicSettings?.clinicName ?? 'CPRMED Clinic',
        clinicAddress: clinicSettings?.address ?? '',
        clinicContactNumber: clinicSettings?.contactNumber ?? '',
        clinicEmail: clinicSettings?.email ?? '',
        doctorName: doctorDisplayName,
        doctorSpecialty: currentDoctor?.specialtyName ?? '',
        doctorLicenseNumber: currentDoctor?.licenseNumber ?? '',
        doctorBirNumber: currentDoctor?.birNumber ?? '',
        doctorPtrNumber: currentDoctor?.ptrNumber ?? '',
        doctorPrcQrData: '',
        patientName,
        patientAge: patientData?.birthDate ? calcAge(patientData.birthDate) : '',
        patientSex: patientData?.sex ?? '',
        patientAddress: patientData?.address ?? '',
        issuedDate: cert.createdAt ?? new Date().toISOString(),
        certificatePurpose: values.certificatePurpose,
        diagnosis: values.diagnosis,
        recommendation: values.recommendation,
        restFrom: values.restFrom ?? '',
        restUntil: values.restUntil ?? '',
        checkFinancial: values.checkFinancial ?? false,
        checkSchool: values.checkSchool ?? false,
        checkWork: values.checkWork ?? false,
      });

      await printHtmlDocument(html);
      toast.success('Medical certificate issued and sent to printer');
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to issue medical certificate');
    } finally {
      setIsPrinting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {!linkedConsultation && (
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-slate-400" />
          Save a consultation first to link this certificate.
        </div>
      )}

      <SC>
        <SectionHeading>Certificate Details</SectionHeading>
        <div>
          <FL required>Purpose</FL>
          <Select {...form.register('certificatePurpose')}>
            <option value="">Select purpose…</option>
            <option>Employment clearance</option>
            <option>School clearance</option>
            <option>Travel clearance</option>
            <option>HMO claim</option>
            <option>Medical leave</option>
            <option>General medical certificate</option>
          </Select>
          <FE message={form.formState.errors.certificatePurpose?.message} />
        </div>
        <div>
          <FL required>Diagnosis</FL>
          <Textarea rows={2} placeholder="Diagnosis to certify on the document…" {...form.register('diagnosis')} />
          <FE message={form.formState.errors.diagnosis?.message} />
        </div>
        <div>
          <FL required>Recommendation</FL>
          <Textarea rows={2} placeholder="Doctor's recommendation…" {...form.register('recommendation')} />
          <FE message={form.formState.errors.recommendation?.message} />
        </div>
      </SC>

      <SC>
        <SectionHeading>Rest Period</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <div><FL>From</FL><Input type="date" {...form.register('restFrom')} /></div>
          <div><FL>Until</FL><Input type="date" {...form.register('restUntil')} /></div>
        </div>
        <div>
          <FL>Issued for</FL>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['checkWork', 'checkSchool', 'checkFinancial'] as const).map((field) => (
              <label
                key={field}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 has-[:checked]:border-[var(--color-primary)] has-[:checked]:bg-[var(--color-primary)]/8 has-[:checked]:text-[var(--color-primary)]"
              >
                <input type="checkbox" className="size-3.5 accent-[var(--color-primary)]" {...form.register(field)} />
                {field === 'checkWork' ? 'Work' : field === 'checkSchool' ? 'School' : 'Financial'}
              </label>
            ))}
          </div>
        </div>
      </SC>

      <button
        type="submit"
        disabled={isPrinting}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
      >
        {isPrinting ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
        {isPrinting ? 'Issuing…' : 'Issue & Print Certificate'}
      </button>
    </form>
  );
}

// ── Lab Request Document Tab ──────────────────────────────────────────────────

interface LabTestItem {
  id: string;
  testName: string;
  instruction: string;
}

function LabRequestDocumentTab({
  appointment,
  patientName,
  patientId,
  doctorId: _doctorId,
}: {
  appointment: TeleconsultAppointmentSummary;
  patientName: string;
  patientId: string;
  doctorId: string;
}) {
  const { profile } = useAuth();
  const { data: clinicSettings } = useClinicSettingsData();
  const { data: providers = [] } = useProviderDirectory();
  const { data: patientData } = usePatientDetail(patientId);
  const { data: consultations = [] } = usePatientConsultations(patientId);

  const currentDoctor = providers.find((d) => d.profileId === profile?.id);
  const linkedConsultation = consultations.find((c: any) => c.appointmentId === appointment.id) ?? consultations[0] ?? null;

  const [tests, setTests] = useState<LabTestItem[]>([]);
  const [draft, setDraft] = useState({ testName: '', instruction: '' });
  const [draftError, setDraftError] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  const addTest = () => {
    if (!draft.testName.trim()) { setDraftError('Test name is required'); return; }
    setDraftError('');
    setTests((prev) => [...prev, { ...draft, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }]);
    setDraft({ testName: '', instruction: '' });
  };

  const handlePrint = async () => {
    if (!tests.length) { toast.error('Add at least one test'); return; }
    setIsPrinting(true);
    try {
      const doctorDisplayName = currentDoctor
        ? `${currentDoctor.fullName}${currentDoctor.title ? ' ' + currentDoctor.title : ''}`
        : appointment.doctorName;

      const html = buildLabRequestPrintDocument({
        clinicName: clinicSettings?.clinicName ?? 'CPRMED Clinic',
        clinicAddress: clinicSettings?.address ?? '',
        clinicContactNumber: clinicSettings?.contactNumber ?? '',
        clinicEmail: clinicSettings?.email ?? '',
        doctorName: doctorDisplayName,
        doctorSpecialty: currentDoctor?.specialtyName ?? '',
        doctorLicenseNumber: currentDoctor?.licenseNumber ?? '',
        doctorBirNumber: currentDoctor?.birNumber ?? '',
        doctorPtrNumber: currentDoctor?.ptrNumber ?? '',
        patientName,
        patientAge: patientData?.birthDate ? calcAge(patientData.birthDate) : '',
        patientSex: patientData?.sex ?? '',
        patientAddress: patientData?.address ?? '',
        issuedDate: new Date().toISOString(),
        requests: tests.map((t) => ({ name: t.testName, instruction: t.instruction })),
      });

      await printHtmlDocument(html);
      toast.success('Lab request sent to printer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to print lab request');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="space-y-4">
      {!linkedConsultation && (
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-slate-400" />
          Save a consultation first to link this lab request to the visit.
        </div>
      )}

      <SC>
        <SectionHeading>Add Lab Test</SectionHeading>
        <div>
          <FL required>Test / Examination name</FL>
          <Input
            className="h-9 text-sm"
            placeholder="e.g. Complete Blood Count (CBC)"
            value={draft.testName}
            onChange={(e) => { setDraft((d) => ({ ...d, testName: e.target.value })); setDraftError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTest(); } }}
          />
          <FE message={draftError} />
        </div>
        <div>
          <FL>Instructions / Details</FL>
          <Input
            className="h-9 text-sm"
            placeholder="e.g. Fasting required, include differential"
            value={draft.instruction}
            onChange={(e) => setDraft((d) => ({ ...d, instruction: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTest(); } }}
          />
        </div>
        <button
          type="button"
          onClick={addTest}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          <Plus className="size-3.5" /> Add test
        </button>
      </SC>

      {tests.length > 0 && (
        <SC>
          <div className="flex items-center justify-between">
            <SectionHeading>Test List</SectionHeading>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {tests.length} test{tests.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {tests.map((test, i) => (
              <div key={test.id} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{test.testName}</p>
                  {test.instruction && <p className="mt-0.5 text-xs text-slate-500">{test.instruction}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setTests((p) => p.filter((t) => t.id !== test.id))}
                  className="shrink-0 text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </SC>
      )}

      <button
        type="button"
        disabled={tests.length === 0 || isPrinting}
        onClick={handlePrint}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPrinting ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
        {isPrinting ? 'Printing…' : 'Print Lab Request Document'}
      </button>
    </div>
  );
}

// ── Tab config ─────────────────────────────────────────────────────────────────

const TABS: { id: TabId; icon: React.ElementType; label: string; shortLabel: string; desc: string }[] = [
  { id: 'consultation', icon: Stethoscope, label: 'Consultation', shortLabel: 'Consult', desc: 'SOAP notes & diagnosis' },
  { id: 'prescription', icon: Pill, label: 'Prescription', shortLabel: 'Rx', desc: 'Medications & dosage' },
  { id: 'medcert', icon: FileText, label: 'Med Cert', shortLabel: 'Cert', desc: 'Issue & print' },
  { id: 'labrequest', icon: FlaskConical, label: 'Lab Request', shortLabel: 'Lab', desc: 'Print lab request document' },
];

// ── Main Panel ─────────────────────────────────────────────────────────────────

export function TeleconsultDoctorPanel({ appointment }: DoctorPanelProps) {
  const { profile } = useAuth();
  const { data: providers = [] } = useProviderDirectory();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('consultation');
  const [savedConsultationId, setSavedConsultationId] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  const patientId = appointment.patientId ?? '';
  const patientName = appointment.patientName;
  const patientInitials = patientName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const currentDoctor = providers.find((d) => d.profileId === profile?.id);
  const doctorId = currentDoctor?.id ?? profile?.id ?? '';
  const doctorName = currentDoctor?.fullName ?? appointment.doctorName ?? profile?.fullName ?? 'Doctor';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!patientId) return null;

  return (
    <>
      {/* ── Trigger buttons (closed state) — muted slate + primary accent ── */}
      {!isOpen && (
        <div className="flex flex-col gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setIsOpen(true); }}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:border-[var(--color-primary)]/30 hover:shadow-md hover:bg-slate-50 active:scale-[0.98]"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, white)',
                    color: 'var(--color-primary)',
                  }}
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 leading-none">{tab.label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{tab.desc}</p>
                </div>
                <ChevronRight className="size-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </button>
            );
          })}
        </div>
      )}

      {/* ── Open panel ── */}
      {isOpen && (
        <div
          ref={panelRef}
          className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 shadow-xl overflow-hidden"
          style={{ animation: 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {/* Header */}
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex size-8 items-center justify-center rounded-xl text-xs font-bold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {patientInitials}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Clinical Panel</p>
                  <p className="text-sm font-bold text-slate-900 leading-tight">{patientName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                      isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                    style={isActive ? { borderBottom: '2px solid var(--color-primary)' } : {}}
                  >
                    <Icon className="size-3.5" />
                    {tab.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 230px)' }}>
            {activeTab === 'consultation' && (
              <ConsultationTab
                appointment={appointment}
                patientId={patientId}
                doctorId={doctorId}
                doctorName={doctorName}
                onSaved={setSavedConsultationId}
              />
            )}
            {activeTab === 'prescription' && (
              <PrescriptionTab
                appointment={appointment}
                patientName={patientName}
                patientId={patientId}
                doctorId={doctorId}
              />
            )}
            {activeTab === 'medcert' && (
              <MedicalCertificateTab
                appointment={appointment}
                patientName={patientName}
                patientId={patientId}
              />
            )}
            {activeTab === 'labrequest' && (
              <LabRequestDocumentTab
                appointment={appointment}
                patientName={patientName}
                patientId={patientId}
                doctorId={doctorId}
              />
            )}
          </div>

          {/* Footer */}
          {savedConsultationId && (
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-2 flex items-center gap-2">
              <CheckCircle2 className="size-3.5" style={{ color: 'var(--color-primary)' }} />
              <p className="text-[11px] text-slate-500">Consultation saved for this session</p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
