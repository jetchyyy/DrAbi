/**
 * Reusable status badge for HMO claim and authorization statuses.
 */
import { cn } from "../../../lib/utils";

const approvalStatusStyles: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600 ring-slate-200",
  approved: "bg-slate-100 text-slate-600 ring-slate-200",
  denied: "bg-red-50 text-red-700 ring-red-200",
  expired: "bg-slate-100 text-slate-600 ring-slate-200",
};

const claimStatusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  pending_submission: "bg-slate-100 text-slate-600 ring-slate-200",
  submitted: "bg-slate-100 text-slate-600 ring-slate-200",
  processing: "bg-slate-100 text-slate-600 ring-slate-200",
  paid: "bg-slate-100 text-slate-600 ring-slate-200",
  denied: "bg-red-50 text-red-700 ring-red-200",
  partial_payment: "bg-slate-100 text-slate-600 ring-slate-200",
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
