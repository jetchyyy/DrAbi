import { createAppointment, deleteAppointmentRecord, listAppointments, updateAppointmentRecord } from '../../lib/local-db';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';
import type { Appointment, Role } from '../../types/domain';

type AppointmentInput = Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>;
type AppointmentWithTeleconsult = Appointment & {
  teleconsultationProvider?: 'jitsi' | null;
  teleconsultationRoomName?: string | null;
};
type AppointmentRowLoose = Database['public']['Tables']['appointments']['Row'] & {
  teleconsultation_provider?: string | null;
  teleconsultation_room_name?: string | null;
  teleconsultation_platform?: string | null;
  teleconsultation_url?: string | null;
  teleconsultation_access_instructions?: string | null;
};

interface NormalizedAppointmentInput extends AppointmentInput {
  teleconsultationProvider: 'jitsi' | null;
  teleconsultationRoomName: string | null;
  teleconsultationPlatform: string | null;
  teleconsultationUrl: string | null;
  teleconsultationAccessInstructions: string | null;
}

export interface TeleconsultAppointmentSummary {
  id: string;
  scheduledAt: string;
  status: Appointment['status'];
  patientName: string;
  doctorName: string;
  serviceName: string;
  teleconsultationPlatform: string;
  teleconsultationAccessInstructions: string | null;
  roomName: string;
  joinPath: string;
}

function getClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  return supabase;
}

function createTeleconsultationRoomName() {
  return `odc-${crypto.randomUUID().replaceAll('-', '')}`;
}

function getTeleconsultJoinPath(role: Role, appointmentId: string) {
  return role === 'patient' ? `/portal/teleconsult/${appointmentId}` : `/app/teleconsult/${appointmentId}`;
}

function getTeleconsultationPlatformLabel(platform?: string | null) {
  return platform?.trim() || 'Jitsi Meet';
}

function getEffectiveTeleconsultationRoomName(appointmentId: string, roomName?: string | null) {
  return roomName?.trim() || `odc-teleconsult-${appointmentId}`;
}

function normalizeAppointmentInput(input: AppointmentInput): NormalizedAppointmentInput {
  if (input.visitType !== 'teleconsultation') {
    return {
      ...input,
      teleconsultationProvider: null,
      teleconsultationRoomName: null,
      teleconsultationPlatform: null,
      teleconsultationUrl: null,
      teleconsultationAccessInstructions: null,
    };
  }

  return {
    ...input,
    teleconsultationProvider: 'jitsi',
    teleconsultationRoomName: createTeleconsultationRoomName(),
    teleconsultationPlatform: getTeleconsultationPlatformLabel(input.teleconsultationPlatform),
    teleconsultationUrl: null,
    teleconsultationAccessInstructions:
      input.teleconsultationAccessInstructions?.trim() ||
      'Use the in-app Join teleconsult button a few minutes before your scheduled appointment.',
  };
}

