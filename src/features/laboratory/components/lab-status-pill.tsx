import { StatusPill } from '../../../components/ui/status-pill';

export function LabStatusPill({ status }: { status: string }) {
  const normalized = status.trim().toLowerCase();

  const mapped =
    normalized === 'released' || normalized === 'completed' ? 'completed' :
    normalized === 'ready' || normalized === 'confirmed' ? 'confirmed' :
    normalized === 'in_progress' ? 'in_progress' :
    normalized === 'processing' ? 'processing' :
    normalized === 'cancelled' ? 'cancelled' :
    'pending';

  return <StatusPill status={mapped} />;
}
