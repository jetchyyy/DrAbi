import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Search, Loader2, AlertCircle } from "lucide-react";

import {
  usePatientBookings,
  useDoctorAvailabilityForBooking,
  useBlockedBookingSlots,
  useUpdateBookingStatus,
  useDeleteBooking,
  type PatientBookingRow,
} from "./hooks/use-patients-booking";

// ---------------------------------------------------------------------------
// Tiny utility helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PAGE_SIZE = 7;

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function feeTypeLabel(type: string) {
  switch (type) {
    case "consultation":
      return "Consultation";
    case "follow_up":
      return "Follow-up";
    default:
      return "Service Fee";
  }
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-orange-50 text-orange-700 border-orange-200",
  confirmed: "bg-indigo-50 text-indigo-600 border-indigo-200",
  rescheduled: "bg-sky-50 text-sky-600 border-sky-200",
  cancelled: "bg-red-50 text-red-500 border-red-200",
  completed: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

const PAYMENT_STYLES: Record<string, string> = {
  paid: "bg-orange-50 text-orange-700 border-orange-200",
  pending_cashier: "bg-slate-100 text-slate-600 border-slate-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${
        STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600 border-gray-200"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const label = status === "paid" ? "Paid" : "Pending";
  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${
        PAYMENT_STYLES[status] ?? "bg-gray-100 text-gray-600 border-gray-200"
      }`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  booking: PatientBookingRow;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function DeleteDialog({
  booking,
  onConfirm,
  onCancel,
  isLoading,
}: DeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-sm border border-slate-200 bg-white shadow-2xl mx-4 p-6">
        <div className="flex flex-col items-center text-center gap-3">
          {/* Warning Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Delete Booking?
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Are you sure you want to remove the booking for{" "}
              <span className="font-medium text-gray-700">
                {booking.patientFullName}
              </span>{" "}
              on{" "}
              <span className="font-medium text-gray-700">
                {formatDate(booking.preferredDate)}
              </span>
              ? This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit / Status-update modal
// ---------------------------------------------------------------------------

interface EditModalProps {
  booking: PatientBookingRow;
  onClose: () => void;
}

function EditModal({ booking, onClose }: EditModalProps) {
  const updateMutation = useUpdateBookingStatus();

  const [status, setStatus] = useState(booking.status);
  const [cancelledReason, setCancelledReason] = useState(
    booking.cancelledReason ?? "",
  );
  const [rescheduledReason, setRescheduledReason] = useState(
    booking.rescheduledReason ?? "",
  );
  const [newDate, setNewDate] = useState(booking.preferredDate);
  const [newTime, setNewTime] = useState(booking.preferredTime);
  const [error, setError] = useState<string | null>(null);

  // Availability data for reschedule
  const { data: availability = [] } = useDoctorAvailabilityForBooking(
    status === "rescheduled" ? booking.doctorId : null,
  );
  const { data: blockedSlots = [] } = useBlockedBookingSlots(
    status === "rescheduled" ? newDate : null,
    booking.doctorId,
    booking.serviceId,
  );

  // Compute available time slots from doctor_availability for the selected date
  const selectedDayOfWeek = useMemo(() => {
    if (!newDate) return -1;
    return new Date(newDate + "T00:00:00").getDay();
  }, [newDate]);

  const availableSlots = useMemo(() => {
    if (status !== "rescheduled" || selectedDayOfWeek < 0) return [];
    const daySlots = availability.filter(
      (av) => av.dayOfWeek === selectedDayOfWeek,
    );
    if (daySlots.length === 0) return [];

    const slots: string[] = [];
    for (const slot of daySlots) {
      const start = new Date(`1970-01-01T${slot.startTime}`);
      const end = new Date(`1970-01-01T${slot.endTime}`);
      const step = (slot.slotMinutes || 30) * 60 * 1000;
      let cur = start.getTime();
      while (cur < end.getTime()) {
        const d = new Date(cur);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        slots.push(`${hh}:${mm}`);
        cur += step;
      }
    }
    return slots.filter((s) => !blockedSlots.includes(s));
  }, [availability, selectedDayOfWeek, blockedSlots, status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateMutation.mutateAsync({
        bookingId: booking.id,
        status: status as "confirmed" | "rescheduled" | "cancelled",
        cancelledReason: status === "cancelled" ? cancelledReason : undefined,
        rescheduledReason:
          status === "rescheduled" ? rescheduledReason : undefined,
        newPreferredDate: status === "rescheduled" ? newDate : undefined,
        newPreferredTime: status === "rescheduled" ? newTime : undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg border border-slate-200 bg-white shadow-2xl mx-4 max-h-[85vh] sm:max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-orange-600 px-6 py-4">
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">
            Edit Booking
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="divide-y divide-slate-100 flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Read-only summary */}
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4">
                <Field label="Patient">{booking.patientFullName}</Field>
                <Field label="Doctor / Service">
                  {booking.doctorFullName ?? booking.serviceName}
                </Field>
                <Field label="Current Date">
                  {formatDate(booking.preferredDate)}
                </Field>
                <Field label="Current Time">
                  {formatTime(booking.preferredTime)}
                </Field>
                <Field label="Fee Type">{feeTypeLabel(booking.feeType)}</Field>
                <Field label="Fee Amount">
                  ₱{booking.feeAmount.toLocaleString()}
                </Field>
              </div>
            </div>

            {/* Status selector */}
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Update Status
                </label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setError(null);
                  }}
                  className="w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rescheduled">Rescheduled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Cancelled reason */}
              {status === "cancelled" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Cancellation Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={cancelledReason}
                    onChange={(e) => setCancelledReason(e.target.value)}
                    placeholder="Enter reason for cancellation…"
                    className="w-full resize-none border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              )}

              {/* Reschedule fields */}
              {status === "rescheduled" && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Reschedule Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={rescheduledReason}
                      onChange={(e) => setRescheduledReason(e.target.value)}
                      placeholder="Enter reason for rescheduling…"
                      className="w-full resize-none border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        New Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="date"
                        value={newDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => {
                          setNewDate(e.target.value);
                          setNewTime("");
                        }}
                        className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        New Time <span className="text-red-500">*</span>
                      </label>
                      {booking.doctorId && availableSlots.length > 0 ? (
                        <select
                          required
                          value={newTime}
                          onChange={(e) => setNewTime(e.target.value)}
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                        >
                          <option value="">Select time</option>
                          {availableSlots.map((slot) => (
                            <option key={slot} value={slot}>
                              {formatTime(slot)}
                            </option>
                          ))}
                        </select>
                      ) : booking.doctorId &&
                        newDate &&
                        availableSlots.length === 0 ? (
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                          No available slots on{" "}
                          {DAY_NAMES[selectedDayOfWeek] ?? "this day"}.
                        </div>
                      ) : (
                        <input
                          required
                          type="time"
                          value={newTime}
                          onChange={(e) => setNewTime(e.target.value)}
                          className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Intake notes (read-only display) */}
              {booking.intakeNotes && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">
                    Intake Notes
                  </p>
                  <p className="bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {booking.intakeNotes}
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              className="border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-orange-600 px-4 py-2 text-sm font-extrabold uppercase tracking-widest text-white hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-800">{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty & loading states
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
        <svg
          className="h-6 w-6 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-600">No bookings found</p>
      <p className="mt-1 text-xs text-gray-400">
        Bookings will appear here once patients schedule appointments.
      </p>
    </div>
  );
}

function LoadingRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 w-full rounded bg-gray-100" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Column header
// ---------------------------------------------------------------------------

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function PatientBookingPageList() {
  const { data: bookings = [], isLoading, error } = usePatientBookings();
  const deleteMutation = useDeleteBooking();

  const [editingBooking, setEditingBooking] =
    useState<PatientBookingRow | null>(null);
  const [deletingBooking, setDeletingBooking] =
    useState<PatientBookingRow | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Search & filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const matchesStatus = statusFilter === "all" || b.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        b.patientFullName.toLowerCase().includes(q) ||
        b.doctorFullName?.toLowerCase().includes(q) ||
        b.serviceName.toLowerCase().includes(q) ||
        b.receiptCode.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [bookings, search, statusFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    [filtered.length],
  );

  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingBooking) return;
    await deleteMutation.mutateAsync(deletingBooking.id);
    setDeletingBooking(null);
  }, [deletingBooking, deleteMutation]);

  return (
    <div className="space-y-6">
      <div className="border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 bg-orange-600 p-2.5 text-white">
              <CalendarCheck2 className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
                Operations
              </p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
                Patient Bookings
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage and review all patient booking records.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, doctor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
          <span className="text-xs font-bold text-slate-500">
            {filtered.length} booking{filtered.length !== 1 ? "s" : ""} found
          </span>
        </div>
      </div>

      {/* Table card */}
      <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        {error ? (
          <div className="px-6 py-8 text-center text-sm text-red-500">
            Failed to load bookings:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Patient</Th>
                  <Th>Doctor / Service</Th>
                  <Th>Schedule</Th>
                  <Th>Booking Status</Th>
                  <Th>Payment Status</Th>
                  <Th>Cancelled Reason</Th>
                  <Th>Rescheduled Reason</Th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <LoadingRow key={i} />
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState />
                    </td>
                  </tr>
                ) : (
                  paginatedBookings.map((booking) => (
                    <BookingTableRow
                      key={booking.id}
                      booking={booking}
                      onEdit={() => setEditingBooking(booking)}
                      onDelete={() => setDeletingBooking(booking)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Showing{" "}
            {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}-
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="border border-slate-200 px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest text-orange-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className="border border-slate-200 px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest text-orange-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingBooking && (
        <EditModal
          booking={editingBooking}
          onClose={() => setEditingBooking(null)}
        />
      )}

      {/* Delete confirmation */}
      {deletingBooking && (
        <DeleteDialog
          booking={deletingBooking}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingBooking(null)}
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual table row
// ---------------------------------------------------------------------------

interface BookingTableRowProps {
  booking: PatientBookingRow;
  onEdit: () => void;
  onDelete: () => void;
}

function BookingTableRow({ booking, onEdit, onDelete }: BookingTableRowProps) {
  return (
    <tr className="group hover:bg-slate-50 transition-colors">
      {/* Patient */}
      <td className="px-4 py-3 align-top">
        <p className="font-bold text-slate-950">{booking.patientFullName}</p>
        {booking.intakeNotes && (
          <p
            className="mt-0.5 max-w-[140px] truncate text-xs text-slate-400"
            title={booking.intakeNotes}
          >
            {booking.intakeNotes}
          </p>
        )}
      </td>

      {/* Doctor / Service */}
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-slate-700">
          {booking.doctorFullName ?? booking.serviceName}
        </p>
        <p className="text-xs text-slate-400">
          {feeTypeLabel(booking.feeType)}
        </p>
      </td>

      {/* Schedule */}
      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-slate-600">
        <p>{formatDate(booking.preferredDate)}</p>
        <p className="text-xs text-slate-400">
          {formatTime(booking.preferredTime)}
        </p>
      </td>

      {/* Booking status */}
      <td className="px-4 py-3 align-top">
        <StatusBadge status={booking.status} />
      </td>

      {/* Payment status */}
      <td className="px-4 py-3 align-top">
        <PaymentBadge status={booking.paymentStatus} />
      </td>

      {/* Cancelled reason */}
      <td className="px-4 py-3 align-top max-w-[120px]">
        {booking.cancelledReason ? (
          <span
            className="block line-clamp-2 text-xs text-slate-600"
            title={booking.cancelledReason}
          >
            {booking.cancelledReason}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>

      {/* Rescheduled reason */}
      <td className="px-4 py-3 align-top max-w-[120px]">
        {booking.rescheduledReason ? (
          <span
            className="block line-clamp-2 text-xs text-slate-600"
            title={booking.rescheduledReason}
          >
            {booking.rescheduledReason}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            title="Edit booking"
            aria-label="Edit booking"
            className="inline-flex h-7 w-7 items-center justify-center border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100"
          >
            <svg
              className="size-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
              />
            </svg>
            <span className="sr-only">Edit</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete booking"
            aria-label="Delete booking"
            className="inline-flex h-7 w-7 items-center justify-center border border-rose-200 text-rose-600 transition-colors hover:bg-rose-50"
          >
            <svg
              className="size-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
            <span className="sr-only">Delete</span>
          </button>
        </div>
      </td>
    </tr>
  );
}
