import { useState } from "react";
import { Pencil, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ReferralStatus } from "../../types/domain";
import {
  useReferralsList,
  REFERRAL_STATUS_OPTIONS,
  type ReferralListItem,
  type EditReferralInput,
} from "./hooks/use-referral-list";

// ─── Status badge ─────────────────────────────────────────────────────────────

function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: {
      label: "Draft",
      className: "bg-gray-100 text-gray-600 border-gray-200",
    },
    sent: {
      label: "Sent",
      className: "bg-blue-50 text-blue-600 border-blue-200",
    },
    pending: {
      label: "Pending",
      className: "bg-yellow-50 text-yellow-600 border-yellow-200",
    },
    scheduled: {
      label: "Scheduled",
      className: "bg-sky-50 text-sky-600 border-sky-200",
    },
    accepted: {
      label: "Accepted",
      className: "bg-teal-50 text-teal-600 border-teal-200",
    },
    confirmed: {
      label: "Confirmed",
      className: "bg-green-50 text-green-600 border-green-200",
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
      className: "bg-orange-50 text-orange-500 border-orange-200",
    },
  };

  const entry = map[status] ?? map.scheduled;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium",
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

  const showCancelReason = status === "cancelled";
  const showRescheduleReason = status === "rescheduled";
  const canSave =
    (status !== "cancelled" || cancelledReason.trim().length > 0) &&
    (status !== "rescheduled" || rescheduledReason.trim().length > 0);

  async function handleSave() {
    if (!canSave) return;
    await onSave(referral.id, {
      status,
      cancelledReason: showCancelReason ? cancelledReason.trim() || null : null,
      rescheduledReason: showRescheduleReason
        ? rescheduledReason.trim() || null
        : null,
      appointmentDate: appointmentDate.trim() || null,
      appointmentTime: appointmentTime.trim() || null,
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
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Edit Referral
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
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
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Patient</p>
              <p className="text-sm font-medium text-gray-800">
                {referral.patientFullName}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Current Status</p>
              <ReferralStatusBadge status={referral.status} />
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Appointment Date
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Appointment Time
              </label>
              <input
                type="time"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
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
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl mx-4 p-6">
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
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-60"
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Referrals</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Manage and track all patient referrals
        </p>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {[
                  "Patient",
                  "Schedule",
                  "Referral Status",
                  "Cancelled Reason",
                  "Reschedule Reason",
                  "Actions",
                ].map((col) => (
                  <th
                    key={col}
                    className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {referrals.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-16 text-center text-sm text-gray-400"
                  >
                    No referrals found.
                  </td>
                </tr>
              ) : (
                referrals.map((referral) => (
                  <tr
                    key={referral.id}
                    className="group hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Patient */}
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-800">
                        {referral.patientFullName}
                      </p>
                      {referral.reason && (
                        <p className="mt-0.5 text-xs text-gray-400 line-clamp-1 max-w-[180px]">
                          {referral.reason}
                        </p>
                      )}
                    </td>

                    {/* Schedule */}
                    <td className="px-5 py-4">
                      {referral.appointmentDate || referral.appointmentTime ? (
                        <div>
                          {referral.appointmentDate && (
                            <p className="text-gray-700">
                              {referral.appointmentDate}
                            </p>
                          )}
                          {referral.appointmentTime && (
                            <p className="text-xs text-gray-400">
                              {referral.appointmentTime}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Status — read-only badge */}
                    <td className="px-5 py-4">
                      <ReferralStatusBadge status={referral.status} />
                    </td>

                    {/* Cancelled reason */}
                    <td className="px-5 py-4 max-w-[160px]">
                      {referral.cancelledReason ? (
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {referral.cancelledReason}
                        </p>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Reschedule reason */}
                    <td className="px-5 py-4 max-w-[160px]">
                      {referral.rescheduledReason ? (
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {referral.rescheduledReason}
                        </p>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingReferral(referral)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"
                          title="Edit referral"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingReferral(referral)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="Delete referral"
                        >
                          <Trash2 className="h-4 w-4" />
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
