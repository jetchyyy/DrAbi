import type { User } from '@supabase/supabase-js';

import { defaultClinicSettings } from '../config/clinic';
import { odcAccessConfig } from '../config/odc-access';
import { getClinicSettings as getDemoClinicSettings, getDatabase } from './local-db';
import { isSupabaseConfigured, supabase } from './supabase';
import type { ClinicSettings, Patient, Role, Service, ServiceDeliveryMode, UserProfile } from '../types/domain';
import type { Database } from '../types/database';
import { generatePatientQrCode } from './utils';

export interface DoctorDirectoryItem {
  id: string;
  profileId: string;
  fullName: string;
  specialtyId: string | null;
  specialtyName: string | null;
}

export interface BookingListItem {
  id: string;
  patientId: string;
  serviceId: string;
  serviceName: string;
  doctorId: string | null;
  doctorName: string | null;
  preferredDate: string;
  preferredTime: string;
  status: string;
  intakeNotes: string;
  createdAt: string;
}

interface OdcVerifyResponse {
  valid?: boolean;
}

interface OdcUpdateResponse {
  clinicSettings?: ClinicSettingsRow;
}

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type PatientRow = Database['public']['Tables']['patients']['Row'];
type ServiceRow = Database['public']['Tables']['services']['Row'];
type ClinicSettingsRow = Database['public']['Tables']['clinic_settings']['Row'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];

export interface OdcCredentialInput {
  accessKey?: string;
  recoveryPassword?: string;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  return supabase;
}

function splitFullName(fullName: string) {
  const [firstName, ...rest] = fullName.trim().split(' ');
  return {
    firstName: firstName || 'Patient',
    lastName: rest.join(' ') || 'Patient',
  };
}

function mapRole(value: string | null | undefined): Role {
  switch (value) {
    case 'doctor':
    case 'nurse_staff':
    case 'front_desk_cashier':
    case 'lab_staff':
    case 'inventory_staff':
    case 'patient':
    case 'owner_admin':
      return value;
    default:
      return 'patient';
  }
}

function mapServiceDeliveryMode(value: string | null | undefined): ServiceDeliveryMode {
  switch (value) {
    case 'teleconsultation':
    case 'hybrid':
    case 'in_person':
      return value;
    default:
      return 'in_person';
  }
}

function normalizeOdcCredential(input: OdcCredentialInput) {
  return {
    accessKey: input.accessKey?.trim() || undefined,
    recoveryPassword: input.recoveryPassword?.trim() || undefined,
  };
}

async function invokeOdcFunction<T>(body: Record<string, unknown>) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('odc-system-control', {
    body,
  });

  if (error) {
    throw error;
  }

  return (data ?? {}) as T;
}

export function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    authUserId: row.id,
    email: row.email,
    fullName: row.full_name,
    role: mapRole(row.role),
    phone: row.phone ?? '',
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    userId: row.user_id,
    qrCode: row.qr_code,
    firstName: row.first_name,
    lastName: row.last_name,
    sex: row.sex === 'male' || row.sex === 'female' || row.sex === 'other' ? row.sex : 'other',
    birthDate: row.birth_date,
    mobileNumber: row.mobile_number ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    bloodType: row.blood_type ?? '',
    allergies: row.allergies,
    medicalHistory: row.medical_history,
    emergencyContactName: row.emergency_contact_name ?? '',
    emergencyContactPhone: row.emergency_contact_phone ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    durationMinutes: row.duration_minutes,
    specialtyId: row.specialty_id,
    isBookable: row.is_bookable,
    deliveryMode: mapServiceDeliveryMode(row.delivery_mode),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapClinicSettings(row: ClinicSettingsRow): ClinicSettings {
  return {
    id: row.id,
    clinicName: row.clinic_name,
    legalName: row.legal_name,
    shortCode: row.short_code,
    address: row.address,
    contactNumber: row.contact_number,
    email: row.email,
    website: row.website,
    logoUrl: row.logo_url ?? '',
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    bookingLeadDays: row.booking_lead_days,
    bookingCancellationHours: row.booking_cancellation_hours,
    appointmentSlotMinutes: row.appointment_slot_minutes,
    systemEnabled: row.system_enabled,
    systemMessage: row.system_message,
    operatingHours: Array.isArray(row.operating_hours) ? (row.operating_hours as ClinicSettings['operatingHours']) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getClinicSettingsLiveOrDemo() {
  if (!isSupabaseConfigured) {
    return getDemoClinicSettings();
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from('clinic_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapClinicSettings(data) : defaultClinicSettings;
}

export async function getBookableServicesLiveOrDemo() {
  if (!isSupabaseConfigured) {
    return getDatabase().services;
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from('services')
    .select('*')
    .eq('is_bookable', true)
    .is('deleted_at', null)
    .order('name');

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapService);
}

export async function getDoctorDirectoryLiveOrDemo(): Promise<DoctorDirectoryItem[]> {
  if (!isSupabaseConfigured) {
    const database = getDatabase();
    return database.users
      .filter((user) => user.role === 'doctor')
      .map((user) => ({
        id: user.id,
        profileId: user.id,
        fullName: user.fullName,
        specialtyId: user.specialtyId ?? null,
        specialtyName: database.specialties.find((specialty) => specialty.id === user.specialtyId)?.name ?? null,
      }));
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from('doctors')
    .select('id, profile_id, specialty_id, profiles!inner(full_name), specialties(name)')
    .is('deleted_at', null)
    .order('created_at');

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    id: string;
    profile_id: string;
    specialty_id: string | null;
    profiles: { full_name: string } | { full_name: string }[];
    specialties: { name: string } | { name: string }[] | null;
  }>).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    fullName: Array.isArray(row.profiles) ? row.profiles[0]?.full_name ?? 'Doctor' : row.profiles.full_name,
    specialtyId: row.specialty_id,
    specialtyName: Array.isArray(row.specialties)
      ? row.specialties[0]?.name ?? null
      : row.specialties?.name ?? null,
  }));
}

