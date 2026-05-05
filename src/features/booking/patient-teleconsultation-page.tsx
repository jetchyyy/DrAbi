import {
  AlertCircle,
  CalendarClock,
  CheckCircle,
  ChevronDown,
  Clock,
  LoaderCircle,
  MonitorPlay,
  Video,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "../../components/ui/badge";
import { Card, CardTitle } from "../../components/ui/card";
import { formatDateLabel, formatDateTimeLabel, formatTimeLabel } from "../../lib/utils";
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

function getStatusBorderColor(status: Appointment["status"]) {
  if (status === "completed") return "border-l-emerald-500";
  if (status === "cancelled" || status === "no_show") return "border-l-rose-500";
  if (status === "in_progress") return "border-l-blue-500";
  if (status === "confirmed") return "border-l-emerald-400";
  return "border-l-orange-500";
}

function isPast(status: Appointment["status"]) {
  return status === "completed" || status === "cancelled" || status === "no_show";
}

export function PatientConsultationPage() {
  const { profile } = useAuth();
  const { data: appointments = [], isLoading } =
    usePatientTeleconsultAppointments();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <div className="flex items-center gap-3 text-slate-500">
            <LoaderCircle className="size-5 animate-spin" />
            Loading your teleconsult schedules...
          </div>
        </Card>
      </div>
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

  const activeAppointments = appointments.filter((a) => !isPast(a.status));
  const pastAppointments = appointments.filter((a) => isPast(a.status));
  const joinableCount = appointments.filter((a) =>
    isTeleconsultJoinableStatus(a.status),
  ).length;

  return (
    <div className="mx-auto max-w-5xl pb-16">
      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 animate-slide-left">
        <div className="border-l-4 border-orange-600 pl-4">
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-950">
            My Consultations
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            View your teleconsult appointments and join your assigned room when
            the schedule is active.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 border border-orange-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-widest text-orange-600 transition-colors hover:bg-orange-50"
          to="/portal/book"
        >
          <CalendarClock className="size-3.5" />
          Book Appointment
        </Link>
      </div>

      {/* Stats strip */}
      {appointments.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 animate-fade-up">
          <div className="border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Total
            </p>
            <p className="mt-1 text-3xl font-extrabold text-slate-950">
              {appointments.length}
            </p>
          </div>
          <div className="border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Upcoming
            </p>
            <p className="mt-1 text-3xl font-extrabold text-slate-950">
              {activeAppointments.length}
            </p>
          </div>
          <div className="col-span-2 border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm sm:col-span-1">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">
              Join Now Available
            </p>
            <p className="mt-1 text-3xl font-extrabold text-emerald-700">
              {joinableCount}
            </p>
          </div>
        </div>
      )}

      {appointments.length === 0 ? (
        <div className="flex flex-col items-center border-2 border-dashed border-slate-200 bg-white p-16 text-center animate-fade-in">
          <div className="mb-5 flex h-16 w-16 items-center justify-center border border-orange-100 bg-orange-50">
            <Video className="size-8 text-orange-600" />
          </div>
          <h3 className="mb-2 text-base font-extrabold uppercase tracking-wide text-slate-950">
            No Teleconsult Appointments
          </h3>
          <p className="mb-6 max-w-xs text-sm leading-relaxed text-slate-500">
            Once a teleconsult appointment is created for your account, it will
            appear here.
          </p>
          <Link
            to="/portal/book"
            className="inline-flex items-center gap-2 bg-orange-600 px-6 py-3 text-xs font-extrabold uppercase tracking-widest text-white transition-colors hover:bg-orange-700"
          >
            Book an Appointment <CalendarClock className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {/* ── Active / upcoming appointments ── */}
          {activeAppointments.length > 0 && (
            <div className="space-y-4">
              {activeAppointments.map((appointment, index) => {
                const joinable = isTeleconsultJoinableStatus(appointment.status);
                return (
                  <div
                    key={appointment.id}
                    className={`animate-fade-up border border-slate-200 border-l-[5px] bg-white shadow-sm transition-shadow duration-200 hover:shadow-md ${getStatusBorderColor(appointment.status)}`}
                    style={{ animationDelay: `${0.05 * index}s` }}
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="shrink-0 border border-slate-100 bg-slate-50 p-2">
                          <Video className="size-5 text-slate-700" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-extrabold uppercase leading-tight tracking-tight text-slate-950">
                            {appointment.serviceName}
                          </h3>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500">
                            Dr. {appointment.doctorName}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <Badge intent="info" className="text-[10px] font-extrabold uppercase tracking-widest">
                          {appointment.teleconsultationPlatform}
                        </Badge>
                        <Badge
                          intent={getStatusIntent(appointment.status)}
                          className="text-[10px] font-extrabold uppercase tracking-widest"
                        >
                          {getStatusLabel(appointment.status)}
                        </Badge>
                      </div>
                    </div>

                    {/* Detail strip */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-100 px-5 py-4 lg:grid-cols-4">
                      <div>
                        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          Date
                        </p>
                        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                          <CalendarClock className="size-3 shrink-0 text-orange-600" />
                          {formatDateLabel(appointment.scheduledAt)}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          Time
                        </p>
                        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                          <Clock className="size-3 shrink-0 text-orange-600" />
                          {formatTimeLabel(appointment.scheduledAt)}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          Platform
                        </p>
                        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                          <MonitorPlay className="size-3 shrink-0 text-orange-600" />
                          {appointment.teleconsultationPlatform}
                        </p>
                      </div>
                      {appointment.teleconsultationAccessInstructions ? (
                        <div>
                          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                            Instructions
                          </p>
                          <p className="line-clamp-2 border-l-2 border-slate-200 pl-2 text-xs italic leading-relaxed text-slate-600">
                            {appointment.teleconsultationAccessInstructions}
                          </p>
                        </div>
                      ) : (
                        <div className="hidden lg:block" />
                      )}
                    </div>

                    {/* Join CTA footer */}
                    <div className="border-t border-slate-100 px-5 py-3">
                      {joinable ? (
                        <Link
                          to={appointment.joinPath}
                          className="inline-flex items-center gap-2 bg-emerald-600 px-5 py-2 text-xs font-extrabold uppercase tracking-widest text-white transition-colors hover:bg-emerald-700"
                        >
                          <Video className="size-3.5" />
                          Join Teleconsult Room
                        </Link>
                      ) : (
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                          <AlertCircle className="size-3.5" />
                          Room join is not available for this status
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Past appointments: completed / cancelled / no_show ── */}
          {pastAppointments.length > 0 && (
            <div>
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                Past Consultations ({pastAppointments.length})
              </p>
              <div className="divide-y divide-slate-100 border border-slate-200 bg-white shadow-sm">
                {pastAppointments.map((appointment) => {
                  const isOpen = expandedId === appointment.id;
                  return (
                    <div key={appointment.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isOpen ? null : appointment.id)
                        }
                        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                        aria-expanded={isOpen}
                      >
                        <span className="shrink-0">
                          {appointment.status === "completed" ? (
                            <CheckCircle className="size-4 text-emerald-500" />
                          ) : (
                            <XCircle className="size-4 text-rose-500" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900">
                            {appointment.serviceName}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            Dr. {appointment.doctorName}
                            {" · "}
                            {formatDateLabel(appointment.scheduledAt)}
                          </span>
                        </div>
                        <Badge
                          intent={getStatusIntent(appointment.status)}
                          className="shrink-0 text-[10px] font-extrabold uppercase tracking-widest"
                        >
                          {getStatusLabel(appointment.status)}
                        </Badge>
                        <span className="hidden shrink-0 text-xs font-semibold text-slate-400 sm:block">
                          {appointment.teleconsultationPlatform}
                        </span>
                        <ChevronDown
                          className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isOpen && (
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-100 bg-slate-50 px-5 py-4 lg:grid-cols-4">
                          <div>
                            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                              Date &amp; Time
                            </p>
                            <p className="text-sm font-bold text-slate-900">
                              {formatDateLabel(appointment.scheduledAt)}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">
                              {formatTimeLabel(appointment.scheduledAt)}
                            </p>
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                              Doctor
                            </p>
                            <p className="text-sm font-bold text-slate-900">
                              {appointment.doctorName}
                            </p>
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                              Platform
                            </p>
                            <p className="text-sm font-bold text-slate-900">
                              {appointment.teleconsultationPlatform}
                            </p>
                          </div>
                          {appointment.teleconsultationAccessInstructions ? (
                            <div>
                              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                Instructions
                              </p>
                              <p className="line-clamp-2 border-l-2 border-slate-200 pl-2 text-xs italic leading-relaxed text-slate-600">
                                {appointment.teleconsultationAccessInstructions}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

