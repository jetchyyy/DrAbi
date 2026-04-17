import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import type { Database } from '../../../types/database';
import type {
  CancelLabRequestInput,
  CompleteLabRequestInput,
  CreateLabRequestInput,
  LabRequestFilters,
  LabRequestMediaRecord,
  LabRequestRecord,
  UpdateLabRequestInput,
} from '../types';

type ServiceRequestRow = Database['public']['Tables']['service_requests']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type PatientRow = Database['public']['Tables']['patients']['Row'];
type ClinicRow = Database['public']['Tables']['clinics']['Row'];
type MedicalServiceRow = Database['public']['Tables']['medical_services']['Row'];
type ServiceRequestMediaRow = Database['public']['Tables']['service_request_media']['Row'];

const LAB_REQUEST_ATTACHMENT_BUCKET = 'lab-request-attachments';

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

function isMissingAppointmentColumnError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const details = error as { code?: string; message?: string; details?: string; hint?: string };
  const text = `${details.message ?? ''} ${details.details ?? ''} ${details.hint ?? ''}`.toLowerCase();
  return text.includes('appointment_id') && (details.code === '42703' || details.code === 'PGRST204' || details.code === 'PGRST100');
}

function isMissingMarkPaidRpcError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const message = String((error as { message?: unknown }).message ?? '').toLowerCase();
  return message.includes('mark_lab_request_paid_by_cashier') && message.includes('schema cache');
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function isMissingCreateLabServiceRequestSignature(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const details = error as { code?: string; message?: string; details?: string; hint?: string };
  const text = `${details.message ?? ''} ${details.details ?? ''} ${details.hint ?? ''}`.toLowerCase();
  return details.code === 'PGRST202' && text.includes('create_lab_service_request');
}