function mapAppointmentRow(row: AppointmentRowLoose): AppointmentWithTeleconsult {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id ?? '',
    specialtyId: row.specialty_id ?? '',
    serviceId: row.service_id ?? '',
    scheduledAt: row.scheduled_at,
    status:
      row.status === 'scheduled' ||
      row.status === 'confirmed' ||
      row.status === 'in_progress' ||
      row.status === 'completed' ||
      row.status === 'cancelled' ||
      row.status === 'no_show'
        ? row.status
        : 'scheduled',
    source: row.source === 'portal' ? 'portal' : 'internal',
    visitType: row.visit_type === 'teleconsultation' ? 'teleconsultation' : 'in_person',
    reason: row.reason,
    notes: row.notes,
    teleconsultationPlatform: row.teleconsultation_platform ?? null,
    teleconsultationUrl: row.teleconsultation_url ?? null,
    teleconsultationAccessInstructions: row.teleconsultation_access_instructions ?? null,
    teleconsultationProvider: row.teleconsultation_provider === 'jitsi' ? 'jitsi' : null,
    teleconsultationRoomName: row.teleconsultation_room_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function buildTeleconsultSummary(
  appointment: AppointmentWithTeleconsult,
  role: Role,
  patientName: string,
  doctorName: string,
  serviceName: string,
): TeleconsultAppointmentSummary {
  return {
    id: appointment.id,
    scheduledAt: appointment.scheduledAt,
    status: appointment.status,
    patientName,
    doctorName,
    serviceName,
    teleconsultationPlatform: getTeleconsultationPlatformLabel(appointment.teleconsultationPlatform),
    teleconsultationAccessInstructions:
      appointment.teleconsultationAccessInstructions ??
      'Use the in-app Join teleconsult button a few minutes before your scheduled appointment.',
    roomName: getEffectiveTeleconsultationRoomName(appointment.id, appointment.teleconsultationRoomName),
    joinPath: getTeleconsultJoinPath(role, appointment.id),
  };
}

function getDemoPatientByIdentity(userId: string | null, email?: string | null) {
  const database = getDatabase();

  if (userId) {
    const byUserId = database.patients.find((patient) => patient.userId === userId);
    if (byUserId) {
      return byUserId;
    }
  }

  if (!email) {
    return null;
  }

  return database.patients.find((patient) => patient.email.toLowerCase() === email.toLowerCase()) ?? null;
}

async function getDoctorIdForProfile(userId: string) {
  const client = getClient();
  const { data, error } = await client.from('doctors').select('id').eq('profile_id', userId).maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as { id: string } | null;
  return row?.id ?? null;
}

export function isTeleconsultJoinableStatus(status: Appointment['status']) {
  return ['scheduled', 'confirmed', 'in_progress'].includes(status);
}

export async function listAppointmentsLiveOrDemo(): Promise<AppointmentWithTeleconsult[]> {
  if (!isSupabaseConfigured) {
    return listAppointments() as AppointmentWithTeleconsult[];
  }

  const client = getClient();
  const { data, error } = await client.from('appointments').select('*').order('scheduled_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as AppointmentRowLoose[]).map(mapAppointmentRow);
}

export async function createAppointmentLiveOrDemo(input: AppointmentInput) {
  const normalized = normalizeAppointmentInput(input);

  if (!isSupabaseConfigured) {
    return createAppointment(normalized);
  }

  const client = getClient();
  const payload = {
    patient_id: normalized.patientId,
    doctor_id: normalized.doctorId || null,
    specialty_id: normalized.specialtyId || null,
    service_id: normalized.serviceId || null,
    scheduled_at: normalized.scheduledAt,
    status: normalized.status,
    source: normalized.source,
    visit_type: normalized.visitType,
    reason: normalized.reason,
    notes: normalized.notes,
    teleconsultation_provider: normalized.teleconsultationProvider,
    teleconsultation_room_name: normalized.teleconsultationRoomName,
    teleconsultation_platform: normalized.teleconsultationPlatform,
    teleconsultation_url: normalized.teleconsultationUrl,
    teleconsultation_access_instructions: normalized.teleconsultationAccessInstructions,
  };

  const { data, error } = await client.from('appointments').insert(payload as never).select('*').single();

  if (error) {
    throw error;
  }

  return mapAppointmentRow(data as AppointmentRowLoose);
}

export async function updateAppointmentLiveOrDemo(appointmentId: string, input: AppointmentInput) {
  const normalized = normalizeAppointmentInput(input);

  if (!isSupabaseConfigured) {
    return updateAppointmentRecord(appointmentId, normalized);
  }

  const client = getClient();
  const payload = {
    patient_id: normalized.patientId,
    doctor_id: normalized.doctorId || null,
    specialty_id: normalized.specialtyId || null,
    service_id: normalized.serviceId || null,
    scheduled_at: normalized.scheduledAt,
    status: normalized.status,
    source: normalized.source,
    visit_type: normalized.visitType,
    reason: normalized.reason,
    notes: normalized.notes,
    teleconsultation_provider: normalized.teleconsultationProvider,
    teleconsultation_room_name: normalized.teleconsultationRoomName,
    teleconsultation_platform: normalized.teleconsultationPlatform,
    teleconsultation_url: normalized.teleconsultationUrl,
    teleconsultation_access_instructions: normalized.teleconsultationAccessInstructions,
  };

  const { data, error } = await client.from('appointments').update(payload as never).eq('id', appointmentId).select('*').single();
  if (error) {
    throw error;
  }

  return mapAppointmentRow(data as AppointmentRowLoose);
}

export async function deleteAppointmentLiveOrDemo(appointmentId: string) {
  if (!isSupabaseConfigured) {
    deleteAppointmentRecord(appointmentId);
    return;
  }

  const client = getClient();
  const { error } = await client.from('appointments').update({ deleted_at: new Date().toISOString() } as never).eq('id', appointmentId);
  if (error) {
    throw error;
  }
}

export async function getTeleconsultAppointmentsForUser(input: {
  userId: string | null;
  email?: string | null;
  role: Role | null;
}): Promise<TeleconsultAppointmentSummary[]> {
  if (input.role !== 'patient' && input.role !== 'doctor') {
    return [];
  }

  const role: Role = input.role === 'patient' ? 'patient' : 'doctor';

  if (!isSupabaseConfigured) {
    const database = getDatabase();
    const patient = role === 'patient' ? getDemoPatientByIdentity(input.userId, input.email) : null;
    const appointments = (listAppointments() as AppointmentWithTeleconsult[])
      .filter((appointment) => {
        if (appointment.visitType !== 'teleconsultation') {
          return false;
        }

        if (role === 'patient') {
          return appointment.patientId === patient?.id;
        }

        return appointment.doctorId === input.userId;
      })
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));

    return appointments.map((appointment) => {
      const linkedPatient = database.patients.find((item) => item.id === appointment.patientId);
      const linkedDoctor = database.users.find((item) => item.id === appointment.doctorId);
      const linkedService = database.services.find((item) => item.id === appointment.serviceId);

      return buildTeleconsultSummary(
        appointment,
        role,
        linkedPatient ? `${linkedPatient.firstName} ${linkedPatient.lastName}` : 'Patient',
        linkedDoctor?.fullName ?? 'Doctor',
        linkedService?.name ?? 'Consultation',
      );
    });
  }

  if (!input.userId) {
    return [];
  }

  const client = getClient();
  let query = client.from('appointments').select('*').eq('visit_type', 'teleconsultation').order('scheduled_at', { ascending: true });

  if (role === 'patient') {
    const { data, error: patientError } = await client.from('patients').select('id').eq('user_id', input.userId).maybeSingle();
    if (patientError) {
      throw patientError;
    }
    const patientRow = data as { id: string } | null;
    if (!patientRow) {
      return [];
    }
    query = query.eq('patient_id', patientRow.id);
  } else {
    const doctorId = await getDoctorIdForProfile(input.userId);
    if (!doctorId) {
      return [];
    }
    query = query.eq('doctor_id', doctorId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const appointments = ((data ?? []) as AppointmentRowLoose[]).map(mapAppointmentRow);
  if (appointments.length === 0) {
    return [];
  }

  const patientIds = [...new Set(appointments.map((appointment) => appointment.patientId).filter(Boolean))];
  const doctorIds = [...new Set(appointments.map((appointment) => appointment.doctorId).filter(Boolean))];
  const serviceIds = [...new Set(appointments.map((appointment) => appointment.serviceId).filter(Boolean))];

  const patientQuery = patientIds.length
    ? client.from('patients').select('id, first_name, last_name').in('id', patientIds)
    : Promise.resolve({ data: [] as Array<{ id: string; first_name: string; last_name: string }>, error: null });
  const doctorQuery = doctorIds.length
    ? client.from('doctors').select('id, profile_id').in('id', doctorIds)
    : Promise.resolve({ data: [] as Array<{ id: string; profile_id: string }>, error: null });
  const serviceQuery = serviceIds.length
    ? client.from('services').select('id, name').in('id', serviceIds)
    : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null });

  const [{ data: patientsData, error: patientsError }, { data: doctorsData, error: doctorsError }, { data: servicesData, error: servicesError }] =
    await Promise.all([patientQuery, doctorQuery, serviceQuery]);

  if (patientsError) {
    throw patientsError;
  }
  if (doctorsError) {
    throw doctorsError;
  }
  if (servicesError) {
    throw servicesError;
  }

  const typedDoctors = (doctorsData ?? []) as Array<{ id: string; profile_id: string }>;
  const profileIds = typedDoctors.map((doctor) => doctor.profile_id);
  const { data: profilesData, error: profilesError } = profileIds.length
    ? await client.from('profiles').select('id, full_name').in('id', profileIds)
    : { data: [] as Array<{ id: string; full_name: string }>, error: null };

  if (profilesError) {
    throw profilesError;
  }

  const patientMap = new Map(
    ((patientsData ?? []) as Array<{ id: string; first_name: string; last_name: string }>).map((patient) => [
      patient.id,
      `${patient.first_name} ${patient.last_name}`,
    ]),
  );
  const serviceMap = new Map(((servicesData ?? []) as Array<{ id: string; name: string }>).map((service) => [service.id, service.name]));
  const profileMap = new Map(((profilesData ?? []) as Array<{ id: string; full_name: string }>).map((profile) => [profile.id, profile.full_name]));
  const doctorMap = new Map(typedDoctors.map((doctor) => [doctor.id, profileMap.get(doctor.profile_id) ?? 'Doctor']));

  return appointments.map((appointment) =>
    buildTeleconsultSummary(
      appointment,
      role,
      patientMap.get(appointment.patientId) ?? 'Patient',
      doctorMap.get(appointment.doctorId) ?? 'Doctor',
      serviceMap.get(appointment.serviceId) ?? 'Consultation',
    ),
  );
}

export async function getAuthorizedTeleconsultAppointmentForUser(input: {
  appointmentId: string;
  userId: string | null;
  email?: string | null;
  role: Role | null;
}) {
  const appointments = await getTeleconsultAppointmentsForUser({
    userId: input.userId,
    email: input.email,
    role: input.role,
  });

  return appointments.find((appointment) => appointment.id === input.appointmentId) ?? null;
}
