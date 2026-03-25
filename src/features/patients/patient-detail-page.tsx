import { FileText, Pill, TestTubeDiagonal } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { Badge } from '../../components/ui/badge';
import { Card, CardTitle } from '../../components/ui/card';
import { getDatabase, getPatientById } from '../../lib/local-db';
import { formatDateLabel, formatDateTimeLabel } from '../../lib/utils';

export function PatientDetailPage() {
  const { patientId = '' } = useParams();
  const patient = getPatientById(patientId);
  const database = getDatabase();

  if (!patient) {
    return (
      <Card>
        <CardTitle>Patient not found</CardTitle>
      </Card>
    );
  }

  const visits = database.appointments.filter((appointment) => appointment.patientId === patient.id);
  const consultations = database.consultations.filter((consultation) => consultation.patientId === patient.id);
  const prescriptions = database.prescriptions.filter((prescription) => prescription.patientId === patient.id);
  const labOrders = database.labOrders.filter((order) => order.patientId === patient.id);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Patient chart</p>
            <CardTitle className="mt-2 text-3xl">
              {patient.firstName} {patient.lastName}
            </CardTitle>
            <p className="mt-2 text-sm text-slate-500">{patient.email} • {patient.mobileNumber}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{patient.bloodType || 'Blood type pending'}</Badge>
            <Badge intent="warning">{patient.allergies}</Badge>
          </div>
        </div>
      </Card>

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
                  <p className="font-medium text-slate-950">{formatDateTimeLabel(visit.scheduledAt)}</p>
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
    </div>
  );
}

