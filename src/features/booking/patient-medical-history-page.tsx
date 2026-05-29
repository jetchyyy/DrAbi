import {
  Activity,
  AlertCircle,
  Award,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  FileText,
  LoaderCircle,
  Pill,
  Printer,
  Stethoscope,
  TestTube2,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  Appointment,
  Consultation,
  LabRequestDocument,
  MedicalCertificate,
  Prescription,
} from "../../types/domain";
import type { DoctorDirectoryItem } from "../../lib/supabase-clinic";

import { Card, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  useDoctorDirectory,
  useClinicSettingsData,
  useProviderDirectory,
  useServicesCatalog,
} from "../../hooks/use-clinic-data";
import {
  formatDateLabel,
  formatDateTimeLabel,
} from "../../lib/utils";
import { printHtmlDocument } from "../../lib/print";
import { useAuth } from "../auth/auth-context";
import { LabResultsDisplay } from "../consultation/components/lab-results-display";
import { AppointmentLabRequestsCard } from "../lab-requests/components/appointment-lab-requests-card";
import { buildPrescriptionPrintDocument } from "../patients/prescription-print-document";
import { buildMedicalCertificatePrintDocument } from "../patients/medical-certificate-print-document";
import { buildLabRequestPrintDocument } from "../lab-requests/lab-request-print-document";
import { useCurrentPatient } from "./hooks/use-bookings";
import {
  usePatientAppointments,
  usePatientBookings,
  usePatientConsultations,
  usePatientPrescriptions,
  usePatientMedicalCertificates,
  usePatientLabRequestDocuments,
} from "../patients/hooks/use-patients";

// ── Helpers copied from patient-detail-page ───────────────────────────────────

function parsePrescriptionDisplayName(value: string) {
  const text = (value ?? "").trim();
  const match = text.match(/^(.*?)(?:\s*\(Brand:\s*(.*?)\))?$/i);
  if (!match) return { genericName: text, brandName: "" };
  return {
    genericName: (match[1] ?? "").trim(),
    brandName: (match[2] ?? "").trim(),
  };
}

function buildDoctorPrcResultQrData(input: {
  doctorName: string;
  doctorSpecialty: string;
  doctorLicenseNumber: string;
  doctorBirNumber: string;
  doctorPtrNumber: string;
}) {
  const prcLicense = (input.doctorLicenseNumber || "").replace(/\s+/g, "").toUpperCase();
  if (!prcLicense) return "";
  return `https://www.prc.gov.ph/licensee?id=${encodeURIComponent(prcLicense)}&type=PRC`;
}

function formatDoctorDisplayName(name: string | null | undefined, postNominals?: string | null) {
  const baseName = (name ?? "").trim().replace(/^dr\.?\s+/i, "").trim();
  if (!baseName) return "Attending Physician";
  const suffix = (postNominals ?? "").trim();
  return suffix ? `${baseName} ${suffix}` : baseName;
}

function resolveDoctorPostNominals(input: {
  linkedDoctorTitle?: string | null;
  linkedProviderName?: string | null;
  currentDoctorTitle?: string | null;
  profileRole?: string | null;
  profileTitle?: string | null;
}) {
  const linkedTitle = (input.linkedDoctorTitle ?? "").trim();
  if (linkedTitle) return linkedTitle;
  if ((input.linkedProviderName ?? "").trim()) return "";
  const currentDoctorTitle = (input.currentDoctorTitle ?? "").trim();
  if (currentDoctorTitle) return currentDoctorTitle;
  const role = (input.profileRole ?? "").trim();
  if (role === "doctor" || role === "specialist") return (input.profileTitle ?? "").trim();
  return "";
}

function findProviderByConsultationDoctorId(
  providers: DoctorDirectoryItem[],
  doctorId: string | null | undefined,
) {
  const normalizedDoctorId = (doctorId ?? "").trim();
  if (!normalizedDoctorId) return null;
  return providers.find(
    (p) => p.id === normalizedDoctorId || p.profileId === normalizedDoctorId,
  ) ?? null;
}

async function buildPatientQrSvgMarkup(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) return "";
  try {
    return await QRCode.toString(normalizedValue, {
      errorCorrectionLevel: "M",
      margin: 1,
      type: "svg",
      width: 120,
    });
  } catch {
    return "";
  }
}


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

