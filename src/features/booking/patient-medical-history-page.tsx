import {
  Activity,
  CalendarDays,
  ClipboardList,
  FileText,
  Stethoscope,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { Card, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useDoctorDirectory, useServicesCatalog } from '../../hooks/use-clinic-data';
import { formatDateLabel, formatDateTimeLabel } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { LabResultsDisplay } from '../consultation/components/lab-results-display';
import { useCurrentPatient } from './hooks/use-bookings';
import {
  usePatientAppointments,
  usePatientBookings,
  usePatientConsultations,
} from '../patients/hooks/use-patients';

function getAppointmentStatusIntent(status: string) {
  if (status === 'completed') return 'success' as const;
  if (status === 'cancelled' || status === 'no_show') return 'danger' as const;
  return 'info' as const;
}

function getBookingStatusIntent(status: string) {
  if (status === 'confirmed') return 'success' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'warning' as const;
}

export function PatientMedicalHistoryPage() {
  const { profile, session } = useAuth();
  const { data: currentPatient, isLoading: isPatientLoading } = useCurrentPatient(
    session?.user.id ?? null,
    profile?.email,
  );
  const { data: doctors = [] } = useDoctorDirectory();
  const { data: services = [] } = useServicesCatalog();
  const { data: appointments = [], isLoading: isAppointmentsLoading } = usePatientAppointments(currentPatient?.id ?? null);
  const { data: bookings = [], isLoading: isBookingsLoading } = usePatientBookings(currentPatient?.id ?? null);
  const { data: consultations = [], isLoading: isConsultationsLoading } = usePatientConsultations(currentPatient?.id ?? null);

  const appointmentTimeline = useMemo(
    () =>
      [...appointments].sort((left, right) =>
        right.scheduledAt.localeCompare(left.scheduledAt),
      ),
    [appointments],
  );

  const consultationTimeline = useMemo(
    () =>
      [...consultations].sort((left, right) =>
        `${right.consultationDate}T${right.consultationTime}`.localeCompare(
          `${left.consultationDate}T${left.consultationTime}`,
        ),
      ),
    [consultations],
  );

  const bookingTimeline = useMemo(
    () =>
      [...bookings].sort((left, right) =>
        `${right.preferredDate}T${right.preferredTime}`.localeCompare(
          `${left.preferredDate}T${left.preferredTime}`,
        ),
      ),
    [bookings],
  );

  const completedVisits = appointmentTimeline.filter(
    (appointment) => appointment.status === 'completed',
  );
  const totalConsultations = consultationTimeline.length;
  const lastVisit = completedVisits[0] ?? appointmentTimeline[0] ?? null;

  if (
    isPatientLoading ||
    isAppointmentsLoading ||
    isBookingsLoading ||
    isConsultationsLoading
  ) {
    return (
      <Card>
        <CardTitle>Loading medical history...</CardTitle>
      </Card>
    );
  }

  if (!currentPatient) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardTitle>Medical history unavailable</CardTitle>
        <p className="mt-3 text-sm text-slate-500">
          We couldn&apos;t find your linked patient record yet. Once the clinic
          account is connected, your visit history will appear here.
        </p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="border-l-4 border-orange-600 pl-4">
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-950">
            My Medical History
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
            Review your previous clinic visits, consultation notes, and booking
            requests in one place.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 border border-orange-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-widest text-orange-600 transition-colors hover:bg-orange-50"
          to="/portal/book"
        >
          <CalendarDays className="size-4" />
          Book Another Visit
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-orange-500">
          <div className="flex items-center gap-3">
            <div className="rounded-none bg-orange-100 p-3 text-orange-700">
              <Activity className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                Clinic visits
              </p>
              <p className="mt-1 text-3xl font-extrabold text-slate-950">
                {completedVisits.length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-slate-900">
          <div className="flex items-center gap-3">
            <div className="rounded-none bg-slate-100 p-3 text-slate-800">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                Consultation records
              </p>
              <p className="mt-1 text-3xl font-extrabold text-slate-950">
                {totalConsultations}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3">
            <div className="rounded-none bg-emerald-100 p-3 text-emerald-700">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                Last recorded visit
              </p>
              <p className="mt-1 text-base font-extrabold text-slate-950">
                {lastVisit ? formatDateTimeLabel(lastVisit.scheduledAt) : 'No visit yet'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-none bg-orange-600 p-3 text-white">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
                Profile history
              </p>
              <CardTitle className="mt-1">Medical notes on file</CardTitle>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                Recorded medical history
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {currentPatient.medicalHistory?.trim() || 'No medical history recorded yet.'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                Allergy notes
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {currentPatient.allergies?.trim() || 'No allergy notes recorded yet.'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                Visit status
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {currentPatient.visitStatus === 'visited_clinic'
                  ? 'Visited clinic'
                  : 'Registered, no visit yet'}
              </p>
              {currentPatient.lastClinicVisitAt ? (
                <p className="mt-1 text-sm text-slate-500">
                  Last clinic visit: {formatDateTimeLabel(currentPatient.lastClinicVisitAt)}
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-none bg-slate-900 p-3 text-white">
              <Stethoscope className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                Visit timeline
              </p>
              <CardTitle className="mt-1">Previous records and clinic visits</CardTitle>
            </div>
          </div>

          {appointmentTimeline.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-base font-semibold text-slate-800">
                No clinic visits recorded yet.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Once the clinic confirms and records your appointment, it will
                appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {appointmentTimeline.map((appointment) => {
                const doctor = doctors.find(
                  (entry) => entry.id === appointment.doctorId,
                );
                const service = services.find(
                  (entry) => entry.id === appointment.serviceId,
                );
                const linkedConsultation =
                  consultationTimeline.find(
                    (consultation) =>
                      consultation.appointmentId === appointment.id,
                  ) ?? null;

                return (
                  <div
                    key={appointment.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-slate-950">
                          {service?.name ?? 'Clinic appointment'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDateTimeLabel(appointment.scheduledAt)}
                        </p>
                      </div>
                      <Badge intent={getAppointmentStatusIntent(appointment.status)}>
                        {appointment.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          Provider
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {doctor?.fullName ?? 'Clinic team'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          Visit type
                        </p>
                        <p className="mt-1 text-sm font-semibold capitalize text-slate-700">
                          {appointment.visitType.replace('_', ' ')}
                        </p>
                      </div>
                    </div>

                    {appointment.reason?.trim() ? (
                      <div className="mt-4 border-l-2 border-orange-200 pl-3">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          Reason for visit
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-700">
                          {appointment.reason}
                        </p>
                      </div>
                    ) : null}

                    {linkedConsultation ? (
                      <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
                          Consultation summary
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">
                          {linkedConsultation.consultationType} with{' '}
                          {linkedConsultation.providerName}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700">
                          {linkedConsultation.clinicalSummary?.trim() ||
                            linkedConsultation.assessment?.trim() ||
                            linkedConsultation.plan?.trim() ||
                            'No written consultation summary yet.'}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Consultation archive</CardTitle>
          {consultationTimeline.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No consultation notes have been saved for your account yet.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {consultationTimeline.map((consultation) => (
                <div
                  key={consultation.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">
                        {consultation.consultationType}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatDateLabel(consultation.consultationDate)} at{' '}
                        {consultation.consultationTime}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      {consultation.providerName}
                    </p>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-700">
                    {consultation.clinicalSummary?.trim() ||
                      consultation.assessment?.trim() ||
                      consultation.plan?.trim() ||
                      'No consultation summary available.'}
                  </p>

                  {consultation.labResults?.trim() ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                        Lab results
                      </p>
                      <div className="mt-2">
                        <LabResultsDisplay value={consultation.labResults} />
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Booking history</CardTitle>
          {bookingTimeline.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No booking requests have been submitted from this account yet.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {bookingTimeline.map((booking) => {
                const doctor = doctors.find((entry) => entry.id === booking.doctorId);
                const service = services.find((entry) => entry.id === booking.serviceId);

                return (
                  <div
                    key={booking.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">
                          {service?.name ?? 'Clinic booking'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDateLabel(booking.preferredDate)} at {booking.preferredTime}
                        </p>
                      </div>
                      <Badge intent={getBookingStatusIntent(booking.status)}>
                        {booking.status}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          Doctor
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {doctor?.fullName ?? 'Clinic medical service'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          Payment
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {booking.paymentStatus === 'paid'
                            ? 'Paid at cashier'
                            : 'Pending cashier payment'}
                        </p>
                      </div>
                    </div>

                    {booking.intakeNotes?.trim() ? (
                      <p className="mt-4 border-l-2 border-slate-200 pl-3 text-sm italic leading-relaxed text-slate-600">
                        {booking.intakeNotes}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