export async function getCurrentProfile(userId: string) {
  if (!isSupabaseConfigured) {
    return getDatabase().users.find((user) => user.authUserId === userId || user.id === userId) ?? null;
  }

  const client = requireSupabase();
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapProfile(data) : null;
}

export async function ensureProfileForUser(user: User) {
  if (!isSupabaseConfigured) {
    return getDatabase().users.find((item) => item.email === user.email) ?? null;
  }

  const client = requireSupabase();
  const metadata = user.user_metadata as Record<string, string | undefined>;
  const role = mapRole(metadata.role);
  const payload: Database['public']['Tables']['profiles']['Insert'] = {
    id: user.id,
    email: user.email ?? '',
    full_name: metadata.full_name ?? metadata.name ?? user.email?.split('@')[0] ?? 'User',
    role,
    phone: metadata.phone ?? null,
    title: metadata.title ?? null,
  };

  const { error } = await client.from('profiles').upsert(payload as never, { onConflict: 'id' });
  if (error) {
    throw error;
  }

  return getCurrentProfile(user.id);
}

export async function getCurrentPatient(userId: string) {
  if (!isSupabaseConfigured) {
    return getDatabase().patients.find((patient) => patient.userId === userId) ?? null;
  }

  const client = requireSupabase();
  const { data, error } = await client.from('patients').select('*').eq('user_id', userId).maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapPatient(data) : null;
}

export async function ensurePatientForUser(user: User) {
  if (!isSupabaseConfigured) {
    return getDatabase().patients.find((patient) => patient.userId === user.id) ?? null;
  }

  const client = requireSupabase();
  const existing = await getCurrentPatient(user.id);
  if (existing) {
    return existing;
  }

  const metadata = user.user_metadata as Record<string, string | undefined>;
  const fullName = metadata.full_name ?? metadata.name ?? user.email?.split('@')[0] ?? 'Patient User';
  const name = splitFullName(fullName);
  const payload: Database['public']['Tables']['patients']['Insert'] = {
    user_id: user.id,
    qr_code: generatePatientQrCode(),
    first_name: name.firstName,
    last_name: name.lastName,
    sex: metadata.sex ?? 'other',
    birth_date: metadata.birth_date ?? new Date().toISOString().slice(0, 10),
    mobile_number: metadata.phone ?? null,
    email: user.email ?? null,
    address: metadata.address ?? null,
    blood_type: metadata.blood_type ?? null,
    allergies: metadata.allergies ?? '',
    medical_history: metadata.medical_history ?? '',
    emergency_contact_name: metadata.emergency_contact_name ?? fullName,
    emergency_contact_phone: metadata.emergency_contact_phone ?? metadata.phone ?? null,
  };

  const { data, error } = await client.from('patients').insert(payload as never).select('*').single();
  if (error) {
    throw error;
  }

  return mapPatient(data);
}

