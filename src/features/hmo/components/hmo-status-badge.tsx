/**
 * Reusable status badge for HMO claim and authorization statuses.
 */
import { cn } from "../../../lib/utils";

const approvalStatusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  denied: "bg-rose-50 text-rose-700 ring-rose-200",
  expired: "bg-slate-100 text-slate-600 ring-slate-200",
};

const claimStatusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  pending_submission: "bg-amber-50 text-amber-700 ring-amber-200",
  submitted: "bg-sky-50 text-sky-700 ring-sky-200",
  processing: "bg-violet-50 text-violet-700 ring-violet-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  denied: "bg-rose-50 text-rose-700 ring-rose-200",
  partial_payment: "bg-orange-50 text-orange-700 ring-orange-200",
  overdue: "bg-red-50 text-red-800 ring-red-300",
};

const claimStatusLabels: Record<string, string> = {
  draft: "Draft",
  pending_submission: "Pending Submission",
  submitted: "Submitted",
  processing: "Processing",
  paid: "Paid",
  denied: "Denied",
  partial_payment: "Partial Payment",
  overdue: "Overdue",
};

interface HmoStatusBadgeProps {
  status: string;
  type?: "approval" | "claim";
  className?: string;
}

export function HmoStatusBadge({
  status,
  type = "claim",
  className,
}: HmoStatusBadgeProps) {
  const styles =
    type === "approval" ? approvalStatusStyles : claimStatusStyles;
  const labels = type === "approval" ? undefined : claimStatusLabels;

  const style = styles[status] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  const label =
    labels?.[status] ??
    status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1",
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}
