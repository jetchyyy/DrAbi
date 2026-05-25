import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarCheck2,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { updatePatientLiveOrDemo } from "../../lib/supabase-clinic";
import { usePatientDetail } from "../patients/hooks/use-patients";
import {
  usePatientBookings,
  useDoctorAvailabilityForBooking,
  useBlockedBookingSlots,
  useUpdateBookingStatus,
  useDeleteBooking,
  type PatientBookingRow,
} from "../appointments/hooks/use-patients-booking";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PAGE_SIZE = 8;

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

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentTimeInputValue(reference = new Date()) {
  return `${String(reference.getHours()).padStart(2, "0")}:${String(
    reference.getMinutes(),
  ).padStart(2, "0")}`;
}

function normalizeBlockedSlotTime(value: unknown) {
  if (typeof value !== "string") return "";
  return value.slice(0, 5);
}

function normalizeTimeValue(value: string) {
  return value.slice(0, 5);
}

function isPastLocalDate(dateStr: string, referenceDate = new Date()) {
  if (!dateStr) return false;
  return dateStr < getLocalDateKey(referenceDate);
}

function isPastRescheduleTime(dateStr: string, timeStr: string) {
  if (!dateStr || !timeStr) return false;
  const scheduled = new Date(`${dateStr}T${normalizeTimeValue(timeStr)}:00`);
  if (Number.isNaN(scheduled.getTime())) return false;
  return scheduled.getTime() < Date.now();
}

