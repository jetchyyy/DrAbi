import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Search,
  Stethoscope,
  UserRoundSearch,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "../../components/ui/badge";
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
        className="inline-flex items-center border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
        to={`/app/patients/${row.patientId}`}
      >
        <FileText className="mr-1 size-3.5" />
        Chart
      </Link>
      {row.canStartConsultation ? (
        <Link
          className="inline-flex items-center bg-orange-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-orange-700"
          to={`/app/consultation/${row.patientId}?appointmentId=${row.appointmentId}`}
        >
          <Stethoscope className="mr-1 size-3.5" />
          Consult
        </Link>
      ) : (
        <button
          className="inline-flex cursor-not-allowed items-center bg-orange-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white opacity-60"
          disabled
          type="button"
        >
          <Stethoscope className="mr-1 size-3.5" />
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
  const deferredSearch = useDeferredValue(search);
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
  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        `${row.patientName} ${row.reason} ${row.appointmentStatus} ${row.workflowState} ${row.blockingReason ?? ""}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, rows],
  );
  const summary = useMemo(
    () => ({
      ready: rows.filter((row) => row.canStartConsultation).length,
      blocked: rows.filter((row) => !row.canStartConsultation).length,
      inConsultation: rows.filter(
        (row) => row.workflowState === "in_consultation",
      ).length,
    }),
    [rows],
  );

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-orange-600 p-2.5 text-white">
              <Stethoscope className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
                Role Workflow
              </p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
                Doctor Workflow
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Cleared consultation queue, blockers, charts, and SOAP entry.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex items-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              to="/app/patients/scan"
            >
              <UserRoundSearch className="mr-2 size-4" />
              Scan patient
            </Link>
            <Link
              className="inline-flex items-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              to="/app/specialist-referrals"
            >
              <FileText className="mr-2 size-4" />
              Referrals
            </Link>
          </div>
        </div>

        <div className="grid border-t border-slate-100 bg-slate-50 md:grid-cols-3">
          <div className="border-b border-slate-100 px-6 py-4 md:border-b-0 md:border-r">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Ready
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">
              {summary.ready}
            </p>
          </div>
          <div className="border-b border-slate-100 px-6 py-4 md:border-b-0 md:border-r">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Blocked
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">
              {summary.blocked}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
              Consultation Queue
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {filteredRows.length} patient{filteredRows.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patient or blocker"
              value={search}
            />
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <EmptyDoctorQueue />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
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
                {filteredRows.map((row) => (
                  <tr className="align-top transition-colors hover:bg-slate-50" key={row.id}>
                    <td className="px-4 py-3">
                      <Link
                        className="font-bold text-slate-950 hover:text-orange-600 hover:underline"
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
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.blockingReason ? (
                        <div className="flex max-w-xs gap-2 text-sm text-amber-700">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                          <span>{row.blockingReason}</span>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
