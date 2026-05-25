import {
  Activity,
  ArrowRight,
  CalendarCheck2,
  ExternalLink,
  CalendarPlus,
  ClipboardList,
  CreditCard,
  Eye,
  PlayCircle,
  ReceiptText,
  Search,
  Stethoscope,
  UserRoundPlus,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "../../components/forms/form-field";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { StatusPill } from "../../components/ui/status-pill";
import { INTERNAL_SURFACE } from "../../lib/internal-ui";
import { cn } from "../../lib/utils";
import { useAppointments, useUpdateAppointment } from "../appointments/hooks/use-appointments";
import { usePatientBookings } from "../appointments/hooks/use-patients-booking";
import { useMarkBookingPaid } from "../booking/hooks/use-bookings";
import { useInvoices } from "../billing/api/billing-mutations";
import { usePatients, useUpdatePatient } from "../patients/hooks/use-patients";
import { formatDateTimeLabel, getPhilippineDateKey } from "../../lib/utils";
import type { Appointment, Booking } from "../../types/domain";
import {
  buildFrontDeskWorkflowRows,
  type FrontDeskWorkflowRow,
  type FrontDeskWorkflowState,
  type WorkflowPaymentState,
} from "./workflow-utils";
import { WalkInWizardModal } from "./front-desk-walk-in-wizard-modal";
import { FrontDeskPatientDetailsModal } from "./front-desk-patient-details-modal";
import { BookingListModal } from "./front-desk-booking-list-modal";

const FRONT_DESK_WORKFLOW_PAGE_SIZE = 10;
const FRONT_DESK_OVERDUE_MINUTES = 15;

type FrontDeskQueueFilter =
  | "all"
  | "payment_needed"
  | "needs_vitals"
  | "ready_for_doctor"
  | "in_consultation"
  | "walk_in"
  | "overdue";

function mapBookingRows(rows: ReturnType<typeof usePatientBookings>["data"]): Booking[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    patientId: row.patientId,
    serviceId: row.serviceId,
    doctorId: row.doctorId,
    appointmentId: null,
    preferredDate: row.preferredDate,
    preferredTime: row.preferredTime,
    status: row.status as Booking["status"],
    intakeNotes: row.intakeNotes,
    feeType: row.feeType,
    feeAmount: row.feeAmount,
    receiptCode: row.receiptCode,
    paymentStatus: row.paymentStatus,
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  }));
}

function paymentBadgeIntent(paymentState: WorkflowPaymentState) {
  if (paymentState === "paid") return "success" as const;
  if (paymentState === "payment_needed") return "warning" as const;
  return "neutral" as const;
}

function workflowBadgeIntent(state: FrontDeskWorkflowState) {
  if (state === "ready_for_doctor" || state === "completed") {
    return "success" as const;
  }
  if (state === "payment_needed" || state === "needs_vitals") {
    return "warning" as const;
  }
  return "neutral" as const;
}

function labelFromValue(value: string) {
  return value.replaceAll("_", " ");
}

function buildAppointmentPayload(appointment: Appointment, status: Appointment["status"]) {
  return {
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    specialtyId: appointment.specialtyId,
    serviceId: appointment.serviceId,
    scheduledAt: appointment.scheduledAt,
    status,
    source: appointment.source,
    visitType: appointment.visitType,
    reason: appointment.reason,
    notes: appointment.notes,
    teleconsultationPlatform: appointment.teleconsultationPlatform ?? undefined,
    teleconsultationUrl: appointment.teleconsultationUrl ?? undefined,
    teleconsultationAccessInstructions:
      appointment.teleconsultationAccessInstructions ?? undefined,
  };
}

