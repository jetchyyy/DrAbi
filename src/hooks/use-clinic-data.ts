import { useQuery } from '@tanstack/react-query';

import { getBookableServicesLiveOrDemo, getClinicSettingsLiveOrDemo, getDoctorDirectoryLiveOrDemo } from '../lib/supabase-clinic';
import { queryKeys } from '../lib/query-keys';

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

export function useDoctorDirectory() {
  return useQuery({
    queryKey: queryKeys.doctors,
    queryFn: getDoctorDirectoryLiveOrDemo,
  });
}
