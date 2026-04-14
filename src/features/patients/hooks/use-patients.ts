import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '../../../app/query-client';
import { createPatientActionLog, listPatientActionLogs, recordInventoryUsage } from '../../../lib/local-db';
import { queryKeys } from '../../../lib/query-keys';
import {
  createPatientLiveOrDemo,
  createPrescriptionLiveOrDemo,
  deletePatientLiveOrDemo,
  getPatientByIdLiveOrDemo,
  listAppointmentsByPatientIdLiveOrDemo,
  listBookingsByPatientIdLiveOrDemo,
  updatePatientLiveOrDemo,
  listConsultationsByPatientIdLiveOrDemo,
  listPatientsLiveOrDemo,
  listPrescriptionsByPatientIdLiveOrDemo,
} from '../../../lib/supabase-clinic';
import type { InventoryUsageLog, Patient, PatientActionLog, Prescription } from '../../../types/domain';
import { consultationService, type ConsultationSubmissionPayload } from '../../consultation/services/consultation-service';

export function usePatients() {
  return useQuery({
    queryKey: queryKeys.patients,
    queryFn: listPatientsLiveOrDemo,
  });
}

export function useCreatePatient() {
  return useMutation({
    mutationFn: async (payload: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>) => createPatientLiveOrDemo(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients });
    },
  });
}

export function useUpdatePatient() {
  return useMutation({
    mutationFn: async ({ patientId, payload }: { patientId: string; payload: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> }) =>
      updatePatientLiveOrDemo(patientId, payload),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      void queryClient.invalidateQueries({ queryKey: queryKeys.patientDetail(variables.patientId) });
    },
  });
}

export function useDeletePatient() {
  return useMutation({
    mutationFn: async (patientId: string) => deletePatientLiveOrDemo(patientId),
    onSuccess: (_result, patientId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      void queryClient.invalidateQueries({ queryKey: queryKeys.patientDetail(patientId) });
    },
  });
}

export function usePatientActionLogs() {
  return useQuery({
    queryKey: queryKeys.patientActionLogs,
    queryFn: async () => listPatientActionLogs(),
  });
}

export function useCreatePatientActionLog() {
  return useMutation({
    mutationFn: async (payload: Omit<PatientActionLog, 'id' | 'createdAt' | 'updatedAt'>) => createPatientActionLog(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.patientActionLogs });
    },
  });
}

export function useCreateConsultation() {
  return useMutation({
    mutationFn: async (payload: ConsultationSubmissionPayload) => consultationService.submitConsultation(payload),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      void queryClient.invalidateQueries({ queryKey: queryKeys.patientConsultations(variables.patientId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.patientPrescriptions(variables.patientId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.patientAppointments(variables.patientId) });
    },
  });
}

export function useCreatePrescription() {
  return useMutation({
    mutationFn: async (payload: Omit<Prescription, 'id' | 'createdAt' | 'updatedAt'>) => createPrescriptionLiveOrDemo(payload),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      void queryClient.invalidateQueries({ queryKey: queryKeys.patientPrescriptions(variables.patientId) });
    },
  });
}

export function useRecordInventoryUsage() {
  return useMutation({
    mutationFn: async (payload: Omit<InventoryUsageLog, 'id' | 'createdAt' | 'updatedAt'>) => recordInventoryUsage(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    },
  });
}

export function usePatientDetail(patientId: string | null) {
  return useQuery({
    queryKey: queryKeys.patientDetail(patientId),
    queryFn: async () => {
      if (!patientId) return null;
      return getPatientByIdLiveOrDemo(patientId);
    },
    enabled: Boolean(patientId),
  });
}

export function usePatientAppointments(patientId: string | null) {
  return useQuery({
    queryKey: queryKeys.patientAppointments(patientId),
    queryFn: async () => {
      if (!patientId) return [];
      return listAppointmentsByPatientIdLiveOrDemo(patientId);
    },
    enabled: Boolean(patientId),
  });
}

export function usePatientBookings(patientId: string | null) {
  return useQuery({
    queryKey: queryKeys.patientBookings(patientId),
    queryFn: async () => {
      if (!patientId) return [];
      return listBookingsByPatientIdLiveOrDemo(patientId);
    },
    enabled: Boolean(patientId),
  });
}

export function usePatientConsultations(patientId: string | null) {
  return useQuery({
    queryKey: queryKeys.patientConsultations(patientId),
    queryFn: async () => {
      if (!patientId) return [];
      return listConsultationsByPatientIdLiveOrDemo(patientId);
    },
    enabled: Boolean(patientId),
  });
}

export function usePatientPrescriptions(patientId: string | null) {
  return useQuery({
    queryKey: queryKeys.patientPrescriptions(patientId),
    queryFn: async () => {
      if (!patientId) return [];
      return listPrescriptionsByPatientIdLiveOrDemo(patientId);
    },
    enabled: Boolean(patientId),
  });
}
