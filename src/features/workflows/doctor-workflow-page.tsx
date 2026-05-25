import {
  AlertTriangle,
  ClipboardCheck,
  Clock3,
  FileText,
  Search,
  Stethoscope,
  UserRoundSearch,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "../../components/ui/badge";
import { StatusPill } from "../../components/ui/status-pill";
import { INTERNAL_SURFACE } from "../../lib/internal-ui";
import { cn } from "../../lib/utils";
import { useDoctorDirectory } from "../../hooks/use-clinic-data";
import { formatDateTimeLabel, getPhilippineDateKey } from "../../lib/utils";
import { useAuth } from "../auth/auth-context";
import { useAppointments } from "../appointments/hooks/use-appointments";
import { useInvoices } from "../billing/api/billing-mutations";
import { usePatients } from "../patients/hooks/use-patients";
import {
  buildDoctorWorkflowRows,
  type DoctorWorkflowRow,
  type DoctorWorkflowState,
  type WorkflowPaymentState,
} from "./workflow-utils";

function labelFromValue(value: string) {
  return value.replaceAll("_", " ");
}

function paymentBadgeIntent(paymentState: WorkflowPaymentState) {
  if (paymentState === "paid") return "success" as const;
  if (paymentState === "payment_needed") return "warning" as const;
  return "neutral" as const;
}

function workflowBadgeIntent(state: DoctorWorkflowState) {
  if (state === "ready" || state === "in_consultation") return "success" as const;
  return "warning" as const;
}

type DoctorQueueFilter = "all" | "ready" | "in_consultation" | "blocked" | "overdue" | "teleconsult";
type DoctorQueueSort = "priority" | "scheduled" | "longest_waiting";
const DOCTOR_WORKFLOW_PAGE_SIZE = 10;

function getMinutesSinceScheduled(scheduledAt: string) {
  const scheduledTimestamp = new Date(scheduledAt).getTime();
  const nowTimestamp = Date.now();

  if (Number.isNaN(scheduledTimestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((nowTimestamp - scheduledTimestamp) / 60000));
}

function isRowOverdue(row: DoctorWorkflowRow) {
  return row.workflowState !== "in_consultation" && getMinutesSinceScheduled(row.scheduledAt) >= 15;
}

function getBlockerAction(row: DoctorWorkflowRow) {
  if (!row.blockingReason) {
    return null;
  }

  if (row.paymentState !== "paid") {
    return {
      label: "Open billing",
      to: `/app/billing?action=create&patientId=${row.patientId}&appointmentId=${row.appointmentId}`,
    };
  }

  if (row.blockingReason.toLowerCase().includes("vitals")) {
    return {
      label: "Record vitals",
      to: `/app/patients/${row.patientId}?recordVitals=1`,
    };
  }

  if (row.appointmentStatus === "scheduled") {
    return {
      label: "Open front desk",
      to: "/app/front-desk-workflow",
    };
  }

  return null;
}

function EmptyDoctorQueue() {
  return (
    <div className="border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <ClipboardCheck className="mx-auto size-10 text-slate-300" />
      <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-slate-900">
        No consultation queue yet
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Cleared and scheduled patients assigned to you will appear here.
      </p>
    </div>
  );
}

function DoctorQueueActions({ row }: { row: DoctorWorkflowRow }) {
  return (
    <div className="flex min-w-max justify-end gap-2">
      <Link
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
        to={`/app/patients/${row.patientId}`}
      >
        <FileText className="size-3.5" />
        Chart
      </Link>
      {row.canStartConsultation ? (
        <Link
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:brightness-95"
          style={{ backgroundColor: 'var(--color-primary)' }}
          to={`/app/consultation/${row.patientId}?appointmentId=${row.appointmentId}`}
        >
          <Stethoscope className="size-3.5" />
          Consult
        </Link>
      ) : (
        <button
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white opacity-50"
          disabled
          style={{ backgroundColor: 'var(--color-primary)' }}
          type="button"
        >
          <Stethoscope className="size-3.5" />
          Consult
        </button>
      )}
    </div>
  );
}

export function DoctorWorkflowPage() {
  const { profile } = useAuth();
  const { data: appointments = [] } = useAppointments();
  const { data: patients = [] } = usePatients();
  const { data: invoices = [] } = useInvoices();
  const { data: doctors = [] } = useDoctorDirectory();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<DoctorQueueFilter>("all");
  const [sortMode, setSortMode] = useState<DoctorQueueSort>("priority");
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const todayDateKey = getPhilippineDateKey();
  const currentDoctor = doctors.find(
    (doctor) => doctor.profileId === profile?.id || doctor.id === profile?.id,
  );
  const currentDoctorId = currentDoctor?.id ?? (profile?.role === "doctor" ? profile.id : null);
  const rows = useMemo(
    () =>
      buildDoctorWorkflowRows({
        appointments,
        doctorId: currentDoctorId,
        invoices,
        patients,
        todayDateKey,
      }),
    [appointments, currentDoctorId, invoices, patients, todayDateKey],
  );
  const queueNumberMap = useMemo(
    () => new Map(rows.map((row, index) => [row.id, index + 1])),
    [rows],
  );
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
  const searchedRows = useMemo(
    () =>
      rows.filter((row) =>
        `${row.patientName} ${row.reason} ${row.appointmentStatus} ${row.workflowState} ${row.blockingReason ?? ""}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, rows],
  );
  const filteredRows = useMemo(() => {
    const byFilter = searchedRows.filter((row) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "ready") return row.workflowState === "ready";
      if (activeFilter === "in_consultation") {
        return row.workflowState === "in_consultation";
      }
      if (activeFilter === "blocked") return row.workflowState === "blocked";
      if (activeFilter === "teleconsult") return row.visitType === "teleconsultation";
      return isRowOverdue(row);
    });

    if (sortMode === "scheduled") {
      return byFilter.toSorted((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
    }

    if (sortMode === "longest_waiting") {
      return byFilter.toSorted(
        (left, right) =>
          getMinutesSinceScheduled(right.scheduledAt) - getMinutesSinceScheduled(left.scheduledAt),
      );
    }

    return byFilter.toSorted((left, right) => {
      const leftPriority = left.workflowState === "in_consultation" ? 0 : left.canStartConsultation ? 1 : 2;
      const rightPriority = right.workflowState === "in_consultation" ? 0 : right.canStartConsultation ? 1 : 2;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      const leftOverdueRank = isRowOverdue(left) ? 0 : 1;
      const rightOverdueRank = isRowOverdue(right) ? 0 : 1;
      if (leftOverdueRank !== rightOverdueRank) {
        return leftOverdueRank - rightOverdueRank;
      }

      return left.scheduledAt.localeCompare(right.scheduledAt);
    });
  }, [activeFilter, searchedRows, sortMode]);
  const filterCounts = useMemo(
    () => ({
      all: rows.length,
      ready: rows.filter((row) => row.workflowState === "ready").length,
      in_consultation: rows.filter((row) => row.workflowState === "in_consultation").length,
      blocked: rows.filter((row) => row.workflowState === "blocked").length,
      overdue: rows.filter((row) => isRowOverdue(row)).length,
      teleconsult: rows.filter((row) => row.visitType === "teleconsultation").length,
    }),
    [rows],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / DOCTOR_WORKFLOW_PAGE_SIZE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * DOCTOR_WORKFLOW_PAGE_SIZE;
  const paginatedRows = useMemo(
    () => filteredRows.slice(pageStart, pageStart + DOCTOR_WORKFLOW_PAGE_SIZE),
    [filteredRows, pageStart],
  );
  const showingStart = filteredRows.length === 0 ? 0 : pageStart + 1;
  const showingEnd =
    filteredRows.length === 0
      ? 0
      : Math.min(pageStart + DOCTOR_WORKFLOW_PAGE_SIZE, filteredRows.length);
  const summary = useMemo(
    () => ({
      ready: rows.filter((row) => row.canStartConsultation).length,
      blocked: rows.filter((row) => !row.canStartConsultation).length,
      inConsultation: rows.filter(
        (row) => row.workflowState === "in_consultation",
      ).length,
      overdue: rows.filter((row) => isRowOverdue(row)).length,
    }),
    [rows],
  );

  return (
    <div className="space-y-5">
      <section className={cn(INTERNAL_SURFACE, 'divide-y divide-slate-100/90')}>
        <div className="flex flex-col gap-5 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="mt-0.5 flex shrink-0 items-center justify-center rounded-xl p-2.5 ring-1"
              style={{
                background: 'color-mix(in srgb, var(--color-primary) 14%, white)',
                color: 'var(--color-primary)',
                ringColor: 'color-mix(in srgb, var(--color-primary) 30%, white)',
              }}
            >
              <Stethoscope className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Role Workflow</p>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Doctor Workflow</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">Cleared consultation queue, blockers, charts, and SOAP entry</p>
            </div>
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
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              to="/app/patients/scan"
            >
              <UserRoundSearch className="size-4" />
              Scan patient
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              to="/app/specialist-referrals"
            >
              <FileText className="size-4" />
              Referrals
            </Link>
          </div>
        </div>

        <div className="grid bg-slate-50/90 md:grid-cols-4">
          <div className="border-b border-slate-100/90 px-6 py-4 md:border-b-0 md:border-r md:border-slate-100/90">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Ready</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.ready}</p>
          </div>
          <div className="border-b border-slate-100/90 px-6 py-4 md:border-b-0 md:border-r md:border-slate-100/90">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Blocked</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.blocked}</p>
          </div>
          <div className="border-b border-slate-100/90 px-6 py-4 md:border-b-0 md:border-r md:border-slate-100/90">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Overdue</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-rose-700">{summary.overdue}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">In consultation</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.inConsultation}</p>
          </div>
        </div>
      </section>

      <section className={INTERNAL_SURFACE}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/90 px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Consultation Queue</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {filteredRows.length} patient{filteredRows.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-[inset_0_1px_1px_rgba(15,41,71,0.04)]">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search patient or blocker"
              value={search}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/90 bg-slate-50/90 px-6 py-3">
          <div className="flex flex-wrap gap-2">
            {([
              ["all", "All"],
              ["ready", "Ready"],
              ["in_consultation", "In Consultation"],
              ["blocked", "Blocked"],
              ["overdue", "Overdue"],
              ["teleconsult", "Teleconsults"],
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

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Sort</span>
            <select
              className="rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              onChange={(event) => {
                setSortMode(event.target.value as DoctorQueueSort);
                setCurrentPage(1);
              }}
              value={sortMode}
            >
              <option value="priority">Priority</option>
              <option value="scheduled">Scheduled time</option>
              <option value="longest_waiting">Longest waiting</option>
            </select>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <EmptyDoctorQueue />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      #
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      Patient
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      Schedule
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      Blocker
                    </th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.map((row) => {
                    const waitingMinutes = getMinutesSinceScheduled(row.scheduledAt);
                    const overdue = isRowOverdue(row);
                    const blockerAction = getBlockerAction(row);

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
                          <Link
                            className="font-bold text-slate-950 hover:text-[var(--color-primary)] hover:underline"
                            to={`/app/patients/${row.patientId}`}
                          >
                            {row.patientName}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">{row.reason}</p>
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
                            <Clock3 className="size-3.5" />
                            {overdue ? `Overdue ${waitingMinutes}m` : `Waiting ${waitingMinutes}m`}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              className="rounded-none text-[10px] font-bold uppercase tracking-widest"
                              intent={workflowBadgeIntent(row.workflowState)}
                            >
                              {labelFromValue(row.workflowState)}
                            </Badge>
                            <Badge
                              className="rounded-none text-[10px] font-bold uppercase tracking-widest"
                              intent={paymentBadgeIntent(row.paymentState)}
                            >
                              {labelFromValue(row.paymentState)}
                            </Badge>
                            {row.visitType === "teleconsultation" ? (
                              <Badge
                                className="rounded-none text-[10px] font-bold uppercase tracking-widest"
                                intent="neutral"
                              >
                                Teleconsult
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {row.blockingReason ? (
                            <div className="space-y-2">
                              <div className="flex max-w-xs gap-2 text-sm text-amber-700">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                <span>{row.blockingReason}</span>
                              </div>
                              {blockerAction ? (
                                <Link
                                  className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 transition hover:bg-amber-100"
                                  to={blockerAction.to}
                                >
                                  {blockerAction.label}
                                </Link>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-emerald-700">
                              Cleared for SOAP
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <DoctorQueueActions row={row} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
              <p className="text-xs font-semibold text-slate-500">
                Showing {showingStart}-{showingEnd} of {filteredRows.length} patients
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  type="button"
                >
                  Previous
                </button>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <button
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