function getMinutesSinceScheduled(scheduledAt: string) {
  const scheduledTimestamp = new Date(scheduledAt).getTime();
  const nowTimestamp = Date.now();

  if (Number.isNaN(scheduledTimestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((nowTimestamp - scheduledTimestamp) / 60000));
}

function isFrontDeskRowOverdue(row: FrontDeskWorkflowRow) {
  return (
    row.workflowState !== "in_consultation" &&
    row.workflowState !== "completed" &&
    getMinutesSinceScheduled(row.scheduledAt) >= FRONT_DESK_OVERDUE_MINUTES
  );
}

function EmptyQueue() {
  return (
    <div className="border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <ClipboardList className="mx-auto size-10 text-slate-300" />
      <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-slate-900">
        No active queue items
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Today&apos;s appointments will appear here once patients are scheduled.
      </p>
    </div>
  );
}

type VitalsFormValues = {
  temperature: string;
  bloodPressure: string;
  heartRate: string;
  o2Sat: string;
  respiratoryRate: string;
  weight: string;
  height: string;
};

const EMPTY_VITALS: VitalsFormValues = {
  temperature: "",
  bloodPressure: "",
  heartRate: "",
  o2Sat: "",
  respiratoryRate: "",
  weight: "",
  height: "",
};

function VitalsModal({
  open,
  patientName,
  initialValues,
  isSaving,
  onClose,
  onSave,
}: {
  open: boolean;
  patientName: string;
  initialValues: VitalsFormValues;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: VitalsFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<VitalsFormValues>(initialValues);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(initialValues);
    setError("");
  }, [initialValues, open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async () => {
    const hasAnyVitals = Object.values(values).some((entry) => entry.trim().length > 0);
    if (!hasAnyVitals) {
      setError("Record at least one vital sign before saving.");
      return;
    }

    setError("");
    await onSave(values);
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Front Desk Action
            </p>
            <h2 className="mt-1 text-base font-extrabold text-slate-950">Record Vitals</h2>
            <p className="mt-1 text-sm text-slate-500">{patientName}</p>
          </div>
          <button
            aria-label="Close vitals modal"
            className="inline-flex items-center justify-center border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
          <FormField label="Temperature (°C)">
            <Input
              onChange={(event) =>
                setValues((prev) => ({ ...prev, temperature: event.target.value }))
              }
              placeholder="e.g., 37.2"
              value={values.temperature}
            />
          </FormField>
          <FormField label="Blood Pressure (mmHg)">
            <Input
              onChange={(event) =>
                setValues((prev) => ({ ...prev, bloodPressure: event.target.value }))
              }
              placeholder="e.g., 120/80"
              value={values.bloodPressure}
            />
          </FormField>
          <FormField label="Heart Rate (bpm)">
            <Input
              onChange={(event) =>
                setValues((prev) => ({ ...prev, heartRate: event.target.value }))
              }
              placeholder="e.g., 78"
              value={values.heartRate}
            />
          </FormField>
          <FormField label="O2 Saturation (%)">
            <Input
              onChange={(event) => setValues((prev) => ({ ...prev, o2Sat: event.target.value }))}
              placeholder="e.g., 98"
              value={values.o2Sat}
            />
          </FormField>
          <FormField label="Respiratory Rate (breaths/min)">
            <Input
              onChange={(event) =>
                setValues((prev) => ({ ...prev, respiratoryRate: event.target.value }))
              }
              placeholder="e.g., 16"
              value={values.respiratoryRate}
            />
          </FormField>
          <FormField label="Weight (kg)">
            <Input
              onChange={(event) => setValues((prev) => ({ ...prev, weight: event.target.value }))}
              placeholder="e.g., 65"
              value={values.weight}
            />
          </FormField>
          <FormField label="Height (cm)">
            <Input
              onChange={(event) => setValues((prev) => ({ ...prev, height: event.target.value }))}
              placeholder="e.g., 172"
              value={values.height}
            />
          </FormField>
        </div>

        {error ? (
          <p className="px-5 pb-2 text-sm font-semibold text-rose-700">{error}</p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="tertiary">
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={() => void handleSubmit()} type="button" variant="primary">
            <Stethoscope className="size-4" />
            Save Vitals
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FrontDeskWorkflowPage() {
  const [walkInWizardOpen, setWalkInWizardOpen] = useState(false);
  const [bookingDrawerOpen, setBookingDrawerOpen] = useState(false);
  const [selectedPatientRowId, setSelectedPatientRowId] = useState<string | null>(null);
  const [vitalsRowId, setVitalsRowId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<FrontDeskQueueFilter>("all");
  const { data: appointments = [] } = useAppointments();
  const { data: patients = [] } = usePatients();
  const { data: invoices = [] } = useInvoices();
  const bookingsQuery = usePatientBookings();
  const updateAppointment = useUpdateAppointment();
  const updatePatient = useUpdatePatient();
  const markBookingPaid = useMarkBookingPaid();
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearch = useDeferredValue(search);
  const todayDateKey = getPhilippineDateKey();
  const bookingRecords = useMemo(
    () => mapBookingRows(bookingsQuery.data),
    [bookingsQuery.data],
  );
  const appointmentMap = useMemo(
    () =>
      new Map(appointments.map((appointment) => [appointment.id, appointment])),
    [appointments],
  );
  const rows = useMemo(
    () =>
      buildFrontDeskWorkflowRows({
        appointments,
        bookings: bookingRecords,
        invoices,
        patients,
        todayDateKey,
      }),
    [appointments, bookingRecords, invoices, patients, todayDateKey],
  );
  const queueNumberMap = useMemo(
    () => new Map(rows.map((row, index) => [row.id, index + 1])),
    [rows],
  );
  const [patientQuery, setPatientQuery] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return [];
    return patients
      .filter((p) =>
        `${p.firstName} ${p.lastName} ${p.mobileNumber} ${p.email}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 8);
  }, [patientQuery, patients]);
  const searchedRows = useMemo(
    () =>
      rows.filter((row) =>
        `${row.patientName} ${row.reason} ${row.appointmentStatus} ${row.workflowState} ${row.receiptCode ?? ""}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, rows],
  );
  const filteredRows = useMemo(() => {
    return searchedRows.filter((row) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "walk_in") return row.isWalkInPatient;
      if (activeFilter === "overdue") return isFrontDeskRowOverdue(row);
      return row.workflowState === activeFilter;
    });
  }, [activeFilter, searchedRows]);
  const summary = useMemo(
    () => ({
      paymentNeeded: rows.filter((row) => row.workflowState === "payment_needed")
        .length,
      needsVitals: rows.filter((row) => row.workflowState === "needs_vitals")
        .length,
      ready: rows.filter((row) => row.workflowState === "ready_for_doctor")
        .length,
      inConsultation: rows.filter(
        (row) => row.workflowState === "in_consultation",
      ).length,
    }),
    [rows],
  );
  const filterCounts = useMemo(
    () => ({
      all: rows.length,
      payment_needed: rows.filter((row) => row.workflowState === "payment_needed").length,
      needs_vitals: rows.filter((row) => row.workflowState === "needs_vitals").length,
      ready_for_doctor: rows.filter((row) => row.workflowState === "ready_for_doctor").length,
      in_consultation: rows.filter((row) => row.workflowState === "in_consultation").length,
      walk_in: rows.filter((row) => row.isWalkInPatient).length,
      overdue: rows.filter((row) => isFrontDeskRowOverdue(row)).length,
    }),
    [rows],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / FRONT_DESK_WORKFLOW_PAGE_SIZE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * FRONT_DESK_WORKFLOW_PAGE_SIZE;
  const paginatedRows = useMemo(
    () => filteredRows.slice(pageStart, pageStart + FRONT_DESK_WORKFLOW_PAGE_SIZE),
    [filteredRows, pageStart],
  );
  const showingStart = filteredRows.length === 0 ? 0 : pageStart + 1;
  const showingEnd =
    filteredRows.length === 0
      ? 0
      : Math.min(pageStart + FRONT_DESK_WORKFLOW_PAGE_SIZE, filteredRows.length);
  const selectedPatientRow = useMemo(
    () => rows.find((entry) => entry.id === selectedPatientRowId) ?? null,
    [rows, selectedPatientRowId],
  );
  const vitalsRow = useMemo(
    () => rows.find((entry) => entry.id === vitalsRowId) ?? null,
    [rows, vitalsRowId],
  );
  const vitalsPatient = useMemo(
    () => patients.find((entry) => entry.id === vitalsRow?.patientId) ?? null,
    [patients, vitalsRow?.patientId],
  );
  const vitalsInitialValues: VitalsFormValues = useMemo(
    () => ({
      temperature: vitalsPatient?.temperature ?? "",
      bloodPressure: vitalsPatient?.bloodPressure ?? "",
      heartRate: vitalsPatient?.heartRate ?? "",
      o2Sat: vitalsPatient?.o2Sat ?? "",
      respiratoryRate: vitalsPatient?.respiratoryRate ?? "",
      weight: vitalsPatient?.weight ?? "",
      height: vitalsPatient?.height ?? "",
    }),
    [vitalsPatient],
  );

  const handleMarkBookingPaid = async (row: FrontDeskWorkflowRow) => {
    if (!row.receiptCode) {
      toast.error("This queue item has no booking receipt code.");
      return;
    }

    await markBookingPaid.mutateAsync(row.receiptCode);
    toast.success("Payment recorded and billing record created.");
  };

  const handleSendToDoctor = async (row: FrontDeskWorkflowRow) => {
    const appointment = appointmentMap.get(row.appointmentId);
    if (!appointment) {
      toast.error("Appointment record was not found.");
      return;
    }

    await updateAppointment.mutateAsync({
      appointmentId: appointment.id,
      payload: buildAppointmentPayload(appointment, "in_progress"),
    });
    toast.success(`${row.patientName} is now marked in consultation.`);
  };

  const openPatientDetails = (row: FrontDeskWorkflowRow) => {
    setSelectedPatientRowId(row.id);
  };

  const closePatientDetails = () => {
    setSelectedPatientRowId(null);
  };

  const openVitalsModal = (row: FrontDeskWorkflowRow) => {
    const patient = patients.find((entry) => entry.id === row.patientId);
    if (!patient) {
      toast.error("Patient record was not found.");
      return;
    }

    setVitalsRowId(row.id);
  };

  const closeVitalsModal = () => {
    setVitalsRowId(null);
  };

  const handleSaveVitals = async (values: VitalsFormValues) => {
    if (!vitalsPatient) {
      toast.error("Patient record was not found.");
      return;
    }

    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...basePayload } =
      vitalsPatient;
    const hasAnyVitals = Object.values(values).some((entry) => entry.trim().length > 0);

    await updatePatient.mutateAsync({
      patientId: vitalsPatient.id,
      payload: {
        ...basePayload,
        temperature: values.temperature.trim() || undefined,
        bloodPressure: values.bloodPressure.trim() || undefined,
        heartRate: values.heartRate.trim() || undefined,
        o2Sat: values.o2Sat.trim() || undefined,
        respiratoryRate: values.respiratoryRate.trim() || undefined,
        weight: values.weight.trim() || undefined,
        height: values.height.trim() || undefined,
        vitalsRecordedAt: hasAnyVitals
          ? new Date().toISOString()
          : vitalsPatient.vitalsRecordedAt ?? null,
      },
    });

    toast.success("Vitals saved successfully.");
    closeVitalsModal();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setWalkInWizardOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        patientSearchRef.current &&
        !patientSearchRef.current.contains(event.target as Node)
      ) {
        setPatientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-5">
      <section className={cn(INTERNAL_SURFACE, 'divide-y divide-slate-100/90')}>
        <div className="flex flex-col gap-5 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Role Workflow</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Front Desk Workflow</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Intake, payment clearance, vitals check, and doctor handoff in one queue.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative" ref={patientSearchRef}>
              <div className="flex w-64 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-[inset_0_1px_1px_rgba(15,41,71,0.04)]">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onFocus={() => {
                    if (patientQuery.trim()) setPatientDropdownOpen(true);
                  }}
                  onChange={(event) => {
                    setPatientQuery(event.target.value);
                    setPatientDropdownOpen(event.target.value.trim().length > 0);
                  }}
                  placeholder="Lookup any patient…"
                  value={patientQuery}
                />
                {patientQuery ? (
                  <button
                    aria-label="Clear patient search"
                    className="shrink-0 text-slate-400 hover:text-slate-700"
                    onClick={() => {
                      setPatientQuery("");
                      setPatientDropdownOpen(false);
                    }}
                    type="button"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
              {patientDropdownOpen && filteredPatients.length > 0 ? (
                <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {filteredPatients.map((patient) => (
                    <Link
                      className="flex flex-col px-4 py-3 transition hover:bg-slate-50"
                      key={patient.id}
                      onClick={() => {
                        setPatientQuery("");
                        setPatientDropdownOpen(false);
                      }}
                      to={`/app/patients/${patient.id}`}
                    >
                      <span className="text-sm font-bold text-slate-950">
                        {patient.firstName} {patient.lastName}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {patient.mobileNumber || patient.email}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : patientDropdownOpen && patientQuery.trim() ? (
                <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
                  <p className="text-xs text-slate-500">No patients found.</p>
                </div>
              ) : null}
            </div>
            <Button
              onClick={() => setBookingDrawerOpen(true)}
              type="button"
              variant="tertiary"
            >
              <CalendarCheck2 className="size-4" />
              Online Bookings
            </Button>
            <Button
              onClick={() => setWalkInWizardOpen(true)}
              type="button"
              variant="primary"
            >
              <UserRoundPlus className="size-4" />
              Start Walk-in Flow
            </Button>
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              to="/app/appointments"
            >
              <CalendarPlus className="size-4" />
              Schedule
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              to="/app/bookings/scan"
            >
              <ReceiptText className="size-4" />
              Scan receipt
            </Link>
          </div>
        </div>

        <div className="grid bg-slate-50/90 md:grid-cols-4">
          <div className="border-b border-slate-100/90 px-6 py-4 md:border-b-0 md:border-r md:border-slate-100/90">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Payment</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.paymentNeeded}</p>
          </div>
          <div className="border-b border-slate-100/90 px-6 py-4 md:border-b-0 md:border-r md:border-slate-100/90">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Vitals</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.needsVitals}</p>
          </div>
          <div className="border-b border-slate-100/90 px-6 py-4 md:border-b-0 md:border-r md:border-slate-100/90">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Ready</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.ready}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">In consultation</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.inConsultation}</p>
          </div>
        </div>
      </section>

      <section className={INTERNAL_SURFACE}>
        <div className="border-b border-slate-100/90 bg-slate-50/90 px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Quick actions</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  to="/app/patients?action=walk-in-intake"
                >
                  Add Patient
                  <ArrowRight className="size-3.5" />
                </Link>
                <Link
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  to="/app/appointments?action=create&source=internal"
                >
                  Appoint Patient
                  <ArrowRight className="size-3.5" />
                </Link>
                <Link
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  to="/app/billing?action=create"
                >
                  Billing
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">View pages</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  to="/app/patients"
                >
                  Patients
                  <ArrowRight className="size-3.5" />
                </Link>
                <Link
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  to="/app/appointments"
                >
                  Appointments
                  <ArrowRight className="size-3.5" />
                </Link>
                <Link
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  to="/app/billing"
                >
                  Billing
                  <ArrowRight className="size-3.5" />
                </Link>
                <Link
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  to="/app/doctor-workflow"
                >
                  Doctor Workflow
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/90 px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Today&apos;s Queue</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {filteredRows.length} active item{filteredRows.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-[inset_0_1px_1px_rgba(15,41,71,0.04)]">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              ref={searchInputRef}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search patient, receipt, status"
              value={search}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/90 bg-slate-50/90 px-6 py-3">
          <div className="flex flex-wrap gap-2">
            {([
              ["all", "All"],
              ["payment_needed", "Payment Needed"],
              ["needs_vitals", "Needs Vitals"],
              ["ready_for_doctor", "Ready"],
              ["in_consultation", "In Consultation"],
              ["walk_in", "Walk-in"],
              ["overdue", "Overdue"],
            ] as const).map(([value, label]) => (
              <button
                className={cn(
                  "inline-flex items-center rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition",
                  activeFilter === value
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "border border-slate-200/90 bg-white text-slate-600 hover:bg-slate-50"
                )}
                key={value}
                onClick={() => {
                  setActiveFilter(value);
                  setCurrentPage(1);
                }}
                type="button"
              >
                {label} ({filterCounts[value]})
              </button>
            ))}
          </div>

          {search || activeFilter !== "all" ? (
            <button
              className="rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600 transition hover:bg-slate-50"
              onClick={() => {
                setSearch("");
                setActiveFilter("all");
                setCurrentPage(1);
              }}
              type="button"
            >
              Reset filters
            </button>
          ) : null}
        </div>

        {filteredRows.length === 0 ? (
          <EmptyQueue />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      #
                    </th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      Patient
                    </th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      Schedule
                    </th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      Payment
                    </th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      Workflow
                    </th>
                    <th className="sticky right-0 top-0 z-10 bg-slate-50 px-4 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.map((row) => {
                    const overdue = isFrontDeskRowOverdue(row);
                    const waitingMinutes = getMinutesSinceScheduled(row.scheduledAt);

                    return (
                    <tr
                      className={`align-top transition-colors ${
                        overdue ? "bg-rose-50/40 hover:bg-rose-50" : "hover:bg-slate-50"
                      }`}
                      key={row.id}
                    >
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-600">
                          {queueNumberMap.get(row.id)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.isWalkInPatient ? (
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Walk-in
                          </p>
                        ) : null}
                        <button
                          className="font-bold text-slate-950 hover:text-[var(--color-primary)] hover:underline"
                          onClick={() => openPatientDetails(row)}
                          type="button"
                        >
                          {row.patientName}
                        </button>
                        <p className="mt-1 text-xs text-slate-500">{row.reason}</p>
                        <Link
                          className="mt-1 inline-flex text-[11px] font-semibold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                          to={`/app/patients/${row.patientId}`}
                        >
                          Open full chart
                        </Link>
                        {row.receiptCode ? (
                          <p className="mt-1 font-mono text-[11px] font-semibold text-slate-400">
                            {row.receiptCode}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <p>{formatDateTimeLabel(row.scheduledAt)}</p>
                        <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">
                          {labelFromValue(row.appointmentStatus)}
                        </p>
                        <p
                          className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${
                            overdue ? "text-rose-700" : "text-slate-500"
                          }`}
                        >
                          {overdue
                            ? `Overdue ${waitingMinutes}m`
                            : `Waiting ${waitingMinutes}m`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={row.paymentState} size="sm" />
                        {row.invoiceNumber ? (
                          <p className="mt-1 text-xs text-slate-500">{row.invoiceNumber}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={row.workflowState} size="sm" />
                        {row.missingVitals ? (
                          <p className="mt-1 text-xs text-slate-500">Vitals needed</p>
                        ) : null}
                      </td>
                      <td
                        className={`sticky right-0 px-4 py-3 ${
                          overdue ? "bg-rose-50/95" : "bg-white"
                        }`}
                      >
                        <div className="flex min-w-max justify-end gap-1.5">
                          {row.paymentState !== "paid" ? (
                            row.receiptCode ? (
                              <Button
                                aria-label={`Mark ${row.patientName} as paid`}
                                className="size-8 p-0"
                                disabled={markBookingPaid.isPending || !row.receiptCode}
                                onClick={() => void handleMarkBookingPaid(row)}
                                type="button"
                                variant="tertiary"
                              >
                                <CreditCard className="size-3.5" />
                              </Button>
                            ) : (
                              <Link
                                aria-label={`Create invoice for ${row.patientName}`}
                                className="inline-flex size-8 items-center justify-center rounded-xl border border-slate-200/90 bg-white p-0 text-slate-700 transition hover:bg-slate-50"
                                to={`/app/billing?action=create&patientId=${row.patientId}&appointmentId=${row.appointmentId}`}
                              >
                                <ReceiptText className="size-3.5" />
                              </Link>
                            )
                          ) : null}
                          {row.workflowState === "needs_vitals" || row.missingVitals ? (
                            <Button
                              aria-label={`Record vitals for ${row.patientName}`}
                              className="size-8 p-0"
                              disabled={updatePatient.isPending}
                              onClick={() => openVitalsModal(row)}
                              type="button"
                              variant="tertiary"
                            >
                              <Stethoscope className="size-3.5" />
                            </Button>
                          ) : null}
                          <Link
                            aria-label={`Open ${row.patientName} patient page`}
                            className="inline-flex size-8 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 transition hover:bg-slate-50"
                            to={`/app/patients/${row.patientId}`}
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>
                          <Button
                            aria-label={`Open ${row.patientName} details modal`}
                            className="size-8 p-0"
                            onClick={() => openPatientDetails(row)}
                            type="button"
                            variant="tertiary"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            aria-label={`Send ${row.patientName} to doctor`}
                            className="px-3 py-1.5 text-xs"
                            disabled={
                              updateAppointment.isPending ||
                              row.workflowState !== "ready_for_doctor"
                            }
                            onClick={() => void handleSendToDoctor(row)}
                            type="button"
                            variant="primary"
                          >
                            <PlayCircle className="size-3.5" />
                            Send
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
              <p className="text-xs font-semibold text-slate-500">
                Showing {showingStart}-{showingEnd} of {filteredRows.length} items
              </p>
              <div className="flex items-center gap-2">
                <Button
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  type="button"
                  variant="tertiary"
                  size="sm"
                >
                  Previous
                </Button>
                <span className="text-xs font-semibold text-slate-500">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <Button
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  type="button"
                  variant="tertiary"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <BookingListModal
        open={bookingDrawerOpen}
        onClose={() => setBookingDrawerOpen(false)}
      />

      <WalkInWizardModal
        open={walkInWizardOpen}
        onClose={() => setWalkInWizardOpen(false)}
      />

      <FrontDeskPatientDetailsModal
        onClose={closePatientDetails}
        open={Boolean(selectedPatientRow)}
        row={selectedPatientRow}
      />

      <VitalsModal
        initialValues={vitalsInitialValues ?? EMPTY_VITALS}
        isSaving={updatePatient.isPending}
        onClose={closeVitalsModal}
        onSave={handleSaveVitals}
        open={Boolean(vitalsRow && vitalsPatient)}
        patientName={vitalsRow?.patientName ?? ""}
      />

    </div>
  );
}
