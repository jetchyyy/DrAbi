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
import { useDeferredValue, useMemo, useState } from "react";
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

function getPhilippineDateKeyFromIso(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Manila",
    year: "numeric",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
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
  const { data: appointments = [] } = useAppointments();
  const { data: patients = [] } = usePatients();
  const { data: invoices = [] } = useInvoices();
  const bookingsQuery = usePatientBookings();
  const updateAppointment = useUpdateAppointment();
  const markBookingPaid = useMarkBookingPaid();
  const [search, setSearch] = useState("");
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
  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        `${row.patientName} ${row.reason} ${row.appointmentStatus} ${row.workflowState} ${row.receiptCode ?? ""}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, rows],
  );
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
  const walkInRows = useMemo(
    () => rows.filter((row) => row.isWalkInPatient),
    [rows],
  );
  const walkInPatientIdsWithAppointmentsToday = useMemo(
    () => new Set(walkInRows.map((row) => row.patientId)),
    [walkInRows],
  );
  const walkInSummary = useMemo(
    () => ({
      waitingAppointment: patients.filter(
        (patient) =>
          patient.intakeSource === "staff_walk_in" &&
          getPhilippineDateKeyFromIso(patient.createdAt) === todayDateKey &&
          !walkInPatientIdsWithAppointmentsToday.has(patient.id),
      ).length,
      waitingBilling: walkInRows.filter((row) => row.paymentState !== "paid").length,
      readyForConsultation: walkInRows.filter(
        (row) => row.workflowState === "ready_for_doctor",
      ).length,
      inConsultation: walkInRows.filter(
        (row) => row.workflowState === "in_consultation",
      ).length,
    }),
    [patients, todayDateKey, walkInPatientIdsWithAppointmentsToday, walkInRows],
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
              className="inline-flex items-center border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => setWalkInWizardOpen(true)}
              type="button"
              variant="secondary"
            >
              <UserRoundPlus className="mr-2 size-4" />
              Start walk-in flow
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

      <section className="border border-orange-200 bg-orange-50 shadow-sm">
        <div className="border-b border-orange-200 px-6 py-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-700">
            Walk-In Fast Lane
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            Add patient, appoint, bill, and clear for consultation in one guided path.
          </p>
        </div>

        <div className="grid gap-0 border-b border-orange-200 md:grid-cols-4">
          <div className="border-b border-orange-200 px-6 py-4 md:border-b-0 md:border-r">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
              Add patient
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">
              {walkInSummary.waitingAppointment}
            </p>
            <p className="mt-1 text-xs text-slate-600">Waiting for appointment</p>
          </div>
          <div className="border-b border-orange-200 px-6 py-4 md:border-b-0 md:border-r">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
              Appoint patient
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">
              {walkInSummary.waitingBilling}
            </p>
            <p className="mt-1 text-xs text-slate-600">Waiting for billing clearance</p>
          </div>
          <div className="border-b border-orange-200 px-6 py-4 md:border-b-0 md:border-r">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
              Billing
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">
              {walkInSummary.readyForConsultation}
            </p>
            <p className="mt-1 text-xs text-slate-600">Ready for consultation</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
              Consultation
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">
              {walkInSummary.inConsultation}
            </p>
            <p className="mt-1 text-xs text-slate-600">Already in progress</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-6 py-4">
          <Link
            className="inline-flex items-center border border-orange-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-orange-700 transition hover:bg-orange-100"
            to="/app/patients?action=walk-in-intake&next=appointment"
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
          <Link
            className="inline-flex items-center border border-orange-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-orange-700 transition hover:bg-orange-100"
            to="/app/doctor-workflow"
          >
            Ready For Consultation
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </div>
      </section>

      <section className="border border-slate-200 bg-white shadow-sm">
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patient, receipt, status"
              value={search}
            />
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <EmptyQueue />
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
                    Payment
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Workflow
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
                      {row.isWalkInPatient ? (
                        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-600">
                          Walk-in
                        </p>
                      ) : null}
                      <Link
                        className="font-bold text-slate-950 hover:text-orange-600 hover:underline"
                        to={`/app/patients/${row.patientId}`}
                      >
                        {row.patientName}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{row.reason}</p>
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
                    <td className="px-4 py-3">
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
                        <Link
                          className="inline-flex items-center border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
                          to={`/app/patients/${row.patientId}`}
                        >
                          <CheckCircle2 className="mr-1 size-3.5" />
                          Vitals
                        </Link>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <WalkInWizardModal open={walkInWizardOpen} onClose={() => setWalkInWizardOpen(false)} />
    </div>
  );
}
