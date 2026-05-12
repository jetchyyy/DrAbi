import {
  Activity,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  PlayCircle,
  ReceiptText,
  Search,
  UserRoundPlus,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useAppointments, useUpdateAppointment } from "../appointments/hooks/use-appointments";
import { usePatientBookings } from "../appointments/hooks/use-patients-booking";
import { useMarkBookingPaid } from "../booking/hooks/use-bookings";
import { useInvoices } from "../billing/api/billing-mutations";
import { usePatients } from "../patients/hooks/use-patients";
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

export function FrontDeskWorkflowPage() {
  const [walkInWizardOpen, setWalkInWizardOpen] = useState(false);
  const [selectedPatientRowId, setSelectedPatientRowId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<FrontDeskQueueFilter>("all");
  const { data: appointments = [] } = useAppointments();
  const { data: patients = [] } = usePatients();
  const { data: invoices = [] } = useInvoices();
  const bookingsQuery = usePatientBookings();
  const updateAppointment = useUpdateAppointment();
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

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-orange-600 p-2.5 text-white">
              <Activity className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
                Role Workflow
              </p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
                Front Desk Workflow
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Intake, payment clearance, vitals check, and doctor handoff in one queue.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="inline-flex items-center border border-orange-500 bg-orange-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              onClick={() => setWalkInWizardOpen(true)}
              type="button"
              variant="secondary"
            >
              <UserRoundPlus className="mr-2 size-4" />
              Start Walk in Flow
            </Button>
            <Link
              className="inline-flex items-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              to="/app/appointments"
            >
              <CalendarPlus className="mr-2 size-4" />
              Schedule
            </Link>
            <Link
              className="inline-flex items-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              to="/app/bookings/scan"
            >
              <ReceiptText className="mr-2 size-4" />
              Scan receipt
            </Link>
          </div>
        </div>

        <div className="grid border-t border-slate-100 bg-slate-50 md:grid-cols-4">
          <div className="border-b border-slate-100 px-6 py-4 md:border-b-0 md:border-r">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Payment
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">
              {summary.paymentNeeded}
            </p>
          </div>
          <div className="border-b border-slate-100 px-6 py-4 md:border-b-0 md:border-r">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Vitals
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">
              {summary.needsVitals}
            </p>
          </div>
          <div className="border-b border-slate-100 px-6 py-4 md:border-b-0 md:border-r">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Ready
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">
              {summary.ready}
            </p>
          </div>
          <div className="px-6 py-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              In consultation
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">
              {summary.inConsultation}
            </p>
          </div>
        </div>
      </section>

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
                Quick actions
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  className="inline-flex items-center border border-orange-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-orange-700 transition hover:bg-orange-100"
                  to="/app/patients?action=walk-in-intake"
                >
                  Add Patient
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
                <Link
                  className="inline-flex items-center border border-orange-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-orange-700 transition hover:bg-orange-100"
                  to="/app/appointments?action=create&source=internal"
                >
                  Appoint Patient
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
                <Link
                  className="inline-flex items-center border border-orange-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-orange-700 transition hover:bg-orange-100"
                  to="/app/billing?action=create"
                >
                  Billing
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                View pages
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  className="inline-flex items-center border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
                  to="/app/patients"
                >
                  Patients
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
                <Link
                  className="inline-flex items-center border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
                  to="/app/appointments"
                >
                  Appointments
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
                <Link
                  className="inline-flex items-center border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
                  to="/app/billing"
                >
                  Billing
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
                <Link
                  className="inline-flex items-center border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
                  to="/app/doctor-workflow"
                >
                  Doctor Workflow
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
              Today&apos;s Queue
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {filteredRows.length} active item{filteredRows.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-3">
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
                className={`inline-flex items-center border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide transition ${
                  activeFilter === value
                    ? "border-orange-600 bg-orange-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
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
              className="border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition hover:bg-slate-100"
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
                      <td className="px-4 py-3">
                        {row.isWalkInPatient ? (
                          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-600">
                            Walk-in
                          </p>
                        ) : null}
                        <button
                          className="font-bold text-slate-950 hover:text-orange-600 hover:underline"
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
                        <Badge
                          className="rounded-none text-[10px] font-bold uppercase tracking-widest"
                          intent={paymentBadgeIntent(row.paymentState)}
                        >
                          {labelFromValue(row.paymentState)}
                        </Badge>
                        {row.invoiceNumber ? (
                          <p className="mt-1 text-xs text-slate-500">{row.invoiceNumber}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className="rounded-none text-[10px] font-bold uppercase tracking-widest"
                          intent={workflowBadgeIntent(row.workflowState)}
                        >
                          {labelFromValue(row.workflowState)}
                        </Badge>
                        {row.missingVitals ? (
                          <p className="mt-1 text-xs text-amber-700">Vitals needed</p>
                        ) : null}
                      </td>
                      <td
                        className={`sticky right-0 px-4 py-3 ${
                          overdue ? "bg-rose-50/95" : "bg-white"
                        }`}
                      >
                        <div className="flex min-w-max justify-end gap-2">
                          {row.paymentState !== "paid" ? (
                            row.receiptCode ? (
                              <Button
                                className="rounded-none px-3 py-2 text-xs"
                                disabled={markBookingPaid.isPending || !row.receiptCode}
                                onClick={() => void handleMarkBookingPaid(row)}
                                type="button"
                                variant="secondary"
                              >
                                <CreditCard className="mr-1 size-3.5" />
                                Mark paid
                              </Button>
                            ) : (
                              <Link
                                className="inline-flex items-center border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-emerald-800 transition hover:bg-emerald-100"
                                to={`/app/billing?action=create&patientId=${row.patientId}&appointmentId=${row.appointmentId}`}
                              >
                                <ReceiptText className="mr-1 size-3.5" />
                                Create invoice
                              </Link>
                            )
                          ) : null}
                          <Button
                            className="rounded-none border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
                            onClick={() => openPatientDetails(row)}
                            type="button"
                            variant="secondary"
                          >
                            <CheckCircle2 className="mr-1 size-3.5" />
                            Details
                          </Button>
                          <Button
                            className="rounded-none bg-orange-600 px-3 py-2 text-xs hover:bg-orange-700"
                            disabled={
                              updateAppointment.isPending ||
                              row.workflowState !== "ready_for_doctor"
                            }
                            onClick={() => void handleSendToDoctor(row)}
                            type="button"
                          >
                            <PlayCircle className="mr-1 size-3.5" />
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
                  className="rounded-none px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  type="button"
                  variant="secondary"
                >
                  Previous
                </Button>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <Button
                  className="rounded-none px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  type="button"
                  variant="secondary"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <WalkInWizardModal
        open={walkInWizardOpen}
        onClose={() => setWalkInWizardOpen(false)}
      />

      <FrontDeskPatientDetailsModal
        onClose={closePatientDetails}
        open={Boolean(selectedPatientRow)}
        row={selectedPatientRow}
      />

    </div>
  );
}
