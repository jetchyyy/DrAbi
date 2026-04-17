import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '../../../app/query-client';
import { queryKeys } from '../../../lib/query-keys';
import { labRequestService } from '../api/lab-request-service';
import type {
  CancelLabRequestInput,
  CompleteLabRequestInput,
  CreateLabRequestInput,
  LabRequestFilters,
  UpdateLabRequestInput,
} from '../types';

function getLabRequestQueryFilters(filters?: LabRequestFilters): Record<string, unknown> {
  return (filters ?? {}) as Record<string, unknown>;
}

export function useClinicLabQueue(clinicId: string | null, filters?: LabRequestFilters) {
  return useQuery({
    queryKey: queryKeys.labQueue(clinicId, getLabRequestQueryFilters(filters)),
    queryFn: async () => {
      if (!clinicId) {
        return [];
      }

      return labRequestService.listClinicQueue(clinicId, filters);
    },
    enabled: Boolean(clinicId),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}

export function useAppointmentLabRequests(appointmentId: string | null, filters?: LabRequestFilters) {
  return useQuery({
    queryKey: queryKeys.appointmentLabRequests(appointmentId, getLabRequestQueryFilters(filters)),
    queryFn: async () => {
      if (!appointmentId) {
        return [];
      }

      return labRequestService.getAppointmentLabRequests(appointmentId, filters);
    },
    enabled: Boolean(appointmentId),
  });
}

export function usePatientLabResults(patientId: string | null, filters?: LabRequestFilters) {
  return useQuery({
    queryKey: queryKeys.patientLabResults(patientId, getLabRequestQueryFilters(filters)),
    queryFn: async () => {
      if (!patientId) {
        return [];
      }

      return labRequestService.getPatientLabResults(patientId, filters);
    },
    enabled: Boolean(patientId),
  });
}

export function useDoctorLabRequests(doctorId: string | null, filters?: LabRequestFilters) {
  return useQuery({
    queryKey: queryKeys.doctorLabRequests(doctorId, getLabRequestQueryFilters(filters)),
    queryFn: async () => {
      if (!doctorId) {
        return [];
      }

      return labRequestService.getDoctorRequestedLabs(doctorId, filters);
    },
    enabled: Boolean(doctorId),
  });
}

export function useLabRequest(requestId: string | null) {
  return useQuery({
    queryKey: queryKeys.labRequest(requestId),
    queryFn: async () => {
      if (!requestId) {
        return null;
      }

      return labRequestService.getRequestById(requestId);
    },
    enabled: Boolean(requestId),
  });
}

export function useCreateLabRequest() {
  return useMutation({
    mutationFn: async (payload: CreateLabRequestInput) => labRequestService.createRequest(payload),
    onSuccess: (record) => {
      if (!record) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['lab-queue', record.clinicId] });
      void queryClient.invalidateQueries({ queryKey: ['patient-lab-results', record.patientId] });
      void queryClient.invalidateQueries({ queryKey: ['doctor-lab-requests', record.requestedBy] });
      void queryClient.invalidateQueries({ queryKey: ['appointment-lab-requests', record.appointmentId] });
      void queryClient.invalidateQueries({ queryKey: ['lab-request', record.id] });
      void queryClient.invalidateQueries({ queryKey: ['patient-medical-timeline', record.patientId] });
    },
  });
}

export function useStartLabProcessing() {
  return useMutation({
    mutationFn: async (requestId: string) => labRequestService.startProcessing(requestId),
    onSuccess: (record) => {
      if (!record) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['lab-queue', record.clinicId] });
      void queryClient.invalidateQueries({ queryKey: ['appointment-lab-requests', record.appointmentId] });
      void queryClient.invalidateQueries({ queryKey: ['lab-request', record.id] });
      void queryClient.invalidateQueries({ queryKey: ['patient-lab-results', record.patientId] });
      void queryClient.invalidateQueries({ queryKey: ['patient-medical-timeline', record.patientId] });
    },
  });
}

export function useCompleteLabRequest() {
  return useMutation({
    mutationFn: async (payload: CompleteLabRequestInput) => labRequestService.completeRequest(payload),
    onSuccess: (record) => {
      if (!record) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['lab-queue', record.clinicId] });
      void queryClient.invalidateQueries({ queryKey: ['appointment-lab-requests', record.appointmentId] });
      void queryClient.invalidateQueries({ queryKey: ['lab-request', record.id] });
      void queryClient.invalidateQueries({ queryKey: ['patient-lab-results', record.patientId] });
      void queryClient.invalidateQueries({ queryKey: ['patient-medical-timeline', record.patientId] });
    },
  });
}

export function useCancelLabRequest() {
  return useMutation({
    mutationFn: async (payload: CancelLabRequestInput) => labRequestService.cancelRequest(payload),
    onSuccess: (record) => {
      if (!record) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['lab-queue', record.clinicId] });
      void queryClient.invalidateQueries({ queryKey: ['appointment-lab-requests', record.appointmentId] });
      void queryClient.invalidateQueries({ queryKey: ['lab-request', record.id] });
      void queryClient.invalidateQueries({ queryKey: ['patient-lab-results', record.patientId] });
      void queryClient.invalidateQueries({ queryKey: ['patient-medical-timeline', record.patientId] });
    },
  });
}

export function useUpdateLabRequestDetails() {
  return useMutation({
    mutationFn: async (payload: UpdateLabRequestInput) => labRequestService.updateRequestDetails(payload),
    onSuccess: (record) => {
      if (!record) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['lab-queue', record.clinicId] });
      void queryClient.invalidateQueries({ queryKey: ['appointment-lab-requests', record.appointmentId] });
      void queryClient.invalidateQueries({ queryKey: ['lab-request', record.id] });
      void queryClient.invalidateQueries({ queryKey: ['patient-lab-results', record.patientId] });
      void queryClient.invalidateQueries({ queryKey: ['patient-medical-timeline', record.patientId] });
    },
  });
}

export function useConfirmLabRequestByFrontDesk() {
  return useMutation({
    mutationFn: async (requestId: string) => labRequestService.confirmRequestByFrontDesk(requestId),
    onSuccess: (record) => {
      if (!record) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['lab-queue', record.clinicId] });
      void queryClient.invalidateQueries({ queryKey: ['appointment-lab-requests', record.appointmentId] });
      void queryClient.invalidateQueries({ queryKey: ['lab-request', record.id] });
      void queryClient.invalidateQueries({ queryKey: ['patient-lab-results', record.patientId] });
      void queryClient.invalidateQueries({ queryKey: ['patient-medical-timeline', record.patientId] });
    },
  });
}