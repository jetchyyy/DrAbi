import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Circle,
  CircleDot,
  CircleOff,
  Clock,
  FileText,
  MinusCircle,
  PlayCircle,
  Send,
  UserX,
  XCircle,
  Zap,
} from 'lucide-react';

import { cn } from '../../lib/utils';

export type StatusValue =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'paid'
  | 'partial'
  | 'unpaid'
  | 'pending'
  | 'overdue'
  | 'draft'
  | 'active'
  | 'inactive'
  | 'denied'
  | 'approved'
  | 'submitted'
  | 'processing'
  | 'expired'
  | 'voided'
  | string;

const STATUS_MAP: Record<string, { icon: React.ElementType; label: string }> = {
  scheduled:   { icon: Clock,        label: 'Scheduled' },
  confirmed:   { icon: CheckCircle2, label: 'Confirmed' },
  in_progress: { icon: Zap,          label: 'In Progress' },
  completed:   { icon: CheckCircle2, label: 'Completed' },
  cancelled:   { icon: XCircle,      label: 'Cancelled' },
  no_show:     { icon: UserX,        label: 'No Show' },
  paid:        { icon: CheckCircle2, label: 'Paid' },
  partial:     { icon: CircleDot,    label: 'Partial' },
  unpaid:      { icon: Clock,        label: 'Unpaid' },
  pending:     { icon: Clock,        label: 'Pending' },
  overdue:     { icon: AlertCircle,  label: 'Overdue' },
  draft:       { icon: FileText,     label: 'Draft' },
  active:      { icon: Circle,       label: 'Active' },
  inactive:    { icon: CircleOff,    label: 'Inactive' },
  denied:      { icon: Ban,          label: 'Denied' },
  approved:    { icon: CheckCircle2, label: 'Approved' },
  submitted:   { icon: Send,         label: 'Submitted' },
  processing:  { icon: PlayCircle,   label: 'Processing' },
  expired:     { icon: MinusCircle,  label: 'Expired' },
  voided:      { icon: XCircle,      label: 'Voided' },
};

interface StatusPillProps {
  status: StatusValue;
  /** Override display label */
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function StatusPill({ status, label, className, size = 'md' }: StatusPillProps) {
  const normalized = status?.toLowerCase().replace(/\s+/g, '_') ?? '';
  const config = STATUS_MAP[normalized] ?? { icon: Circle, label: status ?? '—' };
  const Icon = config.icon;
  const displayLabel = label ?? config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-slate-100 font-semibold text-slate-600 ring-1 ring-slate-200/80',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        className,
      )}
    >
      <Icon
        className={cn('shrink-0', size === 'sm' ? 'size-2.5' : 'size-3')}
        strokeWidth={2.2}
      />
      {displayLabel}
    </span>
  );
}
