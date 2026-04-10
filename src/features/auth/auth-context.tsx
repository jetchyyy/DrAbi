import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { rolePermissions } from '../../config/permissions';
import { getDatabase } from '../../lib/local-db';
import { queryClient } from '../../app/query-client';
import { queryKeys } from '../../lib/query-keys';
import { ensureDoctorForUser, ensurePatientForUser, ensureProfileForUser, getCurrentProfile } from '../../lib/supabase-clinic';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { Permission, Role, UserProfile } from '../../types/domain';

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  profile: UserProfile | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  signUpPatient: (input: {
    fullName: string;
    email: string;
    password: string;
    phone: string;
    birthDate: string;
    sex: 'male' | 'female' | 'other';
    address: string;
    allergies: string;
    medicalHistory: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  }) => Promise<{ requiresEmailConfirmation: boolean }>;
  can: (permission: Permission) => boolean;
}

const DEMO_AUTH_KEY = 'odyssey-clinic-demo-auth';
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function roleFromEmail(email: string): Role {
  if (email.startsWith('doctor')) return 'doctor';
  if (email.startsWith('frontdesk')) return 'front_desk_cashier';
  if (email.startsWith('lab')) return 'lab_staff';
  if (email.startsWith('inventory')) return 'inventory_staff';
  if (email.startsWith('patient')) return 'patient';
  return 'owner_admin';
}

function getStoredDemoEmail() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(DEMO_AUTH_KEY);
}

function getDemoProfile(email: string, user?: User | null) {
  const matchedProfile = getDatabase().users.find((profile) => profile.email.toLowerCase() === email.toLowerCase());
  if (matchedProfile) {
    return matchedProfile;
  }

  return {
    id: `profile_${email}`,
    authUserId: user?.id ?? `demo_${email}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    email,
    fullName: email.split('@')[0].replaceAll('.', ' '),
    role: (user?.app_metadata.role as Role | undefined) ?? roleFromEmail(email),
    phone: '',
  } satisfies UserProfile;
}

async function resolveLiveProfile(user: User) {
  let profile = await getCurrentProfile(user.id);
  if (!profile) {
    profile = await ensureProfileForUser(user);
  }

  const userRole = (user.user_metadata.role as string | undefined) ?? profile?.role ?? 'patient';
  if (userRole === 'doctor') {
    await ensureDoctorForUser(user);
  }
  if (userRole === 'patient') {
    await ensurePatientForUser(user);
  }

  return profile;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const storedEmail = getStoredDemoEmail();
    return storedEmail ? getDemoProfile(storedEmail) : null;
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return undefined;
    }

    const hydrate = async (nextSession: Session | null) => {
      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await resolveLiveProfile(nextSession.user);
        setProfile(nextProfile);
        await queryClient.invalidateQueries({ queryKey: queryKeys.currentProfile(nextSession.user.id) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.currentPatient(nextSession.user.id) });
      } finally {
        setLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data }) => hydrate(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void hydrate(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = profile ? rolePermissions[profile.role] : [];

    return {
      loading,
      session,
      profile,
      permissions,
      isAuthenticated: Boolean(profile ?? session),
      async signIn(email, password) {
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            throw error;
          }
          return;
        }

        if (!password) {
          throw new Error('Password is required.');
        }

        window.localStorage.setItem(DEMO_AUTH_KEY, email);
        setProfile(getDemoProfile(email));
      },
      async signOut() {
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
        }

        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(DEMO_AUTH_KEY);
        }
        setSession(null);
        setProfile(null);
      },
      async requestPasswordReset(email) {
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });
          if (error) throw error;
          return;
        }

        if (!getDatabase().users.some((item) => item.email === email)) {
          return;
        }
      },
      async signUpPatient(input) {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.auth.signUp({
            email: input.email,
            password: input.password,
            options: {
              data: {
                role: 'patient',
                full_name: input.fullName,
                phone: input.phone,
                birth_date: input.birthDate,
                sex: input.sex,
                address: input.address,
                allergies: input.allergies,
                medical_history: input.medicalHistory,
                emergency_contact_name: input.emergencyContactName,
                emergency_contact_phone: input.emergencyContactPhone,
              },
            },
          });
          if (error) throw error;
          return { requiresEmailConfirmation: !data.session };
        }

        const existing = getDatabase().patients.find((patient) => patient.email.toLowerCase() === input.email.toLowerCase());
        if (!existing) {
          const { createPatientProfileAccount } = await import('../../lib/local-db');
          const [firstName, ...rest] = input.fullName.split(' ');
          createPatientProfileAccount(
            {
              authUserId: `demo_${input.email}`,
              email: input.email,
              fullName: input.fullName,
              role: 'patient',
              phone: input.phone,
            },
            {
              userId: null,
              qrCode: '',
              intakeSource: 'online_registration',
              visitStatus: 'registered_no_visit',
              firstName,
              lastName: rest.join(' ') || 'Patient',
              sex: input.sex,
              birthDate: input.birthDate,
              mobileNumber: input.phone,
              email: input.email,
              address: input.address,
              bloodType: '',
              allergies: input.allergies,
              medicalHistory: input.medicalHistory,
              emergencyContactName: input.emergencyContactName,
              emergencyContactPhone: input.emergencyContactPhone,
            },
          );
        }
        window.localStorage.setItem(DEMO_AUTH_KEY, input.email);
        setProfile(getDemoProfile(input.email));
        return { requiresEmailConfirmation: false };
      },
      can(permission) {
        return permissions.includes(permission);
      },
    };
  }, [loading, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}






