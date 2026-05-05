import {
  Activity,
  AlertCircle,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  FileText,
  FlaskConical,
  LoaderCircle,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Card, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  useDoctorDirectory,
  useServicesCatalog,
} from "../../hooks/use-clinic-data";
import {
  formatTimeLabel,
  formatDateLabel,
  formatDateTimeLabel,
} from "../../lib/utils";
import { useAuth } from "../auth/auth-context";
import { LabResultsDisplay } from "../consultation/components/lab-results-display";
import { AppointmentLabRequestsCard } from "../lab-requests/components/appointment-lab-requests-card";
import { useCurrentPatient } from "./hooks/use-bookings";
import {
  usePatientAppointments,
  usePatientBookings,
  usePatientConsultations,
} from "../patients/hooks/use-patients";

function getAppointmentStatusIntent(status: string) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled" || status === "no_show") return "danger" as const;
  return "info" as const;
}

function getBookingStatusIntent(status: string) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  return "warning" as const;
}

type Tab = "visits" | "consultations" | "bookings";

export function PatientMedicalHistoryPage() {
  const { profile, session } = useAuth();
  const { data: currentPatient, isLoading: isPatientLoading } =
    useCurrentPatient(session?.user.id ?? null, profile?.email);
  const { data: doctors = [] } = useDoctorDirectory();
  const directBookableDoctors = useMemo(
    () => doctors.filter((doctor) => doctor.role === "doctor"),
    [doctors],
  );
  const { data: services = [] } = useServicesCatalog();
  const { data: appointments = [], isLoading: isAppointmentsLoading } =
    usePatientAppointments(currentPatient?.id ?? null);
  const { data: bookings = [], isLoading: isBookingsLoading } =
    usePatientBookings(currentPatient?.id ?? null);
  const { data: consultations = [], isLoading: isConsultationsLoading } =
    usePatientConsultations(currentPatient?.id ?? null);

  const [activeTab, setActiveTab] = useState<Tab>("visits");
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [expandedConsultId, setExpandedConsultId] = useState<string | null>(null);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [showFullMedicalHistory, setShowFullMedicalHistory] = useState(false);
  const [showFullAllergies, setShowFullAllergies] = useState(false);

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
    (appointment) => appointment.status === "completed",
  );
  const totalConsultations = consultationTimeline.length;
  const lastVisit = completedVisits[0] ?? appointmentTimeline[0] ?? null;
  const medicalHistoryText = currentPatient?.medicalHistory?.trim() || "None recorded.";
  const allergiesText = currentPatient?.allergies?.trim() || "None recorded.";
  const canExpandMedicalHistory = medicalHistoryText.length > 120;
  const canExpandAllergies = allergiesText.length > 120;

  if (
    isPatientLoading ||
    isAppointmentsLoading ||
    isBookingsLoading ||
    isConsultationsLoading
  ) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <div className="flex items-center gap-3 text-slate-500">
            <LoaderCircle className="size-5 animate-spin" />
            Loading medical history...
          </div>
        </Card>
      </div>
    );
  }

  if (!currentPatient) {
    return (
      <Card className="mx-auto max-w-3xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 text-amber-500" />
          <div>
            <CardTitle>Medical history unavailable</CardTitle>
            <p className="mt-3 text-sm text-slate-500">
              We couldn&apos;t find your linked patient record yet. Once the clinic
              account is connected, your visit history will appear here.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const tabs: { id: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    {
      id: "visits",
      label: "Clinic Visits",
      count: appointmentTimeline.length,
      icon: <Stethoscope className="size-4" />,
    },
    {
      id: "consultations",
      label: "Consultations",
      count: consultationTimeline.length,
      icon: <ClipboardList className="size-4" />,
    },
    {
      id: "bookings",
      label: "Booking History",
      count: bookingTimeline.length,
      icon: <CalendarClock className="size-4" />,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl pb-16">
      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 animate-slide-left">
        <div className="border-l-4 border-orange-600 pl-4">
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-950">
            My Medical History
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Review your previous clinic visits, consultation notes, and booking
            requests in one place.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 border border-orange-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-widest text-orange-600 transition-colors hover:bg-orange-50"
          to="/portal/book"
        >
          <CalendarDays className="size-3.5" />
          Book Another Visit
        </Link>
      </div>

      {/* Stats strip */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4 animate-fade-up">
        <div className="border border-orange-200 bg-orange-50 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
            Clinic Visits
          </p>
          <p className="mt-1 text-3xl font-extrabold text-orange-900">
            {appointmentTimeline.length}
          </p>
        </div>
        <div className="border border-blue-200 bg-blue-50 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-700">
            Consultations
          </p>
          <p className="mt-1 text-3xl font-extrabold text-blue-900">
            {totalConsultations}
          </p>
        </div>
        <div className="border border-violet-200 bg-violet-50 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-700">
            Bookings
          </p>
          <p className="mt-1 text-3xl font-extrabold text-violet-900">
            {bookingTimeline.length}
          </p>
        </div>
        <div className="border border-emerald-300 bg-emerald-50 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">
            Last Visit
          </p>
          <p className="mt-1 text-sm font-extrabold leading-tight text-emerald-800">
            {lastVisit
              ? formatDateTimeLabel(lastVisit.scheduledAt)
              : "—"}
          </p>
        </div>
      </div>

      {/* Profile notes — always visible, compact horizontal strip */}
      <div className="mb-8 grid grid-cols-1 gap-4 border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3 animate-fade-up">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 border border-orange-100 bg-orange-50 p-2">
            <FileText className="size-4 text-orange-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Medical History
            </p>
            <div className="relative mt-1">
              <p
                className={`text-xs leading-relaxed text-slate-700 ${showFullMedicalHistory ? "" : "line-clamp-3"}`}
              >
                {medicalHistoryText}
              </p>
              {!showFullMedicalHistory && canExpandMedicalHistory ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white to-transparent"
                />
              ) : null}
            </div>
            {canExpandMedicalHistory ? (
              <button
                type="button"
                className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-600 hover:text-orange-700"
                onClick={() => setShowFullMedicalHistory((value) => !value)}
              >
                {showFullMedicalHistory ? "Show less" : "Show more"}
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 border border-rose-100 bg-rose-50 p-2">
            <Activity className="size-4 text-rose-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Allergies
            </p>
            <div className="relative mt-1">
              <p
                className={`text-xs leading-relaxed text-slate-700 ${showFullAllergies ? "" : "line-clamp-3"}`}
              >
                {allergiesText}
              </p>
              {!showFullAllergies && canExpandAllergies ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white to-transparent"
                />
              ) : null}
            </div>
            {canExpandAllergies ? (
              <button
                type="button"
                className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-600 hover:text-orange-700"
                onClick={() => setShowFullAllergies((value) => !value)}
              >
                {showFullAllergies ? "Show less" : "Show more"}
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 border border-slate-100 bg-slate-50 p-2">
            <CheckCircle className="size-4 text-slate-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Visit Status
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-700">
              {currentPatient.visitStatus === "visited_clinic"
                ? "Visited clinic"
                : "Registered, no visit yet"}
            </p>
            {currentPatient.lastClinicVisitAt ? (
              <p className="mt-0.5 text-[10px] text-slate-500">
                Last: {formatDateTimeLabel(currentPatient.lastClinicVisitAt)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-0 flex border-b border-slate-200 animate-fade-up">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-extrabold uppercase tracking-widest transition-colors ${
              activeTab === tab.id
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                activeTab === tab.id
                  ? "bg-orange-100 text-orange-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="border border-t-0 border-slate-200 bg-white shadow-sm">

        {/* ── Clinic Visits tab ── */}
        {activeTab === "visits" && (
          <div>
            {appointmentTimeline.length === 0 ? (
              <div className="flex flex-col items-center border-dashed p-12 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center border border-slate-100 bg-slate-50">
                  <Stethoscope className="size-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-700">
                  No clinic visits recorded yet.
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Once the clinic confirms and records your appointment, it will
                  appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {appointmentTimeline.map((appointment) => {
                  const doctor = doctors.find(
                    (entry) =>
                      entry.role === "doctor" &&
                      entry.id === appointment.doctorId,
                  );
                  const service = services.find(
                    (entry) => entry.id === appointment.serviceId,
                  );
                  const linkedConsultation =
                    consultationTimeline.find(
                      (consultation) =>
                        consultation.appointmentId === appointment.id,
                    ) ?? null;
                  const isOpen = expandedVisitId === appointment.id;

                  return (
                    <div key={appointment.id}>
                      {/* Accordion trigger */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedVisitId(isOpen ? null : appointment.id)
                        }
                        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                        aria-expanded={isOpen}
                      >
                        <span className="shrink-0">
                          {appointment.status === "completed" ? (
                            <CheckCircle className="size-4 text-emerald-500" />
                          ) : appointment.status === "cancelled" ||
                            appointment.status === "no_show" ? (
                            <XCircle className="size-4 text-rose-500" />
                          ) : (
                            <Stethoscope className="size-4 text-orange-500" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900">
                            {service?.name ?? "Clinic appointment"}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {doctor?.fullName ?? "Clinic team"}
                            {" · "}
                            {formatDateLabel(appointment.scheduledAt)}
                          </span>
                        </div>
                        <Badge
                          intent={getAppointmentStatusIntent(appointment.status)}
                          className="shrink-0 text-[10px] font-extrabold uppercase tracking-widest"
                        >
                          {appointment.status.replace("_", " ")}
                        </Badge>
                        {linkedConsultation && (
                          <span className="hidden shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-orange-600 sm:flex">
                            <ClipboardList className="size-3" /> Notes
                          </span>
                        )}
                        <ChevronDown
                          className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {/* Expanded panel */}
                      {isOpen && (
                        <div className="border-t border-slate-100 bg-slate-50 px-5 py-5">
                          {/* 4-col detail strip */}
                          <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
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
                                Provider
                              </p>
                              <p className="text-sm font-bold text-slate-900">
                                {doctor?.fullName ?? "Clinic team"}
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                Visit type
                              </p>
                              <p className="text-sm font-bold capitalize text-slate-900">
                                {appointment.visitType.replace("_", " ")}
                              </p>
                            </div>
                            {appointment.reason?.trim() ? (
                              <div>
                                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                  Reason
                                </p>
                                <p className="border-l-2 border-slate-300 pl-2 text-xs italic leading-relaxed text-slate-600">
                                  {appointment.reason}
                                </p>
                              </div>
                            ) : null}
                          </div>

                          {/* Consultation summary */}
                          {linkedConsultation ? (
                            <div className="mt-4 border border-orange-100 bg-orange-50 px-4 py-3">
                              <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
                                Consultation summary
                              </p>
                              <p className="mt-1.5 text-xs font-semibold text-slate-700">
                                {linkedConsultation.consultationType} with{" "}
                                {linkedConsultation.providerName}
                              </p>
                              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                                {linkedConsultation.clinicalSummary?.trim() ||
                                  linkedConsultation.assessment?.trim() ||
                                  linkedConsultation.plan?.trim() ||
                                  "No written consultation summary yet."}
                              </p>
                            </div>
                          ) : null}

                          {/* Lab requests */}
                          <div className="mt-4">
                            <AppointmentLabRequestsCard
                              appointmentId={appointment.id}
                              canCreate={false}
                              patientId={currentPatient.id}
                              requestedBy={doctor?.id ?? ""}
                              title="Lab requests for this appointment"
                              compact
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Consultations tab ── */}
        {activeTab === "consultations" && (
          <div>
            {consultationTimeline.length === 0 ? (
              <div className="flex flex-col items-center p-12 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center border border-slate-100 bg-slate-50">
                  <ClipboardList className="size-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-700">
                  No consultation notes yet.
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Consultation notes saved by clinic staff will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {consultationTimeline.map((consultation) => {
                  const isOpen = expandedConsultId === consultation.id;
                  const hasSummary =
                    consultation.clinicalSummary?.trim() ||
                    consultation.assessment?.trim() ||
                    consultation.plan?.trim();
                  const hasLab = consultation.labResults?.trim();

                  return (
                    <div key={consultation.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedConsultId(isOpen ? null : consultation.id)
                        }
                        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                        aria-expanded={isOpen}
                      >
                        <ClipboardList className="size-4 shrink-0 text-orange-500" />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900">
                            {consultation.consultationType}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {consultation.providerName}
                            {" · "}
                            {formatDateLabel(consultation.consultationDate)}
                          </span>
                        </div>
                        {hasLab && (
                          <span className="hidden shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-blue-600 sm:flex">
                            <FlaskConical className="size-3" /> Lab
                          </span>
                        )}
                        <ChevronDown
                          className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isOpen && (
                        <div className="border-t border-slate-100 bg-slate-50 px-5 py-5">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-3">
                            <div>
                              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                Date &amp; Time
                              </p>
                              <p className="text-sm font-bold text-slate-900">
                                {formatDateLabel(consultation.consultationDate)}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {formatTimeLabel(
                                  `${consultation.consultationDate} ${consultation.consultationTime}`,
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                Provider
                              </p>
                              <p className="text-sm font-bold text-slate-900">
                                {consultation.providerName}
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                Type
                              </p>
                              <p className="text-sm font-bold text-slate-900">
                                {consultation.consultationType}
                              </p>
                            </div>
                          </div>

                          {hasSummary ? (
                            <div className="mt-4 border-l-2 border-orange-300 bg-orange-50 py-2 pl-3 pr-4">
                              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
                                Summary / Notes
                              </p>
                              <p className="text-xs leading-relaxed text-slate-700">
                                {consultation.clinicalSummary?.trim() ||
                                  consultation.assessment?.trim() ||
                                  consultation.plan?.trim()}
                              </p>
                            </div>
                          ) : (
                            <p className="mt-4 text-xs text-slate-400 italic">
                              No consultation summary available.
                            </p>
                          )}

                          {hasLab ? (
                            <div className="mt-4 border border-slate-200 bg-white px-4 py-3">
                              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                Lab results
                              </p>
                              <LabResultsDisplay value={consultation.labResults!} />
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Booking History tab ── */}
        {activeTab === "bookings" && (
          <div>
            {bookingTimeline.length === 0 ? (
              <div className="flex flex-col items-center p-12 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center border border-slate-100 bg-slate-50">
                  <BookOpen className="size-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-700">
                  No booking requests yet.
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Booking requests submitted from this account will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bookingTimeline.map((booking) => {
                  const doctor = directBookableDoctors.find(
                    (entry) => entry.id === booking.doctorId,
                  );
                  const service = services.find(
                    (entry) => entry.id === booking.serviceId,
                  );
                  const isOpen = expandedBookingId === booking.id;

                  return (
                    <div key={booking.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedBookingId(isOpen ? null : booking.id)
                        }
                        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                        aria-expanded={isOpen}
                      >
                        <span className="shrink-0">
                          {booking.status === "confirmed" ||
                          booking.status === "completed" ? (
                            <CheckCircle className="size-4 text-emerald-500" />
                          ) : booking.status === "cancelled" ? (
                            <XCircle className="size-4 text-rose-500" />
                          ) : (
                            <CalendarClock className="size-4 text-orange-500" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900">
                            {service?.name ?? "Clinic booking"}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {doctor?.fullName ?? "Clinic medical service"}
                            {" · "}
                            {formatDateLabel(booking.preferredDate)}
                          </span>
                        </div>
                        <Badge
                          intent={getBookingStatusIntent(booking.status)}
                          className="shrink-0 text-[10px] font-extrabold uppercase tracking-widest"
                        >
                          {booking.status}
                        </Badge>
                        <span className="hidden shrink-0 text-xs font-semibold text-slate-400 sm:block">
                          {booking.paymentStatus === "paid" ? "Paid" : "Pending"}
                        </span>
                        <ChevronDown
                          className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isOpen && (
                        <div className="border-t border-slate-100 bg-slate-50 px-5 py-5">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
                            <div>
                              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                Date &amp; Time
                              </p>
                              <p className="text-sm font-bold text-slate-900">
                                {formatDateLabel(booking.preferredDate)}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {formatTimeLabel(
                                  `${booking.preferredDate} ${booking.preferredTime}`,
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                Doctor
                              </p>
                              <p className="text-sm font-bold text-slate-900">
                                {doctor?.fullName ?? "Clinic medical service"}
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                Payment
                              </p>
                              <p className="text-sm font-bold text-slate-900">
                                {booking.paymentStatus === "paid"
                                  ? "Paid at cashier"
                                  : "Pending cashier payment"}
                              </p>
                            </div>
                            {booking.intakeNotes?.trim() ? (
                              <div>
                                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                  Notes
                                </p>
                                <p className="border-l-2 border-slate-300 pl-2 text-xs italic leading-relaxed text-slate-600">
                                  {booking.intakeNotes}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