export async function getBookingListForUser(userId: string): Promise<BookingListItem[]> {
  if (!isSupabaseConfigured) {
    const database = getDatabase();
    const patient = database.patients.find((item) => item.userId === userId || item.email === userId);
    if (!patient) return [];
    return database.bookings
      .filter((booking) => booking.patientId === patient.id)
      .map((booking) => ({
        id: booking.id,
        patientId: booking.patientId,
        serviceId: booking.serviceId,
        serviceName: database.services.find((service) => service.id === booking.serviceId)?.name ?? 'Service',
        doctorId: booking.doctorId,
        doctorName: database.users.find((doctor) => doctor.id === booking.doctorId)?.fullName ?? null,
        preferredDate: booking.preferredDate,
        preferredTime: booking.preferredTime,
        status: booking.status,
        intakeNotes: booking.intakeNotes,
        createdAt: booking.createdAt,
      }));
  }

  const client = requireSupabase();
  const patient = await getCurrentPatient(userId);
  if (!patient) {
    return [];
  }

  const [{ data: bookings, error }, services, doctors] = await Promise.all([
    client.from('bookings').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false }),
    getBookableServicesLiveOrDemo(),
    getDoctorDirectoryLiveOrDemo(),
  ]);

  if (error) {
    throw error;
  }

  const serviceMap = new Map(services.map((service) => [service.id, service.name]));
  const doctorMap = new Map(doctors.map((doctor) => [doctor.id, doctor.fullName]));

  return ((bookings ?? []) as BookingRow[]).map((booking) => ({
    id: booking.id,
    patientId: booking.patient_id,
    serviceId: booking.service_id,
    serviceName: serviceMap.get(booking.service_id) ?? 'Service',
    doctorId: booking.doctor_id,
    doctorName: booking.doctor_id ? doctorMap.get(booking.doctor_id) ?? null : null,
    preferredDate: booking.preferred_date,
    preferredTime: booking.preferred_time,
    status: booking.status,
    intakeNotes: booking.intake_notes,
    createdAt: booking.created_at,
  }));
}

export async function createBookingLiveOrDemo(input: {
  patientId: string;
  serviceId: string;
  doctorId: string | null;
  preferredDate: string;
  preferredTime: string;
  intakeNotes: string;
}) {
  if (!isSupabaseConfigured) {
    const { createBooking } = await import('./local-db');
    return createBooking({
      patientId: input.patientId,
      serviceId: input.serviceId,
      doctorId: input.doctorId ?? '',
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime,
      intakeNotes: input.intakeNotes,
    });
  }

  const client = requireSupabase();
  const payload: Database['public']['Tables']['bookings']['Insert'] = {
    patient_id: input.patientId,
    service_id: input.serviceId,
    doctor_id: input.doctorId,
    preferred_date: input.preferredDate,
    preferred_time: input.preferredTime,
    intake_notes: input.intakeNotes,
    status: 'pending',
  };

  const { data, error } = await client.from('bookings').insert(payload as never).select('*').single();
  if (error) {
    throw error;
  }

  return data;
}

export async function verifyOdcCredentialLiveOrDemo(input: OdcCredentialInput) {
  const normalized = normalizeOdcCredential(input);
  if (!normalized.accessKey && !normalized.recoveryPassword) {
    return false;
  }

  if (!isSupabaseConfigured) {
    return normalized.accessKey === odcAccessConfig.demoAccessKey;
  }

  const data = await invokeOdcFunction<OdcVerifyResponse>({
    mode: 'verify',
    ...normalized,
  });

  return data.valid === true;
}

export async function updateSystemControlLiveOrDemo(
  input: OdcCredentialInput & {
    systemEnabled: boolean;
    systemMessage: string;
  },
) {
  const normalized = normalizeOdcCredential(input);

  if (!isSupabaseConfigured) {
    if (normalized.accessKey !== odcAccessConfig.demoAccessKey) {
      throw new Error('Invalid ODC credential.');
    }

    const { updateClinicSettings } = await import('./local-db');
    return updateClinicSettings({
      systemEnabled: input.systemEnabled,
      systemMessage: input.systemMessage,
    });
  }

  const data = await invokeOdcFunction<OdcUpdateResponse>({
    mode: 'update',
    ...normalized,
    systemEnabled: input.systemEnabled,
    systemMessage: input.systemMessage,
  });

  if (!data.clinicSettings) {
    throw new Error('System control update did not return clinic settings.');
  }

  return mapClinicSettings(data.clinicSettings);
}



