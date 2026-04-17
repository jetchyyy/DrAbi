import { useQuery } from "@tanstack/react-query";

import {
  getBookableServicesLiveOrDemo,
  getClinicSettingsLiveOrDemo,
  getDoctorAvailabilityByDoctorIdLiveOrDemo,
  getDoctorDirectoryLiveOrDemo,
  getGeneralistDirectoryLiveOrDemo,
  listServicesLiveOrDemo,
  listSpecialtiesLiveOrDemo,
} from "../lib/supabase-clinic";
import { queryKeys } from "../lib/query-keys";

export function useClinicSettingsData() {
  return useQuery({
    queryKey: queryKeys.clinicSettings,
    queryFn: getClinicSettingsLiveOrDemo,
  });
}

export function useBookableServices() {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: getBookableServicesLiveOrDemo,
  });
}

export function useServicesCatalog() {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: listServicesLiveOrDemo,
  });
}

export function useSpecialtiesCatalog() {
  return useQuery({
    queryKey: queryKeys.specialties,
    queryFn: listSpecialtiesLiveOrDemo,
  });
}

export function useDoctorDirectory() {
  return useQuery({
    queryKey: queryKeys.doctors,
    queryFn: getGeneralistDirectoryLiveOrDemo,
  });
}

export function useProviderDirectory() {
  return useQuery({
    queryKey: queryKeys.providers,
    queryFn: getDoctorDirectoryLiveOrDemo,
  });
}

export function useDoctorAvailability(doctorId: string | null) {
  return useQuery({
    queryKey: queryKeys.doctorAvailability(doctorId),
    queryFn: () => getDoctorAvailabilityByDoctorIdLiveOrDemo(doctorId),
    enabled: Boolean(doctorId),
  });
}
