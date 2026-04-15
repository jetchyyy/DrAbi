import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import type { Database } from '../../../types/database';
import type {
  CancelLabRequestInput,
  CompleteLabRequestInput,
  CreateLabRequestInput,
  LabRequestFilters,
  LabRequestRecord,
} from '../types';

type ServiceRequestRow = Database['public']['Tables']['service_requests']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ClinicRow = Database['public']['Tables']['clinics']['Row'];
type MedicalServiceRow = Database['public']['Tables']['medical_services']['Row'];

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

function buildFullName(profile: Pick<ProfileRow, 'full_name' | 'first_name' | 'last_name'> | undefined) {
  if (!profile) {
    return null;
  }

  if (profile.full_name?.trim()) {
    return profile.full_name;
  }

  const parts = [profile.first_name, profile.last_name].filter((value): value is string => Boolean(value && value.trim()));
  return parts.length > 0 ? parts.join(' ') : null;
}

function normalizeFilters(filters?: LabRequestFilters) {
  return {
    status: filters?.status ?? null,
    sampleStatus: filters?.sampleStatus ?? null,
    resultStatus: filters?.resultStatus ?? null,
    urgentOnly: Boolean(filters?.urgentOnly),
  };
}

async function hydrateRequests(rows: ServiceRequestRow[]): Promise<LabRequestRecord[]> {
  if (rows.length === 0) {
    return [];
  }

  const client = requireSupabaseClient();
  const clinicIds = Array.from(new Set(rows.map((row) => row.clinic_id).filter(Boolean))) as string[];
  const serviceIds = Array.from(new Set(rows.map((row) => row.service_id).filter(Boolean))) as string[];
  const profileIds = Array.from(
    new Set(rows.flatMap((row) => [row.patient_id, row.requested_by, row.completed_by].filter(Boolean))),
  ) as string[];

  const [clinicResult, serviceResult, profileResult] = await Promise.all([
    clinicIds.length
      ? client.from('clinics').select('id, name').in('id', clinicIds)
      : Promise.resolve({ data: [] as ClinicRow[] }),
    serviceIds.length
      ? client.from('medical_services').select('id, name').in('id', serviceIds)
      : Promise.resolve({ data: [] as MedicalServiceRow[] }),
    profileIds.length
      ? client.from('profiles').select('id, full_name, first_name, last_name').in('id', profileIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
  ]);

  const clinicMap = new Map((clinicResult.data ?? []).map((clinic) => [clinic.id, clinic.name]));
  const serviceMap = new Map((serviceResult.data ?? []).map((service) => [service.id, service.name]));
  const profileMap = new Map((profileResult.data ?? []).map((profile) => [profile.id, profile]));

  return rows.map((row) => ({
    id: row.id,
    clinicId: row.clinic_id,
    clinicName: clinicMap.get(row.clinic_id) ?? null,
    patientId: row.patient_id,
    patientName: buildFullName(profileMap.get(row.patient_id)) ?? null,
    requestedBy: row.requested_by,
    requestedByName: buildFullName(profileMap.get(row.requested_by)) ?? null,
    serviceId: row.service_id,
    serviceName: serviceMap.get(row.service_id) ?? null,
    serviceCategory: row.service_category,
    department: row.department,
    transactionType: row.transaction_type,
    status: row.status,
    sampleStatus: row.sample_status,
    resultStatus: row.result_status,
    patientNotes: row.patient_notes,
    resultData: row.result_data,
    resultNotes: row.result_notes,
    urgentFlag: row.urgent_flag,
    completedBy: row.completed_by,
    completedByName: row.completed_by ? buildFullName(profileMap.get(row.completed_by)) : null,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function listRequestsByColumn(column: 'clinic_id' | 'patient_id' | 'requested_by', value: string, filters?: LabRequestFilters) {
  const client = requireSupabaseClient();
  const normalized = normalizeFilters(filters);
  let query = client.from('service_requests').select('*').eq(column, value).order('created_at', { ascending: false });

  if (normalized.status) {
    query = query.eq('status', normalized.status);
  }

  if (normalized.sampleStatus) {
    query = query.eq('sample_status', normalized.sampleStatus);
  }

  if (normalized.resultStatus) {
    query = query.eq('result_status', normalized.resultStatus);
  }

  if (normalized.urgentOnly) {
    query = query.eq('urgent_flag', true);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return hydrateRequests((data ?? []) as ServiceRequestRow[]);
}

export const labRequestService = {
  async createRequest(input: CreateLabRequestInput) {
    const client = requireSupabaseClient();
    const { data, error } = await (client as any).rpc('create_lab_service_request', {
      p_clinic_id: input.clinicId ?? null,
      p_patient_id: input.patientId,
      p_requested_by: input.requestedBy,
      p_service_id: input.serviceId,
      p_service_category: input.serviceCategory,
      p_patient_notes: input.patientNotes ?? null,
      p_urgent_flag: input.urgentFlag ?? false,
      p_transaction_type: input.transactionType ?? 'service_request',
    });

    if (error) {
      throw error;
    }

    return hydrateRequests([data as ServiceRequestRow]).then((rows) => rows[0] ?? null);
  },

  async startProcessing(requestId: string) {
    const client = requireSupabaseClient();
    const { data, error } = await (client as any).rpc('start_lab_processing', {
      p_request_id: requestId,
    });

    if (error) {
      throw error;
    }

    return hydrateRequests([data as ServiceRequestRow]).then((rows) => rows[0] ?? null);
  },

  async completeRequest(input: CompleteLabRequestInput) {
    const client = requireSupabaseClient();
    const { data, error } = await (client as any).rpc('complete_lab_service_request', {
      p_request_id: input.requestId,
      p_result_data: input.resultData ?? null,
      p_result_notes: input.resultNotes ?? null,
    });

    if (error) {
      throw error;
    }

    return hydrateRequests([data as ServiceRequestRow]).then((rows) => rows[0] ?? null);
  },

  async cancelRequest(input: CancelLabRequestInput) {
    const client = requireSupabaseClient();
    const { data, error } = await (client as any).rpc('cancel_lab_service_request', {
      p_request_id: input.requestId,
      p_reason: input.reason ?? null,
    });

    if (error) {
      throw error;
    }

    return hydrateRequests([data as ServiceRequestRow]).then((rows) => rows[0] ?? null);
  },

  async listClinicQueue(clinicId: string, filters?: LabRequestFilters) {
    if (!isSupabaseConfigured) {
      return [];
    }

    return listRequestsByColumn('clinic_id', clinicId, filters);
  },

  async getPatientLabResults(patientId: string, filters?: LabRequestFilters) {
    if (!isSupabaseConfigured) {
      return [];
    }

    return listRequestsByColumn('patient_id', patientId, {
      ...filters,
      resultStatus: filters?.resultStatus ?? 'completed',
    });
  },

  async getDoctorRequestedLabs(doctorId: string, filters?: LabRequestFilters) {
    if (!isSupabaseConfigured) {
      return [];
    }

    return listRequestsByColumn('requested_by', doctorId, filters);
  },

  async getRequestById(requestId: string) {
    if (!isSupabaseConfigured) {
      return null;
    }

    const client = requireSupabaseClient();
    const { data, error } = await client.from('service_requests').select('*').eq('id', requestId).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const hydrated = await hydrateRequests([data as ServiceRequestRow]);
    return hydrated[0] ?? null;
  },
};