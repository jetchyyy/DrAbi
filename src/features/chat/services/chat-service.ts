import { getDatabase } from '../../../lib/local-db';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';

export interface ChatContact {
  id: string;
  fullName: string;
  role: 'patient' | 'specialist';
  source: 'appointment' | 'referral';
}

export interface DirectThread {
  id: string;
  participantA: string;
  participantB: string;
  linkedAppointmentId: string | null;
  linkedReferralId: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
}

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

function dedupeContacts(contacts: ChatContact[]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    if (seen.has(contact.id)) {
      return false;
    }

    seen.add(contact.id);
    return true;
  });
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

async function getDoctorIdByProfileId(userId: string) {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('doctors').select('id').eq('profile_id', userId).maybeSingle();

  if (error) {
    throw error;
  }

  return (data as { id: string } | null)?.id ?? null;
}

export const chatService = {
  async getDerivedContacts(userId: string) {
    if (!userId) {
      return [];
    }

    if (!isSupabaseConfigured) {
      const database = getDatabase();
      const doctor = database.users.find((item) => item.id === userId && item.role === 'doctor');
      if (!doctor) {
        return [];
      }

      const appointmentContacts = database.appointments
        .filter((appointment) => appointment.doctorId === doctor.id && ['confirmed', 'completed'].includes(appointment.status))
        .map((appointment) => {
          const patient = database.patients.find((item) => item.id === appointment.patientId);
          if (!patient) {
            return null;
          }

          return {
            id: patient.userId ?? patient.id,
            fullName: `${patient.firstName} ${patient.lastName}`,
            role: 'patient' as const,
            source: 'appointment' as const,
          };
        })
        .filter(isDefined);

      const referralContacts = database.referrals
        .filter((referral) => {
          if (!['accepted', 'completed'].includes(referral.status)) {
            return false;
          }

          return referral.referringDoctorId === doctor.id || referral.targetDoctorId === doctor.id;
        })
        .map((referral) => {
          const counterpartDoctorId = referral.referringDoctorId === doctor.id ? referral.targetDoctorId : referral.referringDoctorId;
          const counterpart = database.users.find((item) => item.id === counterpartDoctorId && item.role === 'doctor');
          if (!counterpart) {
            return null;
          }

          return {
            id: counterpart.id,
            fullName: counterpart.fullName,
            role: 'specialist' as const,
            source: 'referral' as const,
          };
        })
        .filter(isDefined);

      return dedupeContacts([...appointmentContacts, ...referralContacts]);
    }

    const client = requireSupabaseClient();
    const doctorId = await getDoctorIdByProfileId(userId);
    if (!doctorId) {
      return [];
    }

    const { data: appointmentRows, error: appointmentError } = await client
      .from('appointments')
      .select('patient_id')
      .eq('doctor_id', doctorId)
      .in('status', ['confirmed', 'completed']);

    if (appointmentError) {
      throw appointmentError;
    }

    const patientIds = [...new Set(((appointmentRows ?? []) as Array<{ patient_id: string | null }>).map((row) => row.patient_id).filter(Boolean))] as string[];

    const { data: patientRows, error: patientError } = patientIds.length
      ? await client.from('patients').select('id, user_id, first_name, last_name').in('id', patientIds)
      : { data: [], error: null };

    if (patientError) {
      throw patientError;
    }

    const appointmentContacts = ((patientRows ?? []) as Array<{ id: string; user_id: string | null; first_name: string; last_name: string }>).map((patient) => ({
      id: patient.user_id ?? patient.id,
      fullName: `${patient.first_name} ${patient.last_name}`,
      role: 'patient' as const,
      source: 'appointment' as const,
    }));

    const { data: referralRows, error: referralError } = await client
      .from('referrals')
      .select('referring_generalist_id, assigned_specialist_id, referring_doctor_id, target_doctor_id, status')
      .in('status', ['accepted', 'confirmed', 'completed'])
      .or(`referring_generalist_id.eq.${doctorId},assigned_specialist_id.eq.${doctorId},referring_doctor_id.eq.${doctorId},target_doctor_id.eq.${doctorId}`);

    if (referralError) {
      throw referralError;
    }

    const counterpartDoctorIds = [...new Set(
      ((referralRows ?? []) as Array<{
        referring_generalist_id: string | null;
        assigned_specialist_id: string | null;
        referring_doctor_id: string | null;
        target_doctor_id: string | null;
      }>).flatMap((row) => {
        const sourceDoctor = row.referring_generalist_id ?? row.referring_doctor_id;
        const targetDoctor = row.assigned_specialist_id ?? row.target_doctor_id;

        if (sourceDoctor === doctorId) {
          return targetDoctor ? [targetDoctor] : [];
        }

        if (targetDoctor === doctorId) {
          return sourceDoctor ? [sourceDoctor] : [];
        }

        return [];
      }),
    )];

    const { data: doctorRows, error: doctorError } = counterpartDoctorIds.length
      ? await client.from('doctors').select('id, profile_id').in('id', counterpartDoctorIds)
      : { data: [], error: null };

    if (doctorError) {
      throw doctorError;
    }

    const profileIds = ((doctorRows ?? []) as Array<{ id: string; profile_id: string }>).map((row) => row.profile_id);
    const { data: profileRows, error: profileError } = profileIds.length
      ? await client.from('profiles').select('id, full_name').in('id', profileIds)
      : { data: [], error: null };

    if (profileError) {
      throw profileError;
    }

    const profileMap = new Map(((profileRows ?? []) as Array<{ id: string; full_name: string }>).map((row) => [row.id, row.full_name]));

    const referralContacts = ((doctorRows ?? []) as Array<{ id: string; profile_id: string }>).map((doctor) => ({
      id: doctor.profile_id,
      fullName: profileMap.get(doctor.profile_id) ?? 'Specialist',
      role: 'specialist' as const,
      source: 'referral' as const,
    }));

    return dedupeContacts([...appointmentContacts, ...referralContacts]);
  },

  async openOrCreateThread(input: {
    currentUserId: string;
    contactUserId: string;
    linkedReferralId?: string | null;
    linkedAppointmentId?: string | null;
  }): Promise<string> {
    if (!isSupabaseConfigured) {
      return [input.currentUserId, input.contactUserId].sort().join('_');
    }

    const client = requireSupabaseClient();
    const { data, error } = await (client as any).rpc('ensure_direct_thread', {
      participant_1: input.currentUserId,
      participant_2: input.contactUserId,
      linked_referral_id: input.linkedReferralId ?? null,
      linked_appointment_id: input.linkedAppointmentId ?? null,
    });

    if (error) {
      throw error;
    }

    const threadId = typeof data === 'string' ? data : Array.isArray(data) ? data[0] : null;
    if (!threadId) {
      throw new Error('Unable to open or create a direct thread.');
    }

    return threadId;
  },

  async listThreadsForUser(userId: string): Promise<DirectThread[]> {
    if (!userId || !isSupabaseConfigured) {
      return [];
    }

    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('chat_threads')
      .select('*')
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<{
      id: string;
      participant_a: string;
      participant_b: string;
      linked_appointment_id: string | null;
      linked_referral_id: string | null;
      last_message_text: string | null;
      last_message_at: string | null;
    }>).map((row) => ({
      id: row.id,
      participantA: row.participant_a,
      participantB: row.participant_b,
      linkedAppointmentId: row.linked_appointment_id,
      linkedReferralId: row.linked_referral_id,
      lastMessageText: row.last_message_text,
      lastMessageAt: row.last_message_at,
    }));
  },
};
