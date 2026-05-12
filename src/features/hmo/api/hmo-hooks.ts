/**
 * HMO Management — React Query Hooks
 *
 * Wraps hmo-service.ts with useQuery / useMutation and proper cache invalidation.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/query-keys";
import {
  listHmoProviders,
  createHmoProvider,
  updateHmoProvider,
  deleteHmoProvider,
  listPatientHmoAccounts,
  createPatientHmoAccount,
  updatePatientHmoAccount,
  listHmoAuthorizations,
  createHmoAuthorization,
  updateHmoAuthorization,
  listHmoClaims,
  createHmoClaim,
  updateHmoClaim,
  listHmoClaimItems,
  createHmoClaimItem,
  deleteHmoClaimItem,
  listHmoPayments,
  listHmoPaymentsByClaim,
  createHmoPayment,
} from "./hmo-service";
import type {
  HmoProvider,
  PatientHmoAccount,
  HmoAuthorization,
  HmoClaim,
  HmoClaimItem,
  HmoPayment,
} from "../../../types/domain";

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export function useHmoProviders() {
  return useQuery({
    queryKey: queryKeys.hmoProviders,
    queryFn: listHmoProviders,
  });
}

export function useCreateHmoProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<HmoProvider, "id" | "createdAt" | "updatedAt">) =>
      createHmoProvider(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.hmoProviders });
    },
  });
}

export function useUpdateHmoProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<Omit<HmoProvider, "id" | "createdAt" | "updatedAt">>;
    }) => updateHmoProvider(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.hmoProviders });
    },
  });
}

export function useDeleteHmoProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHmoProvider(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.hmoProviders });
    },
  });
}

// ---------------------------------------------------------------------------
// Patient HMO Accounts
// ---------------------------------------------------------------------------

export function usePatientHmoAccounts() {
  return useQuery({
    queryKey: queryKeys.patientHmoAccounts,
    queryFn: listPatientHmoAccounts,
  });
}

export function useCreatePatientHmoAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Omit<PatientHmoAccount, "id" | "createdAt" | "updatedAt">,
    ) => createPatientHmoAccount(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.patientHmoAccounts });
    },
  });
}

export function useUpdatePatientHmoAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<
        Omit<PatientHmoAccount, "id" | "createdAt" | "updatedAt">
      >;
    }) => updatePatientHmoAccount(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.patientHmoAccounts });
    },
  });
}

// ---------------------------------------------------------------------------
// Authorizations
// ---------------------------------------------------------------------------

export function useHmoAuthorizations() {
  return useQuery({
    queryKey: queryKeys.hmoAuthorizations,
    queryFn: listHmoAuthorizations,
  });
}

export function useCreateHmoAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Omit<HmoAuthorization, "id" | "createdAt" | "updatedAt">,
    ) => createHmoAuthorization(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.hmoAuthorizations });
    },
  });
}

export function useUpdateHmoAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<
        Omit<HmoAuthorization, "id" | "createdAt" | "updatedAt">
      >;
    }) => updateHmoAuthorization(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.hmoAuthorizations });
    },
  });
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

export function useHmoClaims() {
  return useQuery({
    queryKey: queryKeys.hmoClaims,
    queryFn: listHmoClaims,
  });
}

export function useCreateHmoClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<HmoClaim, "id" | "createdAt" | "updatedAt">) =>
      createHmoClaim(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.hmoClaims });
    },
  });
}

export function useUpdateHmoClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<Omit<HmoClaim, "id" | "createdAt" | "updatedAt">>;
    }) => updateHmoClaim(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.hmoClaims });
    },
  });
}

// ---------------------------------------------------------------------------
// Claim Items
// ---------------------------------------------------------------------------

export function useHmoClaimItems(claimId: string) {
  return useQuery({
    queryKey: queryKeys.hmoClaimItems(claimId),
    queryFn: () => listHmoClaimItems(claimId),
    enabled: Boolean(claimId),
  });
}

export function useCreateHmoClaimItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Omit<HmoClaimItem, "id" | "createdAt" | "updatedAt">,
    ) => createHmoClaimItem(input),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.hmoClaimItems(variables.claimId),
      });
      void qc.invalidateQueries({ queryKey: queryKeys.hmoClaims });
    },
  });
}

export function useDeleteHmoClaimItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, claimId: _claimId }: { id: string; claimId: string }) =>
      deleteHmoClaimItem(id),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.hmoClaimItems(variables.claimId),
      });
      void qc.invalidateQueries({ queryKey: queryKeys.hmoClaims });
    },
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export function useHmoPayments() {
  return useQuery({
    queryKey: queryKeys.hmoPayments,
    queryFn: listHmoPayments,
  });
}

export function useHmoPaymentsByClaim(claimId: string) {
  return useQuery({
    queryKey: queryKeys.hmoPaymentsByClaim(claimId),
    queryFn: () => listHmoPaymentsByClaim(claimId),
    enabled: Boolean(claimId),
  });
}

export function useCreateHmoPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<HmoPayment, "id" | "createdAt" | "updatedAt">) =>
      createHmoPayment(input),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: queryKeys.hmoPayments });
      void qc.invalidateQueries({
        queryKey: queryKeys.hmoPaymentsByClaim(variables.claimId),
      });
      void qc.invalidateQueries({ queryKey: queryKeys.hmoClaims });
    },
  });
}
