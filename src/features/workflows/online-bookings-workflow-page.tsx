import { CalendarCheck2, ReceiptText, Search, UserRound } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/ui/button";
import { StatusPill } from "../../components/ui/status-pill";
import { INTERNAL_SURFACE } from "../../lib/internal-ui";
import { cn, formatCurrency } from "../../lib/utils";
import { usePatientBookings, type PatientBookingRow } from "../appointments/hooks/use-patients-booking";
import { usePatients } from "../patients/hooks/use-patients";
import { OnlineBookingWizardModal } from "./online-bookings-wizard-modal";
import { WorkflowModeToggle } from "./workflow-mode-toggle";

const PAGE_SIZE = 8;

function formatBookingSchedule(preferredDate: string, preferredTime: string) {
  if (!preferredDate || !preferredTime) {
    return "Not scheduled";
  }

  const value = new Date(`${preferredDate}T${preferredTime}:00`);
  if (Number.isNaN(value.getTime())) {
    return `${preferredDate} ${preferredTime}`;
  }

  return value.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function hasVitals(
  patient:
    | {
        temperature?: string;
        bloodPressure?: string;
        heartRate?: string;
        o2Sat?: string;
        respiratoryRate?: string;
        weight?: string;
        height?: string;
      }
    | undefined,
) {
  if (!patient) {
    return false;
  }

  return Boolean(
    patient.temperature ||
      patient.bloodPressure ||
      patient.heartRate ||
      patient.o2Sat ||
      patient.respiratoryRate ||
      patient.weight ||
      patient.height,
  );
}

function bookingSearchText(booking: PatientBookingRow) {
  return [
    booking.patientFullName,
    booking.serviceName,
    booking.doctorFullName ?? "",
    booking.receiptCode,
    booking.status,
    booking.paymentStatus,
    booking.intakeNotes,
  ]
    .join(" ")
    .toLowerCase();
}

function BookingPaymentPill({ status }: { status: PatientBookingRow["paymentStatus"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ring-1",
        status === "paid"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-amber-50 text-amber-700 ring-amber-200",
      )}
    >
      {status === "paid" ? "Paid" : "Pending cashier"}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <CalendarCheck2 className="mx-auto size-10 text-slate-300" />
      <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-slate-900">
        No online bookings
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Online bookings will appear here for confirmation, vitals, billing, and doctor handoff.
      </p>
    </div>
  );
}

