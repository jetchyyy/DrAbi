export type LabRequestStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type LabSampleStatus = 'pending' | 'collected' | 'processing' | 'analyzed' | 'cancelled';
export type LabResultStatus = 'pending' | 'partial' | 'completed' | 'cancelled';

export interface LabRequestFilters {
  status?: LabRequestStatus;
  sampleStatus?: LabSampleStatus;
  resultStatus?: LabResultStatus;
  urgentOnly?: boolean;
}

export interface CreateLabRequestInput {
  clinicId?: string | null;
  patientId: string;
  requestedBy: string;
  serviceId: string;
  serviceCategory: string;
  patientNotes?: string | null;
  urgentFlag?: boolean;
  transactionType?: string;
}

export interface CompleteLabRequestInput {
  requestId: string;
  resultData?: string | null;
  resultNotes?: string | null;
}

export interface CancelLabRequestInput {
  requestId: string;
  reason?: string | null;
}

export interface LabRequestRecord {
  id: string;
  clinicId: string;
  clinicName: string | null;
  patientId: string;
  patientName: string | null;
  requestedBy: string;
  requestedByName: string | null;
  serviceId: string;
  serviceName: string | null;
  serviceCategory: string;
  department: string;
  transactionType: string;
  status: LabRequestStatus | string;
  sampleStatus: LabSampleStatus | string;
  resultStatus: LabResultStatus | string;
  patientNotes: string | null;
  resultData: string | null;
  resultNotes: string | null;
  urgentFlag: boolean;
  completedBy: string | null;
  completedByName: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientMedicalTimelineEntry {
  kind: 'lab_request';
  request: LabRequestRecord;
  occurredAt: string;
}