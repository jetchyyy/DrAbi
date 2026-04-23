import { AlertCircle, CalendarClock, LoaderCircle, Video } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "../../components/ui/badge";
import { Card, CardTitle } from "../../components/ui/card";
import { formatDateTimeLabel } from "../../lib/utils";
import type { Appointment } from "../../types/domain";
import { useAuth } from "../auth/auth-context";
import { isTeleconsultJoinableStatus } from "../teleconsult/teleconsult-data";
import { usePatientTeleconsultAppointments } from "../patients/hooks/use-patients";

function getStatusIntent(status: Appointment["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled" || status === "no_show") return "danger" as const;
  if (status === "confirmed" || status === "in_progress")
    return "info" as const;
  return "warning" as const;
}

function getStatusLabel(status: Appointment["status"]) {
  return status.replaceAll("_", " ");
}

export function PatientConsultationPage() {
  const { profile } = useAuth();
  const { data: appointments = [], isLoading } =
    usePatientTeleconsultAppointments();

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center gap-3 text-slate-500">
          <LoaderCircle className="size-5 animate-spin" />
          Loading your teleconsult schedules...
        </div>
      </Card>
    );
  }

  if (profile?.role !== "patient") {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardTitle>Teleconsult access unavailable</CardTitle>
        <p className="mt-3 text-sm text-slate-500">
          This page is only available for patient accounts.
        </p>
      </Card>
    );
  }

  const joinableAppointments = appointments.filter((appointment) =>
    isTeleconsultJoinableStatus(appointment.status),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="border-l-4 border-orange-600 pl-4">
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-950">
            My Teleconsult Rooms
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
            View your teleconsult appointments and join your assigned room when
            the schedule is active.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 border border-orange-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-widest text-orange-600 transition-colors hover:bg-orange-50"
          to="/portal/my-bookings"
        >
          <CalendarClock className="size-4" />
          My Bookings
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-orange-500">
          <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
            Teleconsult appointments
          </p>
          <p className="mt-2 text-3xl font-extrabold text-slate-950">
            {appointments.length}
          </p>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
            Join now available
          </p>
          <p className="mt-2 text-3xl font-extrabold text-slate-950">
            {joinableAppointments.length}
          </p>
        </Card>
      </div>

      {appointments.length === 0 ? (
        <Card>
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 text-amber-500" />
            <div>
              <CardTitle>No teleconsult schedule yet</CardTitle>
              <p className="mt-2 text-sm text-slate-500">
                Once a teleconsult appointment is created for your account, it
                will appear here.
              </p>
              <Link
                className="mt-4 inline-flex text-sm font-semibold text-[var(--color-primary)]"
                to="/portal/book"
              >
                Book appointment
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <Card
              key={appointment.id}
              className="border-l-4 border-l-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-slate-900 p-3 text-white">
                    <Video className="size-5" />
                  </div>
                  <div>
                    <CardTitle>{appointment.serviceName}</CardTitle>
                    <p className="mt-2 text-sm text-slate-500">
                      {formatDateTimeLabel(appointment.scheduledAt)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Doctor: {appointment.doctorName}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {appointment.teleconsultationAccessInstructions}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-right">
                  <Badge intent="info">
                    {appointment.teleconsultationPlatform}
                  </Badge>
                  <div>
                    <Badge
                      intent={getStatusIntent(appointment.status)}
                      className="uppercase tracking-wide"
                    >
                      {getStatusLabel(appointment.status)}
                    </Badge>
                  </div>
                  {isTeleconsultJoinableStatus(appointment.status) ? (
                    <Link
                      className="inline-flex text-sm font-semibold text-[var(--color-primary)]"
                      to={appointment.joinPath}
                    >
                      Join teleconsult
                    </Link>
                  ) : (
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Join is disabled for this status
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