type SelectedRecord =
  | { type: "appointment"; id: string }
  | { type: "booking"; id: string }
  | { type: "consultation"; id: string };

type VisitHistoryRecord =
  | {
      type: "appointment";
      id: string;
      dateTime: string;
      appointment: Appointment;
      consultation: Consultation | null;
    }
  | {
      type: "consultation";
      id: string;
      dateTime: string;
      consultation: Consultation;
    };

type TimelineView = "upcoming" | "past";

export function PatientMedicalHistoryPage() {
  const { profile, session } = useAuth();
  const { data: currentPatient, isLoading: isPatientLoading } =
    useCurrentPatient(session?.user.id ?? null, profile?.email);
  const { data: clinicSettings } = useClinicSettingsData();
  const { data: providers = [] } = useProviderDirectory();
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
  const { data: prescriptions = [], isLoading: isPrescriptionsLoading } =
    usePatientPrescriptions(currentPatient?.id ?? null);
  const { data: medicalCertificates = [], isLoading: isMedicalCertsLoading } =
    usePatientMedicalCertificates(currentPatient?.id ?? null);
  const { data: labRequestDocuments = [], isLoading: isLabRequestDocsLoading } =
    usePatientLabRequestDocuments(currentPatient?.id ?? null);

  const [selectedRecord, setSelectedRecord] = useState<SelectedRecord | null>(null);
  const [timelineView, setTimelineView] = useState<TimelineView>("upcoming");
  const [showFullMedicalHistory, setShowFullMedicalHistory] = useState(false);
  const [showFullAllergies, setShowFullAllergies] = useState(false);
  const [docPreviewModal, setDocPreviewModal] = useState<{ open: boolean; title: string; html: string; isPrinting: boolean }>({
    open: false, title: "", html: "", isPrinting: false,
  });

  const patientName = currentPatient
    ? `${currentPatient.firstName} ${currentPatient.lastName}`
    : "Patient";

  const patientAge = currentPatient?.birthDate
    ? String(
        new Date().getFullYear() -
          new Date(currentPatient.birthDate).getFullYear() -
          (new Date() <
          new Date(
            new Date(currentPatient.birthDate).setFullYear(new Date().getFullYear()),
          )
            ? 1
            : 0),
      )
    : "";
  const patientSex =
    currentPatient?.sex === "male"
      ? "Male"
      : currentPatient?.sex === "female"
        ? "Female"
        : "Other";

  // Resolve doctor info from a linked consultation
  const buildDocDoctorInfo = (consultationId: string | null | undefined) => {
    const linkedConsultation = consultations.find((c) => c.id === consultationId) ?? null;
    const linkedDoctor = linkedConsultation
      ? findProviderByConsultationDoctorId(providers, linkedConsultation.doctorId)
      : null;
    const doctorNameRaw =
      linkedDoctor?.fullName ??
      linkedConsultation?.providerName ??
      "Attending Physician";
    const doctorPostNominals = resolveDoctorPostNominals({
      linkedDoctorTitle: linkedDoctor?.title ?? null,
      linkedProviderName: linkedConsultation?.providerName ?? null,
    });
    const doctorName = formatDoctorDisplayName(doctorNameRaw, doctorPostNominals);
    const doctorSpecialty = linkedDoctor?.specialtyName ?? "Physician";
    const doctorLicenseNumber = linkedDoctor?.licenseNumber ?? "";
    const doctorBirNumber = linkedDoctor?.birNumber ?? "";
    const doctorPtrNumber = linkedDoctor?.ptrNumber ?? "";
    return {
      linkedConsultation,
      doctorName,
      doctorSpecialty,
      doctorLicenseNumber,
      doctorBirNumber,
      doctorPtrNumber,
      doctorPrcQrData: buildDoctorPrcResultQrData({ doctorName, doctorSpecialty, doctorLicenseNumber, doctorBirNumber, doctorPtrNumber }),
    };
  };

  const clinicInfo = {
    clinicName: clinicSettings?.clinicName ?? "Clinic",
    clinicAddress: clinicSettings?.address ?? "",
    clinicContactNumber: clinicSettings?.contactNumber ?? "",
    clinicEmail: clinicSettings?.email ?? "",
  };

  const openDocModal = (title: string, html: string) => {
    setDocPreviewModal({ open: true, title, html, isPrinting: false });
  };

  const buildAndOpenPrescriptionDoc = (rxList: Prescription[]) => {
    if (rxList.length === 0) return;
    const { doctorName, doctorSpecialty, doctorLicenseNumber, doctorBirNumber, doctorPtrNumber, doctorPrcQrData, linkedConsultation } =
      buildDocDoctorInfo(rxList[0].consultationId);
    const nextAppointment = linkedConsultation
      ? `${linkedConsultation.consultationDate} ${linkedConsultation.consultationTime}`
      : "";
    const html = buildPrescriptionPrintDocument({
      ...clinicInfo,
      doctorName,
      doctorSpecialty,
      doctorLicenseNumber,
      doctorBirNumber,
      doctorPtrNumber,
      doctorPrcQrData,
      patientName,
      patientAge,
      patientSex,
      patientAddress: currentPatient?.address ?? "",
      issuedDate: rxList[0].createdAt,
      nextAppointment,
      medications: rxList.map((rx) => ({
        name: parsePrescriptionDisplayName(rx.prescriptionName).genericName || rx.prescriptionName,
        brandName: (rx.brandName ?? "").trim() || parsePrescriptionDisplayName(rx.prescriptionName).brandName,
        dosage: rx.dosage,
        instruction: rx.instruction,
        numberOfMedications:
          rx.numberOfMedications == null ? undefined : `${rx.numberOfMedications}`,
      })),
    });
    openDocModal("Prescription", html);
  };

  const buildAndOpenMedCertDoc = async (cert: MedicalCertificate) => {
    const { doctorName, doctorSpecialty, doctorLicenseNumber, doctorBirNumber, doctorPtrNumber, doctorPrcQrData } =
      buildDocDoctorInfo(cert.consultationId);
    const patientQrSvg = await buildPatientQrSvgMarkup(currentPatient?.qrCode ?? "");
    const html = buildMedicalCertificatePrintDocument({
      ...clinicInfo,
      certificateNumber:
        cert.certificateNumber != null ? String(cert.certificateNumber) : "",
      patientQrSvg,
      patientQrCode: currentPatient?.qrCode ?? "",
      patientReferenceCode: currentPatient?.id ?? "",
      doctorName,
      doctorSpecialty,
      doctorLicenseNumber,
      doctorBirNumber,
      doctorPtrNumber,
      doctorPrcQrData,
      patientName,
      patientAge,
      patientSex,
      patientAddress: currentPatient?.address ?? "",
      issuedDate: cert.createdAt,
      certificatePurpose: cert.certificatePurpose,
      diagnosis: cert.diagnosis,
      recommendation: cert.recommendation,
      restFrom: cert.restFrom ?? "",
      restUntil: cert.restUntil ?? "",
      checkFinancial: cert.checkFinancial ?? false,
      checkSchool: cert.checkSchool ?? false,
      checkWork: cert.checkWork ?? false,
    });
    openDocModal("Medical Certificate", html);
  };

  const buildAndOpenLabRequestDoc = (doc: LabRequestDocument) => {
    // Use stored full HTML first (already complete official print document)
    if (doc.documentHtml?.trim()) {
      openDocModal("Lab Request", doc.documentHtml);
      return;
    }
    // Fallback: rebuild from structured data
    const { doctorName, doctorSpecialty, doctorLicenseNumber, doctorBirNumber, doctorPtrNumber } =
      buildDocDoctorInfo(doc.consultationId);
    const requests = doc.requestedTests
      .split("\n")
      .filter(Boolean)
      .map((line) => ({ name: line.trim() }));
    const html = buildLabRequestPrintDocument({
      ...clinicInfo,
      doctorName,
      doctorSpecialty,
      doctorLicenseNumber,
      doctorBirNumber,
      doctorPtrNumber,
      patientName,
      patientAge,
      patientSex,
      patientAddress: currentPatient?.address ?? "",
      issuedDate: doc.createdAt,
      requests,
    });
    openDocModal("Lab Request", html);
  };

  const handlePrintModalDoc = async () => {
    if (!docPreviewModal.html) return;
    setDocPreviewModal((prev) => ({ ...prev, isPrinting: true }));
    try {
      await printHtmlDocument(docPreviewModal.html);
    } finally {
      setDocPreviewModal((prev) => ({ ...prev, isPrinting: false }));
    }
  };

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

  const orphanedConsultations = useMemo(
    () =>
      consultationTimeline.filter(
        (consultation) =>
          !appointmentTimeline.some(
            (appointment) => appointment.id === consultation.appointmentId,
          ),
      ),
    [appointmentTimeline, consultationTimeline],
  );
  const upcomingBookings = useMemo(
    () => bookingTimeline.filter((b) => b.status !== "completed" && b.status !== "cancelled"),
    [bookingTimeline],
  );
  const historyRecords = useMemo<VisitHistoryRecord[]>(() => {
    const appointmentRecords: VisitHistoryRecord[] = appointmentTimeline.map(
      (appointment) => ({
        type: "appointment",
        id: appointment.id,
        dateTime: appointment.scheduledAt,
        appointment,
        consultation:
          consultationTimeline.find(
            (consultation) => consultation.appointmentId === appointment.id,
          ) ?? null,
      }),
    );
    const consultationRecords: VisitHistoryRecord[] = orphanedConsultations.map(
      (consultation) => ({
        type: "consultation",
        id: consultation.id,
        dateTime: `${consultation.consultationDate}T${consultation.consultationTime || "00:00"}`,
        consultation,
      }),
    );

    return [...appointmentRecords, ...consultationRecords].sort((left, right) =>
      right.dateTime.localeCompare(left.dateTime),
    );
  }, [appointmentTimeline, consultationTimeline, orphanedConsultations]);
  const medicalHistoryText = currentPatient?.medicalHistory?.trim() || "None recorded.";
  const allergiesText = currentPatient?.allergies?.trim() || "None recorded.";
  const canExpandMedicalHistory = medicalHistoryText.length > 120;
  const canExpandAllergies = allergiesText.length > 120;

  if (
    isPatientLoading ||
    isAppointmentsLoading ||
    isBookingsLoading ||
    isConsultationsLoading ||
    isPrescriptionsLoading ||
    isMedicalCertsLoading ||
    isLabRequestDocsLoading
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

  return (
    <div className="mx-auto max-w-5xl pb-16">
      {/* Document preview modal */}
      {docPreviewModal.open && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-3"
          onClick={() => setDocPreviewModal((prev) => ({ ...prev, open: false }))}
          role="dialog"
        >
          <div
            className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                {docPreviewModal.title}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  disabled={docPreviewModal.isPrinting}
                  onClick={() => { void handlePrintModalDoc(); }}
                  type="button"
                >
                  <Printer className="size-3.5" />
                  {docPreviewModal.isPrinting ? "Printing..." : "Print"}
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-50"
                  disabled={docPreviewModal.isPrinting}
                  onClick={() => { void handlePrintModalDoc(); }}
                  type="button"
                >
                  Save as PDF
                </button>
                <button
                  aria-label="Close document preview"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-100"
                  onClick={() => setDocPreviewModal((prev) => ({ ...prev, open: false }))}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <iframe
              className="h-full w-full"
              srcDoc={docPreviewModal.html}
              title={docPreviewModal.title || "Document preview"}
            />
          </div>
        </div>
      )}
      {/* Header and profile notes */}
      <div className="relative mb-14 animate-fade-up">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                My Medical History
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Review your previous clinic visits, consultation notes, and booking
                requests in one place.
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
              to="/portal/book"
            >
              <CalendarDays className="size-4" />
              Book Another Visit
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] p-2">
                <FileText className="size-4 text-[var(--color-primary)]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                    className="mt-1 text-[10px] font-semibold text-[var(--color-primary)] hover:underline"
                    onClick={() => setShowFullMedicalHistory((value) => !value)}
                  >
                    {showFullMedicalHistory ? "Show less" : "Show more"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-xl bg-slate-100 p-2">
                <Activity className="size-4 text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                    className="mt-1 text-[10px] font-semibold text-[var(--color-primary)] hover:underline"
                    onClick={() => setShowFullAllergies((value) => !value)}
                  >
                    {showFullAllergies ? "Show less" : "Show more"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-xl bg-slate-100 p-2">
                <CheckCircle className="size-4 text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
        </div>

        <div className="absolute -bottom-5 right-4 z-10 sm:right-6">
          <div
            aria-label="History view"
            className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--color-primary)_18%,white)] bg-white p-1 shadow-sm"
            role="group"
          >
            {(["upcoming", "past"] as const).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={timelineView === view}
                className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition ${
                  timelineView === view
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "text-slate-500 hover:text-[var(--color-primary)]"
                }`}
                onClick={() => setTimelineView(view)}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div>
        {timelineView === "upcoming" ? (
          upcomingBookings.length > 0 ? (
            <div className="relative space-y-5 before:absolute before:bottom-5 before:left-[6.375rem] before:top-5 before:border-l before:border-dotted before:border-slate-300 sm:before:left-[8.375rem]">
              {upcomingBookings.map((booking) => {
                const doctor = directBookableDoctors.find((d) => d.id === booking.doctorId);
                const service = services.find((s) => s.id === booking.serviceId);
                const d = new Date(`${booking.preferredDate}T${booking.preferredTime}`);
                return (
                  <div
                    key={booking.id}
                    className="grid grid-cols-[4.75rem_1.75rem_minmax(0,1fr)] gap-3 sm:grid-cols-[6rem_2.25rem_minmax(0,1fr)] sm:gap-5"
                  >
                    <div className="pt-4 text-left">
                      <p className="text-base font-bold leading-tight text-slate-900">
                        {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {d.toLocaleDateString("en-US", { weekday: "long" })}
                      </p>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="relative z-10 mt-5 size-3 rounded-full border-2 border-white bg-amber-400 shadow-sm ring-4 ring-amber-100" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRecord({ type: "booking", id: booking.id })}
                      className="group rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-slate-500">
                            {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                            {service?.name ?? "Clinic booking"}
                          </h3>
                        </div>
                        <Badge intent="warning" className="shrink-0 text-[10px]">
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-500">
                        {doctor?.fullName ?? "Clinic"}
                      </p>
                      {booking.paymentStatus !== "paid" && (
                        <p className="mt-2 text-xs font-bold text-amber-600">Pending cashier payment</p>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <CalendarDays className="size-6 text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-700">No upcoming visits</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">Confirmed and pending visits will appear here.</p>
              <Link to="/portal/book" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2 text-xs font-semibold text-white">
                <CalendarDays className="size-3.5" /> Book a visit
              </Link>
            </div>
          )
        ) : historyRecords.length > 0 ? (
          <div className="relative space-y-5 before:absolute before:bottom-5 before:left-[6.375rem] before:top-5 before:border-l before:border-dotted before:border-slate-300 sm:before:left-[8.375rem]">
            {historyRecords.map((record) => {
                const linked = record.consultation;
                const d = new Date(record.dateTime);
                const rxList = linked ? prescriptions.filter((rx) => rx.consultationId === linked.id) : [];
                const certList = linked ? medicalCertificates.filter((c) => c.consultationId === linked.id) : [];
                const labList = linked ? labRequestDocuments.filter((doc) => doc.consultationId === linked.id) : [];
                const hasNotes = !!(linked?.clinicalSummary?.trim() || linked?.assessment?.trim() || linked?.plan?.trim());
                const row = (() => {
                  if (record.type === "appointment") {
                    const doctor = doctors.find((entry) => entry.role === "doctor" && entry.id === record.appointment.doctorId);
                    const service = services.find((entry) => entry.id === record.appointment.serviceId);
                    return {
                      title: service?.name ?? "Clinic visit",
                      providerName: doctor?.fullName ?? "Clinic team",
                      detail: record.appointment.visitType.replace("_", " "),
                      badge: (
                        <Badge intent={getAppointmentStatusIntent(record.appointment.status)} className="shrink-0 text-[10px]">
                          {record.appointment.status.replace("_", " ")}
                        </Badge>
                      ),
                    };
                  }

                  const provider = findProviderByConsultationDoctorId(providers, record.consultation.doctorId);
                  return {
                    title: record.consultation.consultationType || "Consultation note",
                    providerName: provider?.fullName ?? record.consultation.providerName ?? "Clinic team",
                    detail: "consultation note",
                    badge: (
                      <Badge intent="info" className="shrink-0 text-[10px]">
                        consultation
                      </Badge>
                    ),
                  };
                })();

                return (
                  <div
                    key={`${record.type}-${record.id}`}
                    className="grid grid-cols-[4.75rem_1.75rem_minmax(0,1fr)] gap-3 sm:grid-cols-[6rem_2.25rem_minmax(0,1fr)] sm:gap-5"
                  >
                    <div className="pt-4 text-left">
                      <p className="text-base font-bold leading-tight text-slate-900">
                        {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {d.toLocaleDateString("en-US", { weekday: "long" })}
                      </p>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="relative z-10 mt-5 size-3 rounded-full border-2 border-white bg-slate-400 shadow-sm ring-4 ring-slate-100" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRecord({ type: record.type, id: record.id })}
                      className="group rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-500">
                            {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                            {row.title}
                          </h3>
                        </div>
                        {row.badge}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-slate-500">
                        <span>{row.providerName}</span>
                        <span>{row.detail}</span>
                      </div>
                      {(hasNotes || rxList.length > 0 || certList.length > 0 || labList.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {hasNotes && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500"><ClipboardList className="size-2.5" /> Notes</span>}
                          {rxList.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600"><Pill className="size-2.5" /> Rx</span>}
                          {certList.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600"><Award className="size-2.5" /> Cert</span>}
                          {labList.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600"><TestTube2 className="size-2.5" /> Lab</span>}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <Stethoscope className="size-6 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700">No past visits yet</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">Completed clinic visits and consultation records will appear here.</p>
          </div>
        )}
      </div>

      {/* Visit detail modal */}
      {selectedRecord && (() => {
        const appointment = selectedRecord.type === "appointment"
          ? appointmentTimeline.find((a) => a.id === selectedRecord.id) ?? null
          : null;
        const booking = selectedRecord.type === "booking"
          ? bookingTimeline.find((b) => b.id === selectedRecord.id) ?? null
          : null;
        const standaloneConsultation = selectedRecord.type === "consultation"
          ? consultationTimeline.find((c) => c.id === selectedRecord.id) ?? null
          : null;
        if (!appointment && !booking && !standaloneConsultation) return null;

        const linked = appointment
          ? consultationTimeline.find((c) => c.appointmentId === appointment.id) ?? null
          : standaloneConsultation;
        const appointmentDoctor = appointment
          ? doctors.find((d) => d.role === "doctor" && d.id === appointment.doctorId)
          : null;
        const bookingDoctor = booking
          ? directBookableDoctors.find((d) => d.id === booking.doctorId)
          : null;
        const consultationDoctor = linked
          ? findProviderByConsultationDoctorId(providers, linked.doctorId)
          : null;
        const doctorName =
          appointmentDoctor?.fullName ??
          bookingDoctor?.fullName ??
          consultationDoctor?.fullName ??
          linked?.providerName ??
          null;
        const service = appointment
          ? services.find((s) => s.id === appointment.serviceId)
          : booking ? services.find((s) => s.id === booking.serviceId) : null;
        const recordTitle = service?.name ?? linked?.consultationType ?? "Clinic visit";
        const rxList = linked ? prescriptions.filter((rx) => rx.consultationId === linked.id) : [];
        const certList = linked ? medicalCertificates.filter((c) => c.consultationId === linked.id) : [];
        const labDocList = linked ? labRequestDocuments.filter((doc) => doc.consultationId === linked.id) : [];
        const hasNotes = !!(linked?.clinicalSummary?.trim() || linked?.assessment?.trim() || linked?.plan?.trim());
        const hasLabResults = linked?.labResults?.trim();
        const scheduledAt =
          appointment?.scheduledAt ??
          (booking
            ? `${booking.preferredDate}T${booking.preferredTime}`
            : linked
              ? `${linked.consultationDate}T${linked.consultationTime || "00:00"}`
              : "");

        return (
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"
            onClick={() => setSelectedRecord(null)}
          >
            <div
              className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    {booking ? "Booking request" : standaloneConsultation ? "Consultation record" : "Clinic visit"}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{recordTitle}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {scheduledAt ? formatDateTimeLabel(scheduledAt) : ""}
                    {doctorName ? ` · ${doctorName}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {appointment && (
                    <Badge intent={getAppointmentStatusIntent(appointment.status)}>
                      {appointment.status.replace("_", " ")}
                    </Badge>
                  )}
                  {booking && (
                    <Badge intent={getBookingStatusIntent(booking.status)}>{booking.status}</Badge>
                  )}
                  {standaloneConsultation && (
                    <Badge intent="info">consultation</Badge>
                  )}
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 p-1.5 text-slate-400 transition hover:bg-slate-50"
                    onClick={() => setSelectedRecord(null)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {/* Booking info */}
                {booking && (
                  <>
                    <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Payment</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {booking.paymentStatus === "paid" ? "Paid at cashier" : "Pending cashier payment"}
                        </p>
                      </div>
                    </div>
                    {booking.intakeNotes?.trim() && (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Your notes</p>
                        <p className="mt-2 text-sm italic leading-relaxed text-slate-600">{booking.intakeNotes}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Appointment visit details */}
                {appointment && (appointment.visitType || appointment.reason) && (
                  <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Visit type</p>
                      <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{appointment.visitType.replace("_", " ")}</p>
                    </div>
                    {appointment.reason?.trim() && (
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Reason</p>
                        <p className="mt-1 text-sm italic text-slate-600">{appointment.reason}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Consultation notes */}
                {linked && (
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Consultation notes</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{linked.consultationType} · {linked.providerName}</p>
                    {hasNotes ? (
                      <p className="mt-3 text-sm leading-relaxed text-slate-700">
                        {linked.clinicalSummary?.trim() || linked.assessment?.trim() || linked.plan?.trim()}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm italic text-slate-400">No written summary recorded.</p>
                    )}
                  </div>
                )}

                {/* Lab results */}
                {hasLabResults && (
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Lab results</p>
                    <LabResultsDisplay value={linked!.labResults!} />
                  </div>
                )}

                {/* Prescriptions */}
                {rxList.length > 0 && (
                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Pill className="size-3.5 text-violet-600" />
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-700">Prescriptions</p>
                      </div>
                      <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-50" onClick={() => buildAndOpenPrescriptionDoc(rxList)}>
                        <Printer className="size-3" /> Print / PDF
                      </button>
                    </div>
                    <div className="space-y-2">
                      {rxList.map((rx) => (
                        <div key={rx.id}>
                          <p className="text-sm font-bold text-slate-800">{rx.prescriptionName}{rx.brandName ? <span className="ml-1 font-normal text-slate-500">({rx.brandName})</span> : null}</p>
                          <p className="text-xs text-slate-600">{rx.dosage} — {rx.instruction}{rx.numberOfMedications ? ` · Qty: ${rx.numberOfMedications}` : ""}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medical Certificates */}
                {certList.length > 0 && (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Award className="size-3.5 text-emerald-600" />
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Medical Certificates</p>
                    </div>
                    <div className="space-y-3">
                      {certList.map((cert) => (
                        <div key={cert.id} className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{cert.certificatePurpose}</p>
                            {cert.diagnosis && <p className="text-xs text-slate-600">Diagnosis: {cert.diagnosis}</p>}
                            {cert.restUntil && <p className="text-xs font-semibold text-emerald-700">Valid until: {formatDateLabel(cert.restUntil)}</p>}
                          </div>
                          <button type="button" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50" onClick={() => { void buildAndOpenMedCertDoc(cert); }}>
                            <Printer className="size-3" /> Print
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lab Request Docs */}
                {labDocList.length > 0 && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <TestTube2 className="size-3.5 text-red-600" />
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-red-700">Lab Requests</p>
                    </div>
                    <div className="space-y-3">
                      {labDocList.map((doc) => (
                        <div key={doc.id} className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{doc.targetLaboratory || "Lab Request"}</p>
                            <p className="text-xs text-slate-600">{doc.requestedTests}</p>
                          </div>
                          <button type="button" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50" onClick={() => buildAndOpenLabRequestDoc(doc)}>
                            <Printer className="size-3" /> Print
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lab requests card */}
                {appointment && (
                  <AppointmentLabRequestsCard
                    appointmentId={appointment.id}
                    canCreate={false}
                    patientId={currentPatient.id}
                    requestedBy={appointmentDoctor?.id ?? ""}
                    title="Lab requests"
                    compact
                  />
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
