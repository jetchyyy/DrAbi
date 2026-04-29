import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  AlertCircle,
  Loader2,
  CalendarCheck2,
  Search,
} from "lucide-react";
import { cn, formatTimeLabel } from "../../lib/utils";
import type { ReferralStatus } from "../../types/domain";
import {
  useReferralsList,
  REFERRAL_STATUS_OPTIONS,
  useSpecialistAvailabilityForReferral,
  useBlockedReferralSlots,
  type ReferralListItem,
  type EditReferralInput,
} from "./hooks/use-referral-list";

const PAGE_SIZE = 7;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function normalizeTime(raw: string): string {
  return raw.length > 5 ? raw.slice(0, 5) : raw;
}

function getTodayPH(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function getNowTimePH(): string {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: {
      label: "Draft",
      className: "bg-gray-100 text-gray-600 border-gray-200",
    },
    sent: {
      label: "Sent",
      className: "bg-orange-50 text-orange-700 border-orange-200",
    },
    pending: {
      label: "Pending",
      className: "bg-sky-50 text-sky-600 border-sky-200",
    },
    scheduled: {
      label: "Scheduled",
      className: "bg-indigo-50 text-indigo-600 border-indigo-200",
    },
    accepted: {
      label: "Accepted",
      className: "bg-cyan-50 text-cyan-700 border-cyan-200",
    },
    confirmed: {
      label: "Confirmed",
      className: "bg-orange-50 text-orange-700 border-orange-200",
    },
    completed: {
      label: "Completed",
      className: "bg-indigo-50 text-indigo-600 border-indigo-200",
    },
    declined: {
      label: "Declined",
      className: "bg-red-50 text-red-500 border-red-200",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-red-50 text-red-500 border-red-200",
    },
    rescheduled: {
      label: "Rescheduled",
      className: "bg-sky-50 text-sky-600 border-sky-200",
    },
  };

  const entry = map[status] ?? map.scheduled;
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest",
        entry.className,
      )}
    >
      {entry.label}
    </span>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditReferralModal({
  referral,
  onClose,
  onSave,
  isSaving,
}: {
  referral: ReferralListItem;
  onClose: () => void;
  onSave: (id: string, input: EditReferralInput) => Promise<void>;
  isSaving: boolean;
}) {
  const [status, setStatus] = useState<ReferralStatus>(referral.status);
  const [cancelledReason, setCancelledReason] = useState(
    referral.cancelledReason ?? "",
  );
  const [rescheduledReason, setRescheduledReason] = useState(
    referral.rescheduledReason ?? "",
  );
  const [appointmentDate, setAppointmentDate] = useState(
    referral.appointmentDate ?? "",
  );
  const [appointmentTime, setAppointmentTime] = useState(
    referral.appointmentTime ?? "",
  );
  const [reason, setReason] = useState(referral.reason);
  const [clinicalSummary, setClinicalSummary] = useState(
    referral.clinicalSummary,
  );
  const [referralNotes, setReferralNotes] = useState(referral.referralNotes);
  const todayPH = getTodayPH();
  const nowTimePH = normalizeTime(getNowTimePH());

  // Availability data for reschedule
  const { data: availability = [] } = useSpecialistAvailabilityForReferral(
    status === "rescheduled" ? referral.assignedSpecialistId : null,
  );
  const { data: blockedSlots = [] } = useBlockedReferralSlots(
    status === "rescheduled" ? appointmentDate : null,
    referral.assignedSpecialistId,
  );

  // Compute available time slots from specialist availability for the selected date
  const selectedDayOfWeek = useMemo(() => {
    if (!appointmentDate) return -1;
    return new Date(appointmentDate + "T00:00:00").getDay();
  }, [appointmentDate]);

  const availableSlots = useMemo(() => {
    if (status !== "rescheduled" || selectedDayOfWeek < 0) return [];
    if (appointmentDate && appointmentDate < todayPH) return [];

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

    const blockedSlotsSet = new Set(
      blockedSlots.map((slot) => normalizeTime(slot)),
    );

    return slots.filter((slot) => {
      if (blockedSlotsSet.has(slot)) {
        return false;
      }

      const isPastToday =
        appointmentDate === todayPH && toMinutes(slot) <= toMinutes(nowTimePH);
      return !isPastToday;
    });
  }, [
    availability,
    selectedDayOfWeek,
    blockedSlots,
    status,
    appointmentDate,
    todayPH,
    nowTimePH,
  ]);

  useEffect(() => {
    if (!appointmentDate) return;
    if (appointmentDate < todayPH) {
      setAppointmentDate("");
      setAppointmentTime("");
    }
  }, [appointmentDate, todayPH]);

  useEffect(() => {
    if (appointmentTime && !availableSlots.includes(appointmentTime)) {
      setAppointmentTime("");
    }
  }, [appointmentTime, availableSlots]);

  const showCancelReason = status === "cancelled";
  const showRescheduleReason = status === "rescheduled";
  const canSave =
    (status !== "cancelled" || cancelledReason.trim().length > 0) &&
    (status !== "rescheduled" ||
      (rescheduledReason.trim().length > 0 &&
        appointmentDate.trim().length > 0 &&
        appointmentTime.trim().length > 0));

  async function handleSave() {
    if (!canSave) return;
    await onSave(referral.id, {
      status,
      cancelledReason: showCancelReason ? cancelledReason.trim() || null : null,
      rescheduledReason: showRescheduleReason
        ? rescheduledReason.trim() || null
        : null,
      appointmentDate:
        status === "rescheduled" ? appointmentDate.trim() || null : null,
      appointmentTime:
        status === "rescheduled" ? appointmentTime.trim() || null : null,
      reason,
      clinicalSummary,
      referralNotes,
    });
    onClose();
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
            Edit Referral
          </h2>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Info summary */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Patient</p>
              <p className="text-sm font-medium text-gray-800">
                {referral.patientFullName}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Specialist: {referral.assignedSpecialistName ?? "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Current Status</p>
              <ReferralStatusBadge status={referral.status} />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Update Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ReferralStatus)}
              className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              {REFERRAL_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Cancellation reason — only when status is cancelled */}
          {showCancelReason && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelledReason}
                onChange={(e) => setCancelledReason(e.target.value)}
                rows={3}
                placeholder="Enter reason for cancellation..."
                className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 resize-none"
              />
            </div>
          )}

          {/* Reschedule reason — only when status is rescheduled */}
          {showRescheduleReason && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Reschedule Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rescheduledReason}
                onChange={(e) => setRescheduledReason(e.target.value)}
                rows={3}
                placeholder="Enter reason for rescheduling..."
                className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 resize-none"
              />
            </div>
          )}

          {/* Schedule section — only when rescheduling */}
          {showRescheduleReason && (
            <>
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  New Appointment Schedule
                </h3>

                {/* Appointment Date */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    min={todayPH}
                    className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                {/* Appointment Time - now a select dropdown of available slots */}
                {appointmentDate && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Appointment Time
                    </label>
                    {availableSlots.length > 0 ? (
                      <select
                        value={appointmentTime}
                        onChange={(e) => setAppointmentTime(e.target.value)}
                        className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="">Select a time slot</option>
                        {availableSlots.map((slot) => (
                          <option key={slot} value={slot}>
                            {formatTimeLabel(`1970-01-01T${slot}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-500">
                        {selectedDayOfWeek >= 0
                          ? "No available slots for this date (booked or past times are blocked)"
                          : "Select a date first"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Reason for Referral
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 resize-none"
            />
          </div>

          {/* Clinical summary */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Clinical Summary
            </label>
            <textarea
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.target.value)}
              rows={2}
              className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 resize-none"
            />
          </div>

          {/* Referral notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Referral Notes
            </label>
            <textarea
              value={referralNotes}
              onChange={(e) => setReferralNotes(e.target.value)}
              rows={2}
              className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className="inline-flex items-center gap-2 bg-orange-600 px-4 py-2 text-sm font-extrabold uppercase tracking-widest text-white hover:bg-orange-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  referral,
  onClose,
  onConfirm,
  isDeleting,
}: {
  referral: ReferralListItem;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm border border-slate-200 bg-white shadow-2xl mx-4 p-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Delete Referral
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Are you sure you want to delete the referral for{" "}
              <span className="font-medium text-gray-700">
                {referral.patientFullName}
              </span>
              ? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ReferralsListPage() {
  const {
    referrals,
    isLoading,
    isError,
    handleUpdateReferral,
    handleDeleteReferral,
    isUpdating,
    isDeleting,
  } = useReferralsList();

  const [editingReferral, setEditingReferral] =
    useState<ReferralListItem | null>(null);
  const [deletingReferral, setDeletingReferral] =
    useState<ReferralListItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReferralStatus>(
    "all",
  );

  const filteredReferrals = useMemo(() => {
    const q = search.trim().toLowerCase();

    return referrals.filter((referral) => {
      const matchesStatus =
        statusFilter === "all" || referral.status === statusFilter;

      const matchesSearch =
        !q ||
        referral.patientFullName.toLowerCase().includes(q) ||
        (referral.assignedSpecialistName ?? "").toLowerCase().includes(q) ||
        (referral.reason ?? "").toLowerCase().includes(q) ||
        (referral.cancelledReason ?? "").toLowerCase().includes(q) ||
        (referral.rescheduledReason ?? "").toLowerCase().includes(q) ||
        (referral.appointmentDate ?? "").toLowerCase().includes(q) ||
        (referral.appointmentTime ?? "").toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [referrals, search, statusFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredReferrals.length / PAGE_SIZE)),
    [filteredReferrals.length],
  );

  const paginatedReferrals = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredReferrals.slice(start, start + PAGE_SIZE);
  }, [filteredReferrals, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  async function confirmDelete() {
    if (!deletingReferral) return;
    await handleDeleteReferral(deletingReferral.id);
    setDeletingReferral(null);
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <AlertCircle className="h-6 w-6 text-red-400" />
        <p className="text-sm text-gray-500">
          Failed to load referrals. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
                Referrals
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage and track all patient referrals.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | ReferralStatus)
              }
              className="border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="all">All Statuses</option>
              {REFERRAL_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
          <span className="text-xs font-bold text-slate-500">
            {filteredReferrals.length} referral
            {filteredReferrals.length !== 1 ? "s" : ""} found
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Patient",
                  "Specialist",
                  "Referral Status",
                  "Cancelled Reason",
                  "Reschedule Reason",
                  "Actions",
                ].map((col) => (
                  <th
                    key={col}
                    className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredReferrals.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-sm text-gray-400"
                  >
                    No referrals found.
                  </td>
                </tr>
              ) : (
                paginatedReferrals.map((referral) => (
                  <tr
                    key={referral.id}
                    className="group hover:bg-slate-50 transition-colors"
                  >
                    {/* Patient */}
                    <td className="px-6 py-4 align-top">
                      <p className="font-bold text-slate-950">
                        {referral.patientFullName}
                      </p>
                      {referral.reason && (
                        <p className="mt-0.5 text-xs text-slate-400 line-clamp-1 max-w-[180px]">
                          {referral.reason}
                        </p>
                      )}
                    </td>

                    {/* Schedule */}
                    <td className="px-6 py-4 align-top">
                      {referral.assignedSpecialistName ? (
                        <p className="font-medium text-slate-700">
                          Dr. {referral.assignedSpecialistName}
                        </p>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Schedule */}
                    <td className="px-6 py-4 align-top">
                      {referral.appointmentDate || referral.appointmentTime ? (
                        <div>
                          {referral.appointmentDate && (
                            <p className="text-slate-700">
                              {referral.appointmentDate}
                            </p>
                          )}
                          {referral.appointmentTime && (
                            <p className="text-xs text-slate-400">
                              {formatTimeLabel(
                                `1970-01-01T${referral.appointmentTime}`,
                              )}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Status — read-only badge */}
                    <td className="px-6 py-4 align-top">
                      <ReferralStatusBadge status={referral.status} />
                    </td>

                    {/* Cancelled reason */}
                    <td className="px-6 py-4 align-top max-w-[160px]">
                      {referral.cancelledReason ? (
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {referral.cancelledReason}
                        </p>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Reschedule reason */}
                    <td className="px-6 py-4 align-top max-w-[160px]">
                      {referral.rescheduledReason ? (
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {referral.rescheduledReason}
                        </p>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 align-top">
                      <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          onClick={() => setEditingReferral(referral)}
                          className="inline-flex items-center gap-1 text-slate-600 hover:underline"
                          title="Edit referral"
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingReferral(referral)}
                          className="inline-flex items-center gap-1 text-rose-600 hover:underline"
                          title="Delete referral"
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredReferrals.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Showing{" "}
            {Math.min(
              (currentPage - 1) * PAGE_SIZE + 1,
              filteredReferrals.length,
            )}
            -{Math.min(currentPage * PAGE_SIZE, filteredReferrals.length)} of{" "}
            {filteredReferrals.length}
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
      {editingReferral && (
        <EditReferralModal
          referral={editingReferral}
          onClose={() => setEditingReferral(null)}
          onSave={handleUpdateReferral}
          isSaving={isUpdating}
        />
      )}

      {/* Delete confirm modal */}
      {deletingReferral && (
        <DeleteConfirmModal
          referral={deletingReferral}
          onClose={() => setDeletingReferral(null)}
          onConfirm={confirmDelete}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