export function OnlineBookingsWorkflow({
  onSwitchToWalkIn,
}: {
  onSwitchToWalkIn: () => void;
}) {
  const { data: bookings = [] } = usePatientBookings();
  const { data: patients = [] } = usePatients();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const patientMap = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient])),
    [patients],
  );

  const activeRows = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status !== "cancelled" && booking.status !== "completed")
        .slice()
        .sort((left, right) => {
          const leftKey = `${left.preferredDate}T${left.preferredTime}`;
          const rightKey = `${right.preferredDate}T${right.preferredTime}`;
          return leftKey.localeCompare(rightKey);
        }),
    [bookings],
  );

  const filteredRows = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return activeRows;
    }

    return activeRows.filter((booking) => bookingSearchText(booking).includes(query));
  }, [activeRows, deferredSearch]);

  const summary = useMemo(
    () => ({
      pendingConfirmation: activeRows.filter((booking) => booking.status === "pending").length,
      vitalsNeeded: activeRows.filter((booking) => !hasVitals(patientMap.get(booking.patientId))).length,
      billingReady: activeRows.filter((booking) => booking.paymentStatus !== "paid").length,
      readyForDoctor: activeRows.filter(
        (booking) => booking.status === "confirmed" && booking.paymentStatus === "paid",
      ).length,
    }),
    [activeRows, patientMap],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  const showingStart = filteredRows.length === 0 ? 0 : startIndex + 1;
  const showingEnd =
    filteredRows.length === 0 ? 0 : Math.min(startIndex + PAGE_SIZE, filteredRows.length);
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) ?? null;

  return (
    <section className={cn(INTERNAL_SURFACE, "divide-y divide-slate-100/90")}>
      <div className="flex flex-col gap-5 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex shrink-0 items-center justify-center rounded-xl bg-blue-50 p-2.5 text-blue-600 ring-1 ring-blue-100">
            <CalendarCheck2 className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-500">
              Online booking mode
            </p>
            <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
              Online Bookings Workflow
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
              Confirm the booking, capture vitals, auto-build billing, and send the patient to consultation.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:w-[780px] md:flex-none">
          <WorkflowModeToggle
            mode="online_bookings"
            onOnlineBookings={() => {}}
            onWalkIn={onSwitchToWalkIn}
          />

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
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-500">
            Pending confirmation
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.pendingConfirmation}</p>
        </div>
        <div className="border-b border-slate-100/90 px-6 py-4 md:border-b-0 md:border-r md:border-slate-100/90">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-500">
            Vitals needed
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.vitalsNeeded}</p>
        </div>
        <div className="border-b border-slate-100/90 px-6 py-4 md:border-b-0 md:border-r md:border-slate-100/90">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-500">
            Billing ready
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.billingReady}</p>
        </div>
        <div className="px-6 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-500">
            Ready for doctor
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.readyForDoctor}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/90 px-6 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-500">
            Online booking table
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {filteredRows.length} active booking{filteredRows.length === 1 ? "" : "s"}
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
            placeholder="Search patient, service, doctor, receipt"
            value={search}
          />
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="px-6 py-6">
          <EmptyState />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Patient
                  </th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Schedule
                  </th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Booking
                  </th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Status
                  </th>
                  <th className="sticky right-0 top-0 z-10 bg-slate-50 px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedRows.map((booking) => {
                  const patient = patientMap.get(booking.patientId);
                  const vitalsMissing = !hasVitals(patient);

                  return (
                    <tr className="align-top transition-colors hover:bg-slate-50" key={booking.id}>
                      <td className="px-4 py-4">
                        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-blue-500">
                          Online booking
                        </p>
                        <div className="flex items-start gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                            <UserRound className="size-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-950">{booking.patientFullName}</p>
                            <p className="mt-1 text-xs text-slate-500">{booking.serviceName}</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-400">
                              {booking.doctorFullName || "Clinic doctor"}
                            </p>
                            <p className="mt-1 font-mono text-[11px] font-semibold text-slate-400">
                              {booking.receiptCode}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <p className="font-medium text-slate-900">
                          {formatBookingSchedule(booking.preferredDate, booking.preferredTime)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Fee {formatCurrency(booking.feeAmount)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {booking.feeType === "follow_up"
                            ? "Follow-up"
                            : booking.feeType === "consultation"
                              ? "Consultation"
                              : "Service fee"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{booking.intakeNotes}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <StatusPill className="bg-blue-50 text-blue-700 ring-blue-200" status={booking.status} />
                          <BookingPaymentPill status={booking.paymentStatus} />
                        </div>
                        <p className="mt-2 text-[11px] font-semibold text-slate-500">
                          {vitalsMissing ? "Vitals still needed" : "Vitals on file"}
                        </p>
                      </td>
                      <td className="sticky right-0 bg-white px-4 py-4 text-right">
                        <Button
                          className="!bg-blue-600 !px-4 !py-2.5 !text-white hover:!bg-blue-700"
                          onClick={() => setSelectedBookingId(booking.id)}
                          type="button"
                        >
                          Open wizard
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs font-semibold text-slate-500">
              Showing {showingStart}-{showingEnd} of {filteredRows.length} bookings
            </p>
            <div className="flex items-center gap-2">
              <Button
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                type="button"
                variant="tertiary"
                size="sm"
              >
                Previous
              </Button>
              <span className="text-xs font-semibold text-slate-500">
                Page {safePage} of {totalPages}
              </span>
              <Button
                disabled={safePage >= totalPages}
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

      <OnlineBookingWizardModal
        booking={selectedBooking}
        onClose={() => setSelectedBookingId(null)}
        open={Boolean(selectedBooking)}
      />
    </section>
  );
}
