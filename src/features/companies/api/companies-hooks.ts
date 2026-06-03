/**
 * Companies — React Query Hooks
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../../../lib/query-keys";
import type { Company } from "../../../types/domain";
import {
  createCompany,
  deleteCompany,
  listCompanies,
  updateCompany,
} from "./companies-service";

export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.companies,
    queryFn: listCompanies,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Company, "id" | "createdAt" | "updatedAt">) =>
      createCompany(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.companies });
    },
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<Omit<Company, "id" | "createdAt" | "updatedAt">>;
    }) => updateCompany(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.companies });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.companies });
    },
  });
}
