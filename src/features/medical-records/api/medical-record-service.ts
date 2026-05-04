import { queryKeys } from '../../../lib/query-keys';
import { labRequestService } from '../../lab-requests/api/lab-request-service';
import type { PatientMedicalTimelineEntry } from '../../lab-requests/types';

export const medicalRecordService = {
  async getPatientMedicalTimeline(patientId: string): Promise<PatientMedicalTimelineEntry[]> {
    const labRequests = await labRequestService.getPatientLabResults(patientId, {
      resultStatus: 'completed',
    });

    return labRequests.map((request) => ({
      kind: 'lab_request' as const,
      request,
      occurredAt: request.completedAt ?? request.createdAt,
    }));
  },

  queryKey(patientId: string | null) {
    return queryKeys.patientMedicalTimeline(patientId);
  },
};