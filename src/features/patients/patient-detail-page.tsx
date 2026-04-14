import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { Badge } from '../../components/ui/badge';
import { Card, CardTitle } from '../../components/ui/card';
import { formatDateLabel, formatDateTimeLabel } from '../../lib/utils';
import { usePatientAppointments, usePatientConsultations, usePatientDetail } from './hooks/use-patients';

function formatPatientName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function formatPatientAge(birthDate: string) {
  const parsedBirthDate = new Date(birthDate);

  if (Number.isNaN(parsedBirthDate.getTime())) {
    return 'Unknown age';
  }

  const today = new Date();
  let age = today.getFullYear() - parsedBirthDate.getFullYear();
  const monthDifference = today.getMonth() - parsedBirthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < parsedBirthDate.getDate())) {
    age -= 1;
  }

  return `${age} year${age === 1 ? '' : 's'} old`;
}

function formatOptionalValue(value?: string | null) {
  return value?.trim() ? value : 'Not recorded';
}

function formatLongText(value?: string | null) {
  return value?.trim() ? value : 'No details recorded';
}

function getConsultationTypeLabel(consultationType: string) {
  return consultationType
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function PatientDetailPage() {
  const { patientId = '' } = useParams();
  const patientQuery = usePatientDetail(patientId || null);
  const { data: patient } = patientQuery;
  const { data: visits = [] } = usePatientAppointments(patientId || null);
  const { data: consultations = [] } = usePatientConsultations(patientId || null);

  const consultationTimeline = useMemo(
    () =>
      consultations.map((consultation) => ({
        consultation,
        appointment: visits.find((visit) => visit.id === consultation.appointmentId) ?? null,
      })),
    [consultations, visits],
  );

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

  const patientName = formatPatientName(patient.firstName, patient.lastName);
  const patientAge = formatPatientAge(patient.birthDate);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-2xl">{patientName}</CardTitle>
              <Badge intent={patient.visitStatus === 'visited_clinic' ? 'info' : 'neutral'}>
                {patient.visitStatus === 'visited_clinic' ? 'Visited clinic' : 'Registered only'}
              </Badge>
            </div>
            <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
              <p>
                <span className="font-semibold text-slate-950">Age:</span> {patientAge}
              </p>
              <p>
                <span className="font-semibold text-slate-950">Sex:</span> {patient.sex}
              </p>
              <p>
                <span className="font-semibold text-slate-950">Contact:</span> {formatOptionalValue(patient.mobileNumber)}
              </p>
              <p>
                <span className="font-semibold text-slate-950">Email:</span> {formatOptionalValue(patient.email)}
              </p>
              <p>
                <span className="font-semibold text-slate-950">Patient ID:</span> {patient.id}
              </p>
              <p>
                <span className="font-semibold text-slate-950">QR code:</span> {patient.qrCode}
              </p>
              <p>
                <span className="font-semibold text-slate-950">Intake source:</span> {patient.intakeSource.replace(/_/g, ' ')}
              </p>
              <p>
                <span className="font-semibold text-slate-950">Last clinic visit:</span> {patient.lastClinicVisitAt ? formatDateTimeLabel(patient.lastClinicVisitAt) : 'No clinic visit yet'}
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:min-w-[22rem]">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Blood type</p>
              <p className="mt-1 font-medium text-slate-950">{formatOptionalValue(patient.bloodType)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Birth date</p>
              <p className="mt-1 font-medium text-slate-950">{formatDateLabel(patient.birthDate)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Emergency contact</p>
              <p className="mt-1 font-medium text-slate-950">{formatOptionalValue(patient.emergencyContactName)}</p>
              <p className="text-sm text-slate-500">{formatOptionalValue(patient.emergencyContactPhone)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Address</p>
              <p className="mt-1 font-medium text-slate-950">{formatOptionalValue(patient.address)}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardTitle>Consultation history</CardTitle>
          <div className="mt-5 space-y-4">
            {consultationTimeline.length === 0 ? (
              <p className="text-sm text-slate-500">No consultations have been recorded for this patient yet.</p>
            ) : (
              consultationTimeline.map(({ consultation, appointment }) => (
                <details
                  key={consultation.id}
                  className="group rounded-3xl border border-slate-200 bg-slate-50 p-4 transition-colors open:bg-white open:shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">
                        {appointment ? formatDateTimeLabel(appointment.scheduledAt) : `${consultation.consultationDate} ${consultation.consultationTime}`}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{consultation.providerName}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge intent="info">Consultation</Badge>
                      <Badge intent="neutral">{getConsultationTypeLabel(consultation.consultationType || 'Consultation')}</Badge>
                      <span className="text-xs font-medium text-slate-400">Expand to view full record</span>
                    </div>
                  </summary>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3 text-sm text-slate-700">
                      <p>
                        <span className="font-semibold text-slate-950">Appointment:</span>{' '}
                        {appointment ? formatDateTimeLabel(appointment.scheduledAt) : 'No linked appointment'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Provider:</span> {consultation.providerName}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Type:</span> {getConsultationTypeLabel(consultation.consultationType || 'Consultation')}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Consultation date:</span> {formatOptionalValue(consultation.consultationDate)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Consultation time:</span> {formatOptionalValue(consultation.consultationTime)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Outcome:</span> {formatLongText(consultation.outcome)}
                      </p>
                    </div>

                    <div className="space-y-3 text-sm text-slate-700">
                      <p>
                        <span className="font-semibold text-slate-950">Clinical summary:</span> {formatLongText(consultation.clinicalSummary)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Present illness history:</span> {formatLongText(consultation.presentIllnessHistory)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Review of symptoms:</span> {formatLongText(consultation.reviewOfSymptoms)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Allergies:</span> {formatLongText(consultation.allergies)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Vitals:</span> {formatLongText(consultation.vitals)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Diagnosis:</span> {formatLongText(consultation.diagnosis)}
                      </p>
                    </div>

                    <div className="space-y-3 text-sm text-slate-700">
                      <p>
                        <span className="font-semibold text-slate-950">Differential diagnosis:</span> {formatLongText(consultation.differentialDiagnosis)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Subjective:</span> {formatLongText(consultation.subjective)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Objective:</span> {formatLongText(consultation.objective)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Assessment:</span> {formatLongText(consultation.assessment)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Plan:</span> {formatLongText(consultation.plan)}
                      </p>
                    </div>

                    <div className="space-y-3 text-sm text-slate-700">
                      <p>
                        <span className="font-semibold text-slate-950">Treatment plan:</span> {formatLongText(consultation.treatmentPlan)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Medications:</span> {formatLongText(consultation.medications)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-950">Lab results:</span> {formatLongText(consultation.labResults)}
                      </p>
                    </div>
                  </div>
                </details>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Medical Record</CardTitle>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-400">Birth date</dt>
              <dd className="font-medium text-slate-950">{formatDateLabel(patient.birthDate)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Sex</dt>
              <dd className="font-medium text-slate-950">{patient.sex}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Blood type</dt>
              <dd className="font-medium text-slate-950">{formatOptionalValue(patient.bloodType)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Allergies</dt>
              <dd className="font-medium text-slate-950">{formatLongText(patient.allergies)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Medical history</dt>
              <dd className="font-medium text-slate-950">{formatLongText(patient.medicalHistory)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Emergency contact</dt>
              <dd className="font-medium text-slate-950">
                {formatOptionalValue(patient.emergencyContactName)} • {formatOptionalValue(patient.emergencyContactPhone)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Address</dt>
              <dd className="font-medium text-slate-950">{formatLongText(patient.address)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <CardTitle>Visit History</CardTitle>
        <div className="mt-5 space-y-4">
          {visits.length === 0 ? (
            <p className="text-sm text-slate-500">No visits have been recorded for this patient yet.</p>
          ) : (
            visits.map((visit) => (
              <div key={visit.id} className="rounded-3xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium text-slate-950">{formatDateTimeLabel(visit.scheduledAt)}</p>
                  <Badge intent="neutral">Visit</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">{visit.reason}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}


