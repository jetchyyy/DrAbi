import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, FlaskConical, Pill, TestTubeDiagonal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useDoctorDirectory } from '../../hooks/use-clinic-data';
import { getDatabase, getPatientById } from '../../lib/local-db';
import { formatDateLabel, formatDateTimeLabel } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { PatientQrCard } from './components/patient-qr-card';
import { useCreateConsultation } from './hooks/use-patients';
import { useCreateReferral, useReferrals, useUpdateReferralOutcome } from '../referrals/hooks/use-referrals';

const referralSchema = z.object({
  targetDoctorId: z.string().min(1),
  reason: z.string().min(4),
  clinicalSummary: z.string().min(8),
  referralNotes: z.string().min(4),
});

const specialistUpdateSchema = z.object({
  specialistVisitedAt: z.string().min(1),
  specialistFindings: z.string().min(8),
  specialistRecommendations: z.string().min(8),
  status: z.enum(['accepted', 'completed']),
});

const soapSchema = z.object({
  appointmentId: z.string().min(1),
  subjective: z.string().min(4),
  objective: z.string().min(4),
  assessment: z.string().min(4),
  plan: z.string().min(4),
  outcome: z.string().min(4),
});

export function PatientDetailPage() {
  const { patientId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { data: doctors = [] } = useDoctorDirectory();
  const { data: referrals = [] } = useReferrals(patientId || null);
  const createReferral = useCreateReferral(patientId || null);
  const updateReferralOutcome = useUpdateReferralOutcome(patientId || null);
  const createConsultation = useCreateConsultation();
  const patient = getPatientById(patientId);
  const database = getDatabase();

  const currentDoctor = doctors.find((doctor) => doctor.profileId === profile?.id);
  const assignableDoctors = doctors.filter((doctor) => doctor.id !== currentDoctor?.id);
  const referralForm = useForm<z.infer<typeof referralSchema>>({
    resolver: zodResolver(referralSchema),
    defaultValues: {
      targetDoctorId: '',
      reason: '',
      clinicalSummary: '',
      referralNotes: '',
    },
  });
  const specialistForm = useForm<z.infer<typeof specialistUpdateSchema>>({
    resolver: zodResolver(specialistUpdateSchema),
    defaultValues: {
      specialistVisitedAt: '2026-03-31T09:00',
      specialistFindings: '',
      specialistRecommendations: '',
      status: 'completed',
    },
  });
  const soapForm = useForm<z.infer<typeof soapSchema>>({
    resolver: zodResolver(soapSchema),
    defaultValues: {
      appointmentId: '',
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      outcome: 'For follow-up monitoring.',
    },
  });

  const visits = patient ? database.appointments.filter((appointment) => appointment.patientId === patient.id) : [];
  const consultations = patient ? database.consultations.filter((consultation) => consultation.patientId === patient.id) : [];
  const prescriptions = patient ? database.prescriptions.filter((prescription) => prescription.patientId === patient.id) : [];
  const labOrders = patient ? database.labOrders.filter((order) => order.patientId === patient.id) : [];
  const [labSearch, setLabSearch] = useState('');
  const [labStatusFilter, setLabStatusFilter] = useState('all');
  const [labExpanded, setLabExpanded] = useState(false);

  const filteredLabOrders = useMemo(() => {
    return labOrders.filter((o) => {
      const svc = database.labServices.find((s) => s.id === o.labServiceId);
      const matchSearch = !labSearch || svc?.name?.toLowerCase().includes(labSearch.toLowerCase());
      const matchStatus = labStatusFilter === 'all' || o.status === labStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [labOrders, labSearch, labStatusFilter, database]);
  const consultationAppointmentIds = new Set(consultations.map((consultation) => consultation.appointmentId));
  const pendingSoapVisits = visits.filter((visit) => !consultationAppointmentIds.has(visit.id));
  const selectedAppointmentId = soapForm.watch('appointmentId');
  const selectedAppointment = visits.find((visit) => visit.id === selectedAppointmentId) ?? pendingSoapVisits[0] ?? null;
  const soapDoctorId = currentDoctor?.id ?? selectedAppointment?.doctorId ?? visits[0]?.doctorId ?? profile?.id ?? 'user_owner';
  const openedFromQr = searchParams.get('source') === 'qr';

  const pendingSpecialistReferral =
    currentDoctor
      ? referrals.find(
          (referral) =>
            referral.targetDoctorId === currentDoctor.id &&
            referral.status !== 'completed' &&
            referral.status !== 'cancelled',
        ) ?? null
      : null;

  useEffect(() => {
    if (pendingSoapVisits.length === 0) {
      return;
    }

    if (!soapForm.getValues('appointmentId')) {
      soapForm.setValue('appointmentId', pendingSoapVisits[0].id, { shouldValidate: true });
    }
  }, [pendingSoapVisits, soapForm]);

  const consultationTimeline = useMemo(
    () =>
      consultations.map((consultation) => ({
        consultation,
        appointment: visits.find((visit) => visit.id === consultation.appointmentId) ?? null,
      })),
    [consultations, visits],
  );

  if (!patient) {
    return (
      <Card>
        <CardTitle>Patient not found</CardTitle>
      </Card>
    );
  }

  const handleCreateReferral = referralForm.handleSubmit(async (values) => {
    if (!currentDoctor) return;
    const targetDoctor = doctors.find((doctor) => doctor.id === values.targetDoctorId);

    await createReferral.mutateAsync({
      patientId: patient.id,
      appointmentId: visits[0]?.id ?? null,
      referringDoctorId: currentDoctor.id,
      targetDoctorId: values.targetDoctorId,
      targetSpecialtyId: targetDoctor?.specialtyId ?? null,
      reason: values.reason,
      clinicalSummary: values.clinicalSummary,
      referralNotes: values.referralNotes,
    });

    referralForm.reset({
      targetDoctorId: '',
      reason: '',
      clinicalSummary: '',
      referralNotes: '',
    });
  });

  const handleSpecialistUpdate = specialistForm.handleSubmit(async (values) => {
    if (!pendingSpecialistReferral) return;

    await updateReferralOutcome.mutateAsync({
      referralId: pendingSpecialistReferral.id,
      status: values.status,
      specialistFindings: values.specialistFindings,
      specialistRecommendations: values.specialistRecommendations,
      specialistVisitedAt: new Date(values.specialistVisitedAt).toISOString(),
    });

    specialistForm.reset({
      specialistVisitedAt: '2026-03-31T09:00',
      specialistFindings: '',
      specialistRecommendations: '',
      status: 'completed',
    });
  });

  const handleCreateSoap = soapForm.handleSubmit(async (values) => {
    await createConsultation.mutateAsync({
      appointmentId: values.appointmentId,
      patientId: patient.id,
      doctorId: soapDoctorId,
      subjective: values.subjective,
      objective: values.objective,
      assessment: values.assessment,
      plan: values.plan,
      outcome: values.outcome,
    });

    const nextAppointmentId = pendingSoapVisits.find((visit) => visit.id !== values.appointmentId)?.id ?? '';
    soapForm.reset({
      appointmentId: nextAppointmentId,
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      outcome: 'For follow-up monitoring.',
    });
  });

  return (
    <div className="space-y-6">
      {openedFromQr ? (
        <Card className="border-emerald-100 bg-emerald-50/80">
          <p className="text-sm font-medium text-emerald-700">Patient record opened from QR scan.</p>
          <p className="mt-1 text-sm text-emerald-900">You can continue directly to the SOAP section below.</p>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Patient chart</p>
              <CardTitle className="mt-2 text-3xl">
                {patient.firstName} {patient.lastName}
              </CardTitle>
              <p className="mt-2 text-sm text-slate-500">{patient.email} • {patient.mobileNumber}</p>
              <p className="mt-2 text-sm font-medium text-slate-700">QR code: <span className="font-mono">{patient.qrCode}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{patient.bloodType || 'Blood type pending'}</Badge>
              <Badge intent="warning">{patient.allergies}</Badge>
            </div>
          </div>
        </Card>

        <PatientQrCard patientName={`${patient.firstName} ${patient.lastName}`} qrCode={patient.qrCode} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardTitle>Clinical summary</CardTitle>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-slate-400">Birth date</dt>
              <dd className="font-medium text-slate-950">{formatDateLabel(patient.birthDate)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Medical history</dt>
              <dd className="font-medium text-slate-950">{patient.medicalHistory}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Emergency contact</dt>
              <dd className="font-medium text-slate-950">
                {patient.emergencyContactName} • {patient.emergencyContactPhone}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Address</dt>
              <dd className="font-medium text-slate-950">{patient.address}</dd>
            </div>
          </dl>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardTitle>Visit timeline</CardTitle>
            <div className="mt-5 space-y-4">
              {visits.map((visit) => (
                <div key={visit.id} className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-slate-950">{formatDateTimeLabel(visit.scheduledAt)}</p>
                    <Badge intent={consultationAppointmentIds.has(visit.id) ? 'info' : 'warning'}>
                      {consultationAppointmentIds.has(visit.id) ? 'SOAP saved' : 'SOAP pending'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{visit.reason}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-[var(--color-primary)]" />
                <CardTitle className="text-base">Consultations</CardTitle>
              </div>
              <p className="mt-4 text-3xl font-semibold text-slate-950">{consultations.length}</p>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <Pill className="size-5 text-[var(--color-primary)]" />
                <CardTitle className="text-base">Prescriptions</CardTitle>
              </div>
              <p className="mt-4 text-3xl font-semibold text-slate-950">{prescriptions.length}</p>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <TestTubeDiagonal className="size-5 text-[var(--color-primary)]" />
                <CardTitle className="text-base">Lab orders</CardTitle>
              </div>
              <p className="mt-4 text-3xl font-semibold text-slate-950">{labOrders.length}</p>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardTitle>SOAP notes</CardTitle>
          <div className="mt-5 space-y-4">
            {consultationTimeline.length === 0 ? (
              <p className="text-sm text-slate-500">No SOAP notes have been saved for this patient yet.</p>
            ) : (
              consultationTimeline.map(({ consultation, appointment }) => (
                <div key={consultation.id} className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-slate-950">
                      {appointment ? formatDateTimeLabel(appointment.scheduledAt) : 'Consultation note'}
                    </p>
                    <Badge intent="info">SOAP completed</Badge>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <p><span className="font-semibold text-slate-950">Subjective:</span> {consultation.subjective}</p>
                    <p><span className="font-semibold text-slate-950">Objective:</span> {consultation.objective}</p>
                    <p><span className="font-semibold text-slate-950">Assessment:</span> {consultation.assessment}</p>
                    <p><span className="font-semibold text-slate-950">Plan:</span> {consultation.plan}</p>
                    <p><span className="font-semibold text-slate-950">Outcome:</span> {consultation.outcome}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardTitle>New SOAP entry</CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              Use this after scanning the patient QR to attach SOAP documentation to a visit that is still pending.
            </p>
            {pendingSoapVisits.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Every current visit already has a SOAP note. Create a new appointment first if you need another chart entry.
              </p>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={handleCreateSoap}>
                <FormField error={soapForm.formState.errors.appointmentId?.message} label="Visit to document">
                  <Select {...soapForm.register('appointmentId')}>
                    <option value="">Select appointment</option>
                    {pendingSoapVisits.map((visit) => (
                      <option key={visit.id} value={visit.id}>
                        {formatDateTimeLabel(visit.scheduledAt)} - {visit.reason}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField error={soapForm.formState.errors.subjective?.message} label="Subjective">
                  <Textarea rows={3} {...soapForm.register('subjective')} />
                </FormField>
                <FormField error={soapForm.formState.errors.objective?.message} label="Objective">
                  <Textarea rows={3} {...soapForm.register('objective')} />
                </FormField>
                <FormField error={soapForm.formState.errors.assessment?.message} label="Assessment">
                  <Textarea rows={3} {...soapForm.register('assessment')} />
                </FormField>
                <FormField error={soapForm.formState.errors.plan?.message} label="Plan">
                  <Textarea rows={3} {...soapForm.register('plan')} />
                </FormField>
                <FormField error={soapForm.formState.errors.outcome?.message} label="Outcome / follow-up">
                  <Textarea rows={2} {...soapForm.register('outcome')} />
                </FormField>
                <Button className="w-full" disabled={createConsultation.isPending} type="submit">
                  {createConsultation.isPending ? 'Saving SOAP...' : 'Save SOAP note'}
                </Button>
              </form>
            )}
          </Card>

          <Card>
            <CardTitle>Referral coordination</CardTitle>
            <div className="mt-5 space-y-4">
              {referrals.length === 0 ? (
                <p className="text-sm text-slate-500">No referrals have been recorded for this patient yet.</p>
              ) : (
                referrals.map((referral) => {
                  const referringDoctor = doctors.find((doctor) => doctor.id === referral.referringDoctorId);
                  const targetDoctor = doctors.find((doctor) => doctor.id === referral.targetDoctorId);

                  return (
                    <div key={referral.id} className="rounded-3xl bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950">
                            {referringDoctor?.fullName ?? 'Generalist'} to {targetDoctor?.fullName ?? 'Specialist'}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{referral.reason}</p>
                        </div>
                        <Badge intent={referral.status === 'completed' ? 'info' : 'warning'}>
                          {referral.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">{referral.clinicalSummary}</p>
                      <p className="mt-2 text-sm text-slate-500">{referral.referralNotes}</p>
                      {referral.specialistFindings ? (
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <p><span className="font-semibold text-slate-950">Specialist findings:</span> {referral.specialistFindings}</p>
                          <p><span className="font-semibold text-slate-950">Recommendations:</span> {referral.specialistRecommendations}</p>
                        </div>
                      ) : null}
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                        Referred {formatDateTimeLabel(referral.referredAt)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {currentDoctor ? (
            <Card>
              <CardTitle>Refer to specialist</CardTitle>
              <p className="mt-2 text-sm text-slate-500">
                The generalist decides if this patient should be escalated, then the specialist can close the loop here.
              </p>
              <form className="mt-5 space-y-4" onSubmit={handleCreateReferral}>
                <FormField label="Specialist">
                  <Select {...referralForm.register('targetDoctorId')}>
                    <option value="">Select specialist</option>
                    {assignableDoctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.fullName}{doctor.specialtyName ? ` (${doctor.specialtyName})` : ''}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Reason for referral">
                  <Input {...referralForm.register('reason')} />
                </FormField>
                <FormField label="Clinical summary">
                  <Textarea rows={4} {...referralForm.register('clinicalSummary')} />
                </FormField>
                <FormField label="Referral notes">
                  <Textarea rows={3} {...referralForm.register('referralNotes')} />
                </FormField>
                <Button className="w-full" disabled={createReferral.isPending || assignableDoctors.length === 0} type="submit">
                  {createReferral.isPending ? 'Sending...' : 'Create referral'}
                </Button>
              </form>
            </Card>
          ) : null}

          {pendingSpecialistReferral ? (
            <Card>
              <CardTitle>Specialist visit update</CardTitle>
              <form className="mt-5 space-y-4" onSubmit={handleSpecialistUpdate}>
                <FormField label="Visit date and time">
                  <Input type="datetime-local" {...specialistForm.register('specialistVisitedAt')} />
                </FormField>
                <FormField label="Referral status">
                  <Select {...specialistForm.register('status')}>
                    <option value="accepted">Accepted</option>
                    <option value="completed">Completed</option>
                  </Select>
                </FormField>
                <FormField label="Findings during specialist visit">
                  <Textarea rows={4} {...specialistForm.register('specialistFindings')} />
                </FormField>
                <FormField label="Recommendations for the generalist">
                  <Textarea rows={4} {...specialistForm.register('specialistRecommendations')} />
                </FormField>
                <Button className="w-full" disabled={updateReferralOutcome.isPending} type="submit">
                  {updateReferralOutcome.isPending ? 'Saving...' : 'Save specialist update'}
                </Button>
              </form>
            </Card>
          ) : null}
        </div>
      </div>

      {/* ── Lab Test History ─────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FlaskConical className="size-5 text-violet-600" />
            <CardTitle>Lab test history</CardTitle>
          </div>
          <Badge intent={labOrders.length > 0 ? 'info' : 'neutral'}>{labOrders.length} order{labOrders.length !== 1 ? 's' : ''}</Badge>
        </div>

        {labOrders.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              className="flex-1 min-w-40 border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Search test name…"
              value={labSearch}
              onChange={(e) => setLabSearch(e.target.value)}
            />
            <select
              className="border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={labStatusFilter}
              onChange={(e) => setLabStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="requested">Requested</option>
              <option value="collected">Collected</option>
              <option value="processing">Processing</option>
              <option value="ready">Ready</option>
              <option value="released">Released</option>
            </select>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {filteredLabOrders.length === 0 ? (
            <p className="text-sm text-slate-500">
              {labOrders.length === 0
                ? 'No lab orders have been placed for this patient yet.'
                : 'No lab orders match the current filter.'}
            </p>
          ) : (
            (labExpanded ? filteredLabOrders : filteredLabOrders.slice(0, 10)).map((order) => {
              const svc = database.labServices.find((s) => s.id === order.labServiceId);
              const doctor = database.users.find((u) => u.id === order.requestedBy);
              return (
                <div key={order.id} className="rounded-sm bg-slate-50 p-4 border border-slate-100">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-slate-950">{svc?.name ?? 'Unknown test'}</p>
                        {order.urgentFlag && (
                          <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 bg-rose-100 text-rose-600">Urgent</span>
                        )}
                      </div>
                      {doctor && <p className="text-xs text-slate-500 mt-0.5">Requested by {doctor.fullName}</p>}
                      {order.schedDate && (
                        <p className="text-xs text-sky-600 mt-0.5 font-medium">
                          Scheduled: {order.schedDate}{order.schedTime ? ` at ${order.schedTime}` : ''}
                        </p>
                      )}
                      {order.notes && <p className="text-xs text-slate-400 mt-1 italic">{order.notes}</p>}
                    </div>
                    <span className={
                      order.status === 'released'
                        ? 'bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1'
                        : order.status === 'ready'
                        ? 'bg-sky-100 text-sky-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1'
                        : order.status === 'processing'
                        ? 'bg-violet-100 text-violet-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1'
                        : 'bg-orange-100 text-orange-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1'
                    }>
                      {order.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {filteredLabOrders.length > 10 && (
          <button
            type="button"
            className="mt-4 text-xs font-bold uppercase tracking-widest text-violet-600 hover:text-violet-800 transition-colors"
            onClick={() => setLabExpanded((v) => !v)}
          >
            {labExpanded ? 'Show less' : `Show all ${filteredLabOrders.length} orders`}
          </button>
        )}
      </Card>
    </div>
  );
}


