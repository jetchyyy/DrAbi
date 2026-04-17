export type LabRequestDisplayStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

export function toLabRequestDisplayStatus(status: string, hasSchedule = false): LabRequestDisplayStatus {
  const normalized = status.trim().toLowerCase();

  if (normalized === 'completed' || normalized === 'released') {
    return 'Completed';
  }

  if (normalized === 'cancelled') {
    return 'Cancelled';
  }

  if (normalized === 'confirmed' || normalized === 'ready' || normalized === 'in_progress') {
    return 'Confirmed';
  }

  if (normalized === 'pending' && hasSchedule) {
    return 'Confirmed';
  }

  return 'Pending';
}

export function toLabRequestLiveStatus(status: LabRequestDisplayStatus): 'pending' | 'in_progress' | 'completed' | 'cancelled' {
  if (status === 'Completed') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  if (status === 'Confirmed') return 'in_progress';
  return 'pending';
}