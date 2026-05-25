import { StatusPill } from '../../components/ui/status-pill';

function PaymentBadge({ status }: { status: string }) {
  return <StatusPill status={status} />;
}

export { PaymentBadge };