function getFileNameFromPath(filePath: string) {
  const segments = filePath.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? filePath;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function getPublicAttachmentUrl(filePath: string) {
  const client = requireSupabaseClient();
  return client.storage.from(LAB_REQUEST_ATTACHMENT_BUCKET).getPublicUrl(filePath).data.publicUrl;
}

async function resolvePatientProfileId(candidateId: string) {
  const client = requireSupabaseClient();

  const { data: profileHit, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('id', candidateId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const matchedProfile = profileHit as Pick<ProfileRow, 'id'> | null;
  if (matchedProfile?.id) {
    return matchedProfile.id;
  }

  const { data: patientHit, error: patientError } = await client
    .from('patients')
    .select('id, user_id')
    .eq('id', candidateId)
    .maybeSingle();

  if (patientError) {
    throw patientError;
  }

  const mapped = patientHit as Pick<PatientRow, 'user_id'> | null;
  if (mapped?.user_id) {
    return mapped.user_id;
  }

  return candidateId;
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
  const requestIds = rows.map((row) => row.id);

  const [clinicResult, serviceResult, profileResult, mediaResult] = await Promise.all([
    clinicIds.length
      ? client.from('clinics').select('id, name').in('id', clinicIds)
      : Promise.resolve({ data: [] as ClinicRow[] }),
    serviceIds.length
      ? client.from('medical_services').select('id, name').in('id', serviceIds)
      : Promise.resolve({ data: [] as MedicalServiceRow[] }),
    profileIds.length
      ? client.from('profiles').select('id, full_name, first_name, last_name').in('id', profileIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
    requestIds.length
      ? client.from('service_request_media').select('*').in('service_request_id', requestIds).order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as ServiceRequestMediaRow[] }),
  ]);

  const clinicMap = new Map((clinicResult.data ?? []).map((clinic) => [clinic.id, clinic.name]));
  const serviceMap = new Map((serviceResult.data ?? []).map((service) => [service.id, service.name]));
  const profileMap = new Map((profileResult.data ?? []).map((profile) => [profile.id, profile]));
  const mediaMap = new Map<string, LabRequestMediaRecord[]>();

  for (const mediaRow of (mediaResult.data ?? []) as ServiceRequestMediaRow[]) {
    const existing = mediaMap.get(mediaRow.service_request_id) ?? [];
    existing.push({
      id: mediaRow.id,
      serviceRequestId: mediaRow.service_request_id,
      filePath: mediaRow.file_path,
      fileUrl: getPublicAttachmentUrl(mediaRow.file_path),
      fileName: getFileNameFromPath(mediaRow.file_path),
      mimeType: mediaRow.mime_type,
      uploadedBy: mediaRow.uploaded_by,
      createdAt: mediaRow.created_at,
    });
    mediaMap.set(mediaRow.service_request_id, existing);
  }

  return rows.map((row) => ({
    id: row.id,
    clinicId: row.clinic_id,
    clinicName: clinicMap.get(row.clinic_id) ?? null,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    patientName: buildFullName(profileMap.get(row.patient_id)) ?? null,
    requestedBy: row.requested_by,
    requestedByName: buildFullName(profileMap.get(row.requested_by)) ?? null,
    serviceId: row.service_id,
    serviceName: serviceMap.get(row.service_id) ?? null,
    serviceCategory: row.service_category,
    department: row.department,
    transactionType: row.transaction_type,
    paymentStatus: row.payment_status,
    receiptCode: row.receipt_code,
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
    media: mediaMap.get(row.id) ?? [],
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

async function uploadRequestAttachments(requestId: string, attachments: File[]) {
  if (attachments.length === 0) {
    return;
  }

  const client = requireSupabaseClient();
  const { data: userData } = await client.auth.getUser();
  const uploadedBy = userData.user?.id ?? '';

  const uploadedRows: Array<Pick<ServiceRequestMediaRow, 'service_request_id' | 'file_path' | 'mime_type' | 'uploaded_by'>> = [];

  for (const file of attachments) {
    const safeFileName = sanitizeFileName(file.name || 'attachment');
    const objectPath = `requests/${requestId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeFileName}`;

    const uploadResult = await client.storage.from(LAB_REQUEST_ATTACHMENT_BUCKET).upload(objectPath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    uploadedRows.push({
      service_request_id: requestId,
      file_path: uploadResult.data.path,
      mime_type: file.type || null,
      uploaded_by: uploadedBy,
    });
  }

  const { error } = await client.from('service_request_media').insert(uploadedRows as never);
  if (error) {
    throw error;
  }
}

export const labRequestService = {
  async createRequest(input: CreateLabRequestInput) {
    const client = requireSupabaseClient();
    const resolvedPatientId = await resolvePatientProfileId(input.patientId);
    const primaryPayload = {
      p_clinic_id: input.clinicId ?? null,
      p_patient_id: resolvedPatientId,
      p_requested_by: input.requestedBy,
      p_service_id: input.serviceId,
      p_service_category: input.serviceCategory,
      p_patient_notes: input.patientNotes ?? null,
      p_urgent_flag: input.urgentFlag ?? false,
      p_transaction_type: input.transactionType ?? 'service_request',
      p_appointment_id: input.appointmentId ?? null,
    };

    let rpcResult = await (client as any).rpc('create_lab_service_request', primaryPayload);

    if (rpcResult.error && isMissingCreateLabServiceRequestSignature(rpcResult.error)) {
      // Older database signature does not support p_appointment_id yet.
      const fallbackPayload = {
        p_clinic_id: input.clinicId ?? null,
        p_patient_id: resolvedPatientId,
        p_requested_by: input.requestedBy,
        p_service_id: input.serviceId,
        p_service_category: input.serviceCategory,
        p_patient_notes: input.patientNotes ?? null,
        p_urgent_flag: input.urgentFlag ?? false,
        p_transaction_type: input.transactionType ?? 'service_request',
      };
      rpcResult = await (client as any).rpc('create_lab_service_request', fallbackPayload);
    }

    if (rpcResult.error) {
      throw rpcResult.error;
    }

    return hydrateRequests([rpcResult.data as ServiceRequestRow]).then((rows) => rows[0] ?? null);
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

  async confirmRequestByFrontDesk(requestId: string) {
    const client = requireSupabaseClient();
    const { data, error } = await (client as any).rpc('confirm_lab_request_by_frontdesk', {
      p_request_id: requestId,
    });

    if (error) {
      throw error;
    }

    return hydrateRequests([data as ServiceRequestRow]).then((rows) => rows[0] ?? null);
  },

  async updateRequestDetails(input: UpdateLabRequestInput) {
    const client = requireSupabaseClient();

    const payload: Record<string, unknown> = {
      patient_notes: input.patientNotes ?? null,
      urgent_flag: input.urgentFlag ?? false,
    };

    if (input.status) {
      payload.status = input.status;
    }

    const { data, error } = await client
      .from('service_requests')
      .update(payload as never)
      .eq('id', input.requestId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return labRequestService.getRequestById(input.requestId);
    }

    return hydrateRequests([data as ServiceRequestRow]).then((rows) => rows[0] ?? null);
  },

  async markRequestAsPaid(requestId: string, receiptCode: string | null) {
    const client = requireSupabaseClient();

    let data: ServiceRequestRow | null = null;

    const { data: rpcData, error: rpcError } = await (client as any).rpc('mark_lab_request_paid_by_cashier', {
      p_request_id: requestId,
      p_receipt_code: receiptCode,
    });

    if (rpcError) {
      if (!isMissingMarkPaidRpcError(rpcError)) {
        throw rpcError;
      }

      // Fallback for environments where the RPC has not been applied/reloaded yet.
      const payload: Record<string, unknown> = {
        payment_status: 'paid',
      };

      if (receiptCode) {
        payload.receipt_code = receiptCode;
      }

      const { data: directData, error: directError } = await client
        .from('service_requests')
        .update(payload as never)
        .eq('id', requestId)
        .select('*')
        .single();

      if (directError) {
        throw new Error(
          'mark_lab_request_paid_by_cashier RPC is missing and direct update was blocked. Run SQL to create the RPC and reload schema cache.',
        );
      }

      data = directData as ServiceRequestRow;
    } else {
      data = rpcData as ServiceRequestRow;
    }

    return hydrateRequests([data]).then((rows) => rows[0] ?? null);
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

    const request = data as ServiceRequestRow;
    if (input.attachments && input.attachments.length > 0) {
      await uploadRequestAttachments(request.id, input.attachments);
    }

    return labRequestService.getRequestById(request.id);
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

    const resolvedPatientId = await resolvePatientProfileId(patientId);

    return listRequestsByColumn('patient_id', resolvedPatientId, {
      ...filters,
      resultStatus: filters?.resultStatus ?? 'completed',
    });
  },

  async getPatientRequests(patientId: string, filters?: LabRequestFilters) {
    if (!isSupabaseConfigured) {
      return [];
    }

    const resolvedPatientId = await resolvePatientProfileId(patientId);
    return listRequestsByColumn('patient_id', resolvedPatientId, filters);
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
    const token = requestId.trim();
    let data: ServiceRequestRow | null = null;

    if (isUuidLike(token)) {
      const { data: byId, error: byIdError } = await client.from('service_requests').select('*').eq('id', token).maybeSingle();
      if (byIdError) {
        throw byIdError;
      }
      data = (byId as ServiceRequestRow | null) ?? null;
    }

    if (!data) {
      const { data: byReceiptCode, error: byReceiptCodeError } = await client
        .from('service_requests')
        .select('*')
        .eq('receipt_code', token)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byReceiptCodeError) {
        throw byReceiptCodeError;
      }

      data = (byReceiptCode as ServiceRequestRow | null) ?? null;
    }

    if (!data) {
      return null;
    }

    const hydrated = await hydrateRequests([data]);
    return hydrated[0] ?? null;
  },

  async getAppointmentLabRequests(appointmentId: string, filters?: LabRequestFilters) {
    if (!isSupabaseConfigured) {
      return [];
    }

    const client = requireSupabaseClient();
    const normalized = normalizeFilters(filters);
    let query = client.from('service_requests').select('*').eq('appointment_id', appointmentId).order('created_at', { ascending: false });

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
      if (isMissingAppointmentColumnError(error)) {
        // Database migration for appointment_id has not been applied yet.
        return [];
      }

      throw error;
    }

    return hydrateRequests((data ?? []) as ServiceRequestRow[]);
  },
};
