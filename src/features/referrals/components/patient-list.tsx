import { User } from "lucide-react";
import { cn, formatCurrency, formatDateLabel } from "../../../lib/utils";
import type { PatientBookingItem } from "../hooks/use-referral";

interface PatientListProps {
  patients: PatientBookingItem[];
  selectedBookingId: string | null;
  onSelect: (patient: PatientBookingItem) => void;
  isLoading?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  rescheduled: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

export function PatientList({
  patients,
  selectedBookingId,
  onSelect,
  isLoading,
}: PatientListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <User className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">No active bookings found</p>
        <p className="mt-1 text-xs">
          Patients with active bookings will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {patients.map((patient) => {
        const isSelected = selectedBookingId === patient.bookingId;
        const statusLabel = STATUS_LABELS[patient.status] ?? patient.status;
        const statusColor =
          STATUS_COLORS[patient.status] ?? "bg-gray-100 text-gray-800";

        return (
          <button
            key={patient.bookingId}
            type="button"
            onClick={() => onSelect(patient)}
            className={cn(
              "flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent",
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card",
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase text-muted-foreground">
              {patient.patientFirstName[0]}
              {patient.patientLastName[0]}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">
                  {patient.patientFullName}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    statusColor,
                  )}
                >
                  {statusLabel}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {patient.serviceName}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateLabel(patient.preferredDate)} ·{" "}
                {patient.preferredTime}
              </p>
            </div>

            <div className="shrink-0 text-right">
              {patient.referralId && (
                <p className="mt-0.5 text-xs text-primary">Has referral</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
