import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardCheck, FileSearch, Stethoscope } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useDoctorDirectory } from '../../hooks/use-clinic-data';
import { formatDateLabel, formatDateTimeLabel } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { usePatients } from '../patients/hooks/use-patients';
import { useSpecialistReferrals, useUpdateReferralOutcome } from './hooks/use-referrals';

const specialistPortalSchema = z
  .object({
    specialistVisitedAt: z.string().min(1, 'Visit date and time is required.'),
    status: z.enum(['accepted', 'completed']),
    specialistFindings: z.string(),
    specialistRecommendations: z.string(),
  })
  .superRefine((values, context) => {
    if (values.status === 'completed' && values.specialistFindings.trim().length < 8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add the specialist findings before completing the referral.',
        path: ['specialistFindings'],
      });
    }

    if (values.status === 'completed' && values.specialistRecommendations.trim().length < 8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add recommendations for the generalist before completing the referral.',
        path: ['specialistRecommendations'],
      });
    }
  });

export function SpecialistReferralsPage() {
  const { profile } = useAuth();
  const { data: doctors = [] } = useDoctorDirectory();
  const { data: patients = [] } = usePatients();

  const currentDoctor = doctors.find((doctor) => doctor.profileId === profile?.id) ?? null;
  const referralsQuery = useSpecialistReferrals(currentDoctor?.id ?? null);
  const referrals = referralsQuery.data ?? [];
  const updateReferralOutcome = useUpdateReferralOutcome(null);
  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof specialistPortalSchema>>({
    resolver: zodResolver(specialistPortalSchema),
    defaultValues: {
      specialistVisitedAt: new Date().toISOString().slice(0, 16),
      status: 'accepted',
      specialistFindings: '',
      specialistRecommendations: '',
    },
  });

  const selectedReferral = useMemo(
    () => referrals.find((referral) => referral.id === selectedReferralId) ?? referrals[0] ?? null,
    [referrals, selectedReferralId],
  );

  useEffect(() => {
    if (!selectedReferralId && referrals.length > 0) {
      setSelectedReferralId(referrals[0].id);
    }
  }, [referrals, selectedReferralId]);

  useEffect(() => {
    if (!selectedReferral) {
      form.reset({
        specialistVisitedAt: new Date().toISOString().slice(0, 16),
        status: 'accepted',
        specialistFindings: '',
        specialistRecommendations: '',
      });
      return;
    }

    form.reset({
      specialistVisitedAt: (selectedReferral.specialistVisitedAt ?? new Date().toISOString()).slice(0, 16),
      status: selectedReferral.status === 'completed' ? 'completed' : 'accepted',
      specialistFindings: selectedReferral.specialistFindings,
      specialistRecommendations: selectedReferral.specialistRecommendations,
    });
  }, [form, selectedReferral]);

  const enrichedReferrals = useMemo(
    () =>
      referrals.map((referral) => {
        const patient = patients.find((item) => item.id === referral.patientId) ?? null;
        const referringDoctor = doctors.find((doctor) => doctor.id === referral.referringDoctorId) ?? null;
        return {
          referral,
          patient,
          referringDoctor,
        };
      }),
    [doctors, patients, referrals],
  );

  const selectedReferralContext = enrichedReferrals.find((item) => item.referral.id === selectedReferral?.id) ?? null;
  const pendingCount = referrals.filter((referral) => referral.status !== 'completed' && referral.status !== 'cancelled').length;
  const completedCount = referrals.filter((referral) => referral.status === 'completed').length;

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!selectedReferral) {
      return;
    }

    try {
      await updateReferralOutcome.mutateAsync({
        referralId: selectedReferral.id,
        status: values.status,
        specialistFindings: values.specialistFindings.trim(),
        specialistRecommendations: values.specialistRecommendations.trim(),
        specialistVisitedAt: new Date(values.specialistVisitedAt).toISOString(),
      });

      toast.success(values.status === 'completed' ? 'Referral marked as completed.' : 'Referral accepted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save the specialist update.');
    }
  });

  if (profile?.role !== 'doctor' && profile?.role !== 'specialist') {
    return (
      <Card>
        <CardTitle>Specialist referrals</CardTitle>
        <p className="mt-3 text-sm text-slate-500">Only doctor and specialist accounts can use the specialist referral portal.</p>
      </Card>
    );
  }

  if (!currentDoctor) {
    return (
      <Card>
        <CardTitle>Specialist referrals</CardTitle>
        <p className="mt-3 text-sm text-slate-500">Your doctor profile is still loading or has not been linked yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 via-white to-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge intent="info">Specialist portal</Badge>
            <CardTitle className="mt-4 text-2xl">Manage incoming referrals</CardTitle>
            <p className="mt-3 max-w-3xl text-sm text-slate-600">
              When the generalist escalates a patient, this portal lets the specialist review the referral, open the chart, and send findings back to the clinic team.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-sm border border-orange-200 bg-white px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-orange-600">Assigned</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{referrals.length}</p>
            </div>
            <div className="rounded-sm border border-amber-200 bg-white px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber-600">Open</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{pendingCount}</p>
            </div>
            <div className="rounded-sm border border-emerald-200 bg-white px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-600">Completed</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{completedCount}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Referral inbox</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Referrals assigned to Dr. {currentDoctor.fullName}.</p>
            </div>
            <Badge intent={pendingCount > 0 ? 'warning' : 'success'}>{pendingCount} active</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {referralsQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading referrals...</p>
            ) : enrichedReferrals.length === 0 ? (
              <div className="rounded-sm border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <FileSearch className="mx-auto size-6 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-700">No referrals assigned yet.</p>
                <p className="mt-1 text-sm text-slate-500">Once a generalist refers a patient to you, the case will appear here.</p>
              </div>
            ) : (
              enrichedReferrals.map(({ referral, patient, referringDoctor }) => {
                const isSelected = referral.id === selectedReferral?.id;
                const isOpen = referral.status !== 'completed' && referral.status !== 'cancelled';

                return (
                  <button
                    key={referral.id}
                    className={`w-full rounded-sm border px-4 py-4 text-left transition-colors ${
                      isSelected
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-slate-200 bg-slate-50 hover:border-orange-200 hover:bg-white'
                    }`}
                    onClick={() => setSelectedReferralId(referral.id)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown patient'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">{referral.reason}</p>
                      </div>
                      <Badge intent={referral.status === 'completed' ? 'success' : isOpen ? 'warning' : 'neutral'}>
                        {referral.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      From {referringDoctor?.fullName ?? 'Generalist'} • {formatDateTimeLabel(referral.referredAt)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <div className="space-y-6">
          {selectedReferral && selectedReferralContext ? (
            <>
              <Card>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="size-5 text-orange-600" />
                      <CardTitle>Referral case summary</CardTitle>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                      Review the generalist notes first, then update the referral after the specialist visit.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge intent={selectedReferral.status === 'completed' ? 'success' : 'warning'}>
                      {selectedReferral.status.replace('_', ' ')}
                    </Badge>
                    <Link
                      className="inline-flex items-center rounded-sm border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
                      to={`/specialist/patients/${selectedReferral.patientId}`}
                    >
                      Open patient chart
                    </Link>
                    <Link
                      className="inline-flex items-center rounded-sm border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:border-sky-300 hover:bg-sky-100"
                      to={`/specialist/consultation/${selectedReferral.patientId}`}
                    >
                      Document SOAP
                    </Link>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-sm bg-slate-50 p-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Patient</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {selectedReferralContext.patient
                        ? `${selectedReferralContext.patient.firstName} ${selectedReferralContext.patient.lastName}`
                        : 'Unknown patient'}
                    </p>
                    {selectedReferralContext.patient ? (
                      <>
                        <p className="mt-2 text-sm text-slate-600">{selectedReferralContext.patient.mobileNumber}</p>
                        <p className="mt-1 text-sm text-slate-600">{selectedReferralContext.patient.email}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Birth date: {formatDateLabel(selectedReferralContext.patient.birthDate)}
                        </p>
                      </>
                    ) : null}
                    {selectedReferralContext.patient?.allergies ? (
                      <p className="mt-3 text-sm text-slate-700">
                        <span className="font-semibold text-slate-950">Allergies:</span> {selectedReferralContext.patient.allergies}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-sm bg-slate-50 p-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Referral details</p>
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-semibold text-slate-950">Referring doctor:</span> {selectedReferralContext.referringDoctor?.fullName ?? 'Generalist'}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-semibold text-slate-950">Your specialty:</span> {currentDoctor.specialtyName ?? 'Not specified'}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-semibold text-slate-950">Reason:</span> {selectedReferral.reason}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-semibold text-slate-950">Referred at:</span> {formatDateTimeLabel(selectedReferral.referredAt)}
                    </p>
                    {selectedReferral.specialistVisitedAt ? (
                      <p className="mt-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-950">Specialist visit:</span> {formatDateTimeLabel(selectedReferral.specialistVisitedAt)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-sm border border-slate-200 p-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Clinical summary</p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{selectedReferral.clinicalSummary}</p>
                  </div>
                  <div className="rounded-sm border border-slate-200 p-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Referral notes</p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{selectedReferral.referralNotes}</p>
                  </div>
                </div>

                {selectedReferral.specialistFindings || selectedReferral.specialistRecommendations ? (
                  <div className="mt-5 rounded-sm border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700">Latest specialist update</p>
                    {selectedReferral.specialistFindings ? (
                      <p className="mt-3 text-sm text-emerald-950">
                        <span className="font-semibold">Findings:</span> {selectedReferral.specialistFindings}
                      </p>
                    ) : null}
                    {selectedReferral.specialistRecommendations ? (
                      <p className="mt-2 text-sm text-emerald-950">
                        <span className="font-semibold">Recommendations:</span> {selectedReferral.specialistRecommendations}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Card>

              <Card>
                <div className="flex items-center gap-3">
                  <Stethoscope className="size-5 text-orange-600" />
                  <CardTitle>Specialist update</CardTitle>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  Use <strong>Accepted</strong> when you acknowledge the referral and <strong>Completed</strong> when findings and recommendations are ready for the generalist.
                </p>

                <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField error={form.formState.errors.specialistVisitedAt?.message} label="Visit date and time">
                      <Input type="datetime-local" {...form.register('specialistVisitedAt')} />
                    </FormField>
                    <FormField error={form.formState.errors.status?.message} label="Referral status">
                      <Select {...form.register('status')}>
                        <option value="accepted">Accepted</option>
                        <option value="completed">Completed</option>
                      </Select>
                    </FormField>
                  </div>

                  <FormField error={form.formState.errors.specialistFindings?.message} label="Findings during specialist visit">
                    <Textarea rows={5} {...form.register('specialistFindings')} />
                  </FormField>

                  <FormField error={form.formState.errors.specialistRecommendations?.message} label="Recommendations for the generalist">
                    <Textarea rows={5} {...form.register('specialistRecommendations')} />
                  </FormField>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-500">
                      Patient chart stays available if you need the full history before closing the referral.
                    </p>
                    <Button disabled={updateReferralOutcome.isPending} type="submit">
                      {updateReferralOutcome.isPending ? 'Saving...' : 'Save specialist update'}
                    </Button>
                  </div>
                </form>
              </Card>
            </>
          ) : (
            <Card>
              <CardTitle>Referral case summary</CardTitle>
              <p className="mt-3 text-sm text-slate-500">Select a referral from the inbox to review the patient and document your specialist findings.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
