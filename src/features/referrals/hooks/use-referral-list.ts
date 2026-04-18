import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/query-keys";
import { isSupabaseConfigured, supabase } from "../../../lib/supabase";
import type { ReferralStatus } from "../../../types/domain";
import type { Database } from "../../../types/database";

type ReferralRow = Database["public"]["Tables"]["referrals"]["Row"];

export interface ReferralListItem {
  id: string;
  patientId: string;
  patientFullName: string;
  appointmentDate: string | null;
  appointmentTime: string | null;
  status: ReferralStatus;
  cancelledReason: string | null;
  rescheduledReason: string | null;
  reason: string;
  clinicalSummary: string;
  referralNotes: string;
  referringDoctorId: string;
  targetDoctorId: string | null;
  targetSpecialtyId: string | null;
  assignedSpecialistId: string | null;
  specialistScheduleId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EditReferralInput {
  status: ReferralStatus;
  cancelledReason?: string | null;
  rescheduledReason?: string | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  reason?: string;
  clinicalSummary?: string;
  referralNotes?: string;
  specialistFindings?: string;
  specialistRecommendations?: string;
}

function mapReferralStatus(value: string | null | undefined): ReferralStatus {
  switch (value) {
    case "draft":
    case "sent":
    case "pending":
    case "scheduled":
    case "accepted":
    case "confirmed":
    case "completed":
    case "declined":
    case "cancelled":
    case "rescheduled":
      return value;
    default:
      return "pending";
  }
}

type ReferralWithPatient = ReferralRow & {
  cancelled_reason?: string | null;
  patients: { first_name: string; last_name: string } | null;
};

function mapReferralRow(
  row: ReferralWithPatient,
  patientFullName: string,
): ReferralListItem {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientFullName,
    appointmentDate: row.appointment_date ?? null,
    appointmentTime: row.appointment_time ?? null,
    status: mapReferralStatus(row.status),
    cancelledReason: row.cancelled_reason ?? null,
    rescheduledReason: row.rescheduled_reason ?? null,
    reason: row.reason,
    clinicalSummary: row.clinical_summary ?? "",
    referralNotes: row.referral_notes ?? "",
    referringDoctorId: row.referring_doctor_id,
    targetDoctorId: row.target_doctor_id ?? null,
    targetSpecialtyId: row.target_specialty_id ?? null,
    assignedSpecialistId: row.assigned_specialist_id ?? null,
    specialistScheduleId: row.specialist_schedule_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchAllReferrals(): Promise<ReferralListItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("referrals")
    .select(`*, patients!referrals_patient_id_fkey(first_name, last_name)`)
    .is("deleted_at", null)
    .in("status", [
      "scheduled",
      "confirmed",
      "completed",
      "cancelled",
      "rescheduled",
    ])

    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as ReferralWithPatient[]).map((row) => {
    const patient = row.patients;
    const fullName = patient
      ? `${patient.first_name} ${patient.last_name}`.trim()
      : "Unknown Patient";
    return mapReferralRow(row, fullName);
  });
}

async function updateReferralById(
  id: string,
  input: EditReferralInput,
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  const payload = {
    status: input.status,
    cancelled_reason: input.cancelledReason ?? null,
    rescheduled_reason: input.rescheduledReason ?? null,
    appointment_date: input.appointmentDate ?? null,
    appointment_time: input.appointmentTime ?? null,
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    ...(input.clinicalSummary !== undefined
      ? { clinical_summary: input.clinicalSummary }
      : {}),
    ...(input.referralNotes !== undefined
      ? { referral_notes: input.referralNotes }
      : {}),
    ...(input.specialistFindings !== undefined
      ? { specialist_findings: input.specialistFindings }
      : {}),
    ...(input.specialistRecommendations !== undefined
      ? { specialist_recommendations: input.specialistRecommendations }
      : {}),
  };

  const { error } = await supabase
    .from("referrals")
    .update(payload as never)
    .eq("id", id);

  if (error) throw error;
}

async function softDeleteReferral(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  const { error } = await supabase
    .from("referrals")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);

  if (error) throw error;
}

export function useReferralsList() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.referrals(null),
    queryFn: fetchAllReferrals,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: EditReferralInput }) =>
      updateReferralById(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.referrals(null) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteReferral(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.referrals(null) });
    },
  });

  const handleUpdateStatus = useCallback(
    async (id: string, status: ReferralStatus) => {
      await updateMutation.mutateAsync({ id, input: { status } });
    },
    [updateMutation],
  );

  const handleUpdateReferral = useCallback(
    async (id: string, input: EditReferralInput) => {
      await updateMutation.mutateAsync({ id, input });
    },
    [updateMutation],
  );

  const handleDeleteReferral = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation],
  );

  return {
    referrals: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    handleUpdateStatus,
    handleUpdateReferral,
    handleDeleteReferral,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export const REFERRAL_STATUS_OPTIONS: Array<{
  value: ReferralStatus;
  label: string;
}> = [
  { value: "scheduled", label: "Scheduled" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rescheduled", label: "Rescheduled" },
];