function feeTypeLabel(type: string | null) {
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
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending_cashier: "bg-slate-100 text-slate-600 border-slate-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${
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
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${
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

function DeleteDialog({
  booking,
  onConfirm,
  onCancel,
  isLoading,
}: {
  booking: PatientBookingRow;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative z-10 mx-4 w-full max-w-sm border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex flex-col items-center gap-3 text-center">
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
              ? This cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            className="flex-1 border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            disabled={isLoading}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex flex-1 items-center justify-center gap-2 bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60"
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
          >
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isLoading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit / Status-update modal
// ---------------------------------------------------------------------------

function EditModal({
  booking,
  onClose,
}: {
  booking: PatientBookingRow;
  onClose: () => void;
}) {
  const updateMutation = useUpdateBookingStatus();
  const todayDateKey = getLocalDateKey(new Date());

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

  const { data: availability = [] } = useDoctorAvailabilityForBooking(
    status === "rescheduled" ? booking.doctorId : null,
  );
  const { data: blockedSlots = [] } = useBlockedBookingSlots(
    status === "rescheduled" ? newDate : null,
    booking.doctorId,
    booking.serviceId,
  );

  const normalizedBlockedSlots = useMemo(
    () => blockedSlots.map((slot) => normalizeBlockedSlotTime(slot)),
    [blockedSlots],
  );

  const currentTimeInputValue = getCurrentTimeInputValue();
  const isRescheduleForToday =
    status === "rescheduled" && newDate === todayDateKey;
  const isRescheduleDateInPast =
    status === "rescheduled" && isPastLocalDate(newDate);
  const selectedRescheduleTimeIsBlocked =
    status === "rescheduled" &&
    Boolean(newTime) &&
    normalizedBlockedSlots.includes(newTime);
  const selectedRescheduleTimeIsPast =
    status === "rescheduled" &&
    Boolean(newTime) &&
    isPastRescheduleTime(newDate, newTime);

  const selectedDayOfWeek = useMemo(() => {
    if (!newDate) return -1;
    return new Date(newDate + "T00:00:00").getDay();
  }, [newDate]);

  const availableSlots = useMemo(() => {
    if (status !== "rescheduled" || selectedDayOfWeek < 0) return [];
    if (isRescheduleDateInPast) return [];
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
    return slots.filter((s) => {
      if (normalizedBlockedSlots.includes(s)) return false;
      if (isRescheduleForToday && isPastRescheduleTime(newDate, s)) return false;
      return true;
    });
  }, [
    availability,
    isRescheduleDateInPast,
    isRescheduleForToday,
    newDate,
    normalizedBlockedSlots,
    selectedDayOfWeek,
    status,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (status === "rescheduled" && selectedRescheduleTimeIsBlocked) {
      setError("The selected time is no longer available. Please choose another slot.");
      return;
    }
    if (status === "rescheduled" && isRescheduleDateInPast) {
      setError("The selected date is already in the past. Please choose today or a later date.");
      return;
    }
    if (status === "rescheduled" && selectedRescheduleTimeIsPast) {
      setError("The selected time is already in the past. Please choose a later slot.");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        bookingId: booking.id,
        status: status as "confirmed" | "rescheduled" | "cancelled",
        cancelledReason: status === "cancelled" ? cancelledReason : undefined,
        rescheduledReason: status === "rescheduled" ? rescheduledReason : undefined,
        newPreferredDate: status === "rescheduled" ? newDate : undefined,
        newPreferredTime: status === "rescheduled" ? newTime : undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 mx-4 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 bg-orange-600 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">
              Edit Booking
            </h2>
            <p className="mt-0.5 text-sm font-medium text-white/90">
              Update booking status, timing, and notes.
            </p>
          </div>
          <button
            aria-label="Close edit modal"
            className="inline-flex shrink-0 items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void handleSubmit(e)}>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4">
                <div>
                  <p className="mb-0.5 text-xs font-medium text-gray-500">Patient</p>
                  <p className="text-sm font-medium text-gray-800">{booking.patientFullName}</p>
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium text-gray-500">Doctor / Service</p>
                  <p className="text-sm font-medium text-gray-800">
                    {booking.doctorFullName ?? booking.serviceName}
                  </p>
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium text-gray-500">Current Date</p>
                  <p className="text-sm font-medium text-gray-800">
                    {formatDate(booking.preferredDate)}
                  </p>
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium text-gray-500">Current Time</p>
                  <p className="text-sm font-medium text-gray-800">
                    {formatTime(booking.preferredTime)}
                  </p>
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium text-gray-500">Fee Type</p>
                  <p className="text-sm font-medium text-gray-800">
                    {feeTypeLabel(booking.feeType)}
                  </p>
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium text-gray-500">Fee Amount</p>
                  <p className="text-sm font-medium text-gray-800">
                    ₱{booking.feeAmount.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Status selector */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Update Status
                </label>
                <select
                  className="w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setError(null);
                  }}
                  value={status}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rescheduled">Rescheduled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Cancellation reason */}
              {status === "cancelled" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Cancellation Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full resize-none border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    onChange={(e) => setCancelledReason(e.target.value)}
                    placeholder="Enter reason for cancellation…"
                    required
                    rows={3}
                    value={cancelledReason}
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
                      className="w-full resize-none border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      onChange={(e) => setRescheduledReason(e.target.value)}
                      placeholder="Enter reason for rescheduling…"
                      required
                      rows={2}
                      value={rescheduledReason}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        New Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                        min={todayDateKey}
                        onChange={(e) => {
                          setNewDate(e.target.value);
                          setNewTime("");
                        }}
                        required
                        type="date"
                        value={newDate}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        New Time <span className="text-red-500">*</span>
                      </label>
                      {booking.doctorId && availableSlots.length > 0 ? (
                        <select
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                          onChange={(e) => setNewTime(e.target.value)}
                          required
                          value={newTime}
                        >
                          <option value="">Select time</option>
                          {availableSlots.map((slot) => (
                            <option key={slot} value={slot}>
                              {formatTime(slot)}
                            </option>
                          ))}
                        </select>
                      ) : booking.doctorId && newDate && isRescheduleDateInPast ? (
                        <div className="border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                          Selected date is already in the past.
                        </div>
                      ) : booking.doctorId && newDate && availableSlots.length === 0 ? (
                        <div className="border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                          No available slots on{" "}
                          {DAY_NAMES[selectedDayOfWeek] ?? "this day"}.
                        </div>
                      ) : (
                        <input
                          className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                          min={isRescheduleForToday ? currentTimeInputValue : undefined}
                          onChange={(e) => setNewTime(e.target.value)}
                          required
                          type="time"
                          value={newTime}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Intake notes */}
              {booking.intakeNotes && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">Intake Notes</p>
                  <p className="bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {booking.intakeNotes}
                  </p>
                </div>
              )}

              {error && (
                <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
            <button
              className="border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 bg-orange-600 px-4 py-2 text-sm font-extrabold uppercase tracking-widest text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                updateMutation.isPending ||
                selectedRescheduleTimeIsBlocked ||
                selectedRescheduleTimeIsPast ||
                isRescheduleDateInPast
              }
              type="submit"
            >
              {updateMutation.isPending && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vitals modal
// ---------------------------------------------------------------------------

function VitalsModal({
  booking,
  onClose,
}: {
  booking: PatientBookingRow;
  onClose: () => void;
}) {
  const { data: patient } = usePatientDetail(booking.patientId);
  const [fields, setFields] = useState({
    temperature: "",
    bloodPressure: "",
    heartRate: "",
    o2Sat: "",
    respiratoryRate: "",
    weight: "",
    height: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (patient) {
      setFields({
        temperature: patient.temperature || "",
        bloodPressure: patient.bloodPressure || "",
        heartRate: patient.heartRate || "",
        o2Sat: patient.o2Sat || "",
        respiratoryRate: patient.respiratoryRate || "",
        weight: patient.weight || "",
        height: patient.height || "",
      });
    }
  }, [patient]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!patient) throw new Error("Patient not loaded");
      const hasAny = Object.values(fields).some((v) => v.trim());
      if (!hasAny) throw new Error("At least one vital must be recorded");
      return updatePatientLiveOrDemo(booking.patientId, {
        ...patient,
        temperature: fields.temperature || undefined,
        bloodPressure: fields.bloodPressure || undefined,
        heartRate: fields.heartRate || undefined,
        o2Sat: fields.o2Sat || undefined,
        respiratoryRate: fields.respiratoryRate || undefined,
        weight: fields.weight || undefined,
        height: fields.height || undefined,
        vitalsRecordedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success("Vitals saved successfully.");
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const vitalsFields = [
    { key: "temperature", label: "Temperature (°C)", placeholder: "e.g., 37.5", type: "number", step: "0.1" },
    { key: "bloodPressure", label: "Blood Pressure (mmHg)", placeholder: "e.g., 120/80", type: "text" },
    { key: "heartRate", label: "Heart Rate (bpm)", placeholder: "e.g., 72", type: "number" },
    { key: "o2Sat", label: "O2 Saturation (%)", placeholder: "e.g., 98", type: "number" },
    { key: "respiratoryRate", label: "Respiratory Rate (breaths/min)", placeholder: "e.g., 16", type: "number" },
    { key: "weight", label: "Weight (kg)", placeholder: "e.g., 70.5", type: "number", step: "0.1" },
    { key: "height", label: "Height (cm)", placeholder: "e.g., 170", type: "number" },
  ] as const;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 bg-red-600 px-5 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-red-100">
              Online Booking
            </p>
            <p className="mt-0.5 text-sm font-bold text-white">
              Record Vitals — {booking.patientFullName}
            </p>
          </div>
          <button
            aria-label="Close vitals modal"
            className="inline-flex shrink-0 items-center justify-center border border-red-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {vitalsFields.map(({ key, label, placeholder, type, ...rest }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {label}
                </label>
                <input
                  className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                  onChange={(e) =>
                    setFields((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={placeholder}
                  type={type}
                  value={fields[key]}
                  {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
                />
              </div>
            ))}
          </div>
          {error && (
            <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            className="border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-extrabold uppercase tracking-widest text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            type="button"
          >
            {mutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {mutation.isPending ? "Saving…" : "Save Vitals"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Booking table row
// ---------------------------------------------------------------------------

function BookingRow({
  booking,
  onEdit,
  onDelete,
  onRecordVitals,
}: {
  booking: PatientBookingRow;
  onEdit: () => void;
  onDelete: () => void;
  onRecordVitals: () => void;
}) {
  return (
    <tr className="group transition-colors hover:bg-slate-50">
      <td className="px-4 py-3 align-top">
        <p className="font-bold text-slate-950">{booking.patientFullName}</p>
        {booking.intakeNotes && (
          <p
            className="mt-0.5 max-w-[160px] truncate text-xs text-slate-400"
            title={booking.intakeNotes}
          >
            {booking.intakeNotes}
          </p>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-sm font-medium text-slate-700">
          {booking.doctorFullName ?? booking.serviceName}
        </p>
        <p className="text-xs text-slate-400">{feeTypeLabel(booking.feeType)}</p>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-slate-600">
        <p>{formatDate(booking.preferredDate)}</p>
        <p className="text-xs text-slate-400">{formatTime(booking.preferredTime)}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <StatusBadge status={booking.status} />
        {booking.cancelledReason && (
          <p
            className="mt-0.5 max-w-[120px] truncate text-xs text-slate-400"
            title={booking.cancelledReason}
          >
            {booking.cancelledReason}
          </p>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <PaymentBadge status={booking.paymentStatus} />
      </td>
      <td className="px-4 py-3 align-top text-right">
        <div className="flex justify-end gap-1.5">
          <button
            aria-label={`Record vitals for ${booking.patientFullName}`}
            className="border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-red-700 transition hover:bg-red-100"
            onClick={onRecordVitals}
            type="button"
          >
            Vitals
          </button>
          <button
            aria-label={`Edit booking for ${booking.patientFullName}`}
            className="border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-700 transition hover:bg-slate-50"
            onClick={onEdit}
            type="button"
          >
            Edit
          </button>
          <button
            aria-label={`Delete booking for ${booking.patientFullName}`}
            className="border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-red-600 transition hover:bg-red-100"
            onClick={onDelete}
            type="button"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main drawer component
// ---------------------------------------------------------------------------

export interface BookingListModalProps {
  open: boolean;
  onClose: () => void;
}

export function BookingListModal({ open, onClose }: BookingListModalProps) {
  const { data: bookings = [], isLoading, error } = usePatientBookings();
  const deleteMutation = useDeleteBooking();

  const [editingBooking, setEditingBooking] = useState<PatientBookingRow | null>(null);
  const [deletingBooking, setDeletingBooking] = useState<PatientBookingRow | null>(null);
  const [vitalsBooking, setVitalsBooking] = useState<PatientBookingRow | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingBooking && !deletingBooking && !vitalsBooking) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, editingBooking, deletingBooking, vitalsBooking]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const isCompletedAndPaid = b.status === "completed" && b.paymentStatus === "paid";
      if (isCompletedAndPaid) return false;
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

  const summary = useMemo(
    () => ({
      pending: bookings.filter((b) => b.status === "pending").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      rescheduled: bookings.filter((b) => b.status === "rescheduled").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    }),
    [bookings],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedBookings = useMemo(
    () => filtered.slice(pageStart, pageStart + PAGE_SIZE),
    [filtered, pageStart],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingBooking) return;
    await deleteMutation.mutateAsync(deletingBooking.id);
    setDeletingBooking(null);
  }, [deletingBooking, deleteMutation]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-modal="true"
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4"
        onClick={onClose}
        role="dialog"
      >
        <div
          className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — matches patient details modal */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-orange-700 bg-orange-600 px-6 py-5 text-white">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">
                Front Desk — Online Bookings
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-white">
                Patient Booking List
              </h2>
              <p className="mt-1 text-sm text-orange-100">
                Review schedules, update booking status, record vitals, and keep intake timing on track.
              </p>
            </div>
            <button
              aria-label="Close booking list modal"
              className="inline-flex items-center justify-center border border-orange-400/50 bg-white/10 p-2 transition hover:bg-white/20"
              onClick={onClose}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Summary + filters toolbar */}
          <div className="shrink-0 border-b border-slate-100 bg-slate-50">
            {/* Summary badges */}
            <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500">
                {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
                {summary.pending} pending
              </span>
              <span className="inline-flex items-center border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">
                {summary.confirmed} confirmed
              </span>
              <span className="inline-flex items-center border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-sky-600">
                {summary.rescheduled} rescheduled
              </span>
              <span className="inline-flex items-center border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-red-600">
                {summary.cancelled} cancelled
              </span>
            </div>

            {/* Search + filter */}
            <div className="flex flex-wrap items-center gap-3 px-6 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 border border-slate-200 bg-white px-3 py-2">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search patient, doctor, receipt…"
                  type="text"
                  value={search}
                />
                {search && (
                  <button
                    aria-label="Clear search"
                    className="shrink-0 text-slate-400 hover:text-slate-700"
                    onClick={() => setSearch("")}
                    type="button"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <select
                className="border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                onChange={(e) => setStatusFilter(e.target.value)}
                value={statusFilter}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {(search || statusFilter !== "all") && (
                <button
                  className="border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 transition hover:bg-slate-50"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                  type="button"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Scrollable table body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {error ? (
              <div className="px-6 py-10 text-center text-sm text-red-500">
                Failed to load bookings:{" "}
                {error instanceof Error ? error.message : "Unknown error"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      {(["Patient", "Doctor / Service", "Schedule", "Status", "Payment", ""] as const).map(
                        (col) => (
                          <th
                            key={col}
                            className={`whitespace-nowrap px-4 py-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 ${
                              col === "" ? "text-right" : "text-left"
                            }`}
                          >
                            {col}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          {Array.from({ length: 6 }).map((__, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 rounded bg-slate-100" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td className="px-6 py-16 text-center" colSpan={6}>
                          <CalendarCheck2 className="mx-auto size-10 text-slate-200" />
                          <p className="mt-3 text-sm font-semibold text-slate-500">
                            No bookings found
                          </p>
                          {(search || statusFilter !== "all") && (
                            <p className="mt-1 text-xs text-slate-400">
                              Try adjusting your search or filter.
                            </p>
                          )}
                        </td>
                      </tr>
                    ) : (
                      paginatedBookings.map((booking) => (
                        <BookingRow
                          key={booking.id}
                          booking={booking}
                          onDelete={() => setDeletingBooking(booking)}
                          onEdit={() => setEditingBooking(booking)}
                          onRecordVitals={() => setVitalsBooking(booking)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination footer — always visible */}
          {!isLoading && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
              <p className="text-xs font-semibold text-slate-500">
                Showing{" "}
                {Math.min(pageStart + 1, filtered.length)}–
                {Math.min(pageStart + PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="border border-slate-200 px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  Previous
                </button>
                <span className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest text-slate-600">
                  {safePage} / {totalPages}
                </span>
                <button
                  className="border border-slate-200 px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-modals rendered above */}
      {editingBooking && (
        <EditModal booking={editingBooking} onClose={() => setEditingBooking(null)} />
      )}
      {deletingBooking && (
        <DeleteDialog
          booking={deletingBooking}
          isLoading={deleteMutation.isPending}
          onCancel={() => setDeletingBooking(null)}
          onConfirm={() => void handleDeleteConfirm()}
        />
      )}
      {vitalsBooking && (
        <VitalsModal booking={vitalsBooking} onClose={() => setVitalsBooking(null)} />
      )}
    </>
  );
}
