import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { rolePermissions } from '../../config/permissions';
import { applyUserAccessRoleAssignment, applyUserPermissionOverride, getDatabase, hasUserPin, saveUserPin, verifyUserPin } from '../../lib/local-db';
import { queryClient } from '../../app/query-client';
import { queryKeys } from '../../lib/query-keys';
import { ensureDoctorForUser, ensurePatientForUser, ensureProfileForUser, getCurrentProfile } from '../../lib/supabase-clinic';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { hashSecret } from '../../lib/utils';
import type { Permission, Role, UserProfile } from '../../types/domain';

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  profile: UserProfile | null;
  permissions: Permission[];
  hasSecurityPin: boolean;
  pinSetupRequired: boolean;
  pinVerificationRequired: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<Role>;
  signOut: () => Promise<void>;
  setSecurityPin: (pin: string) => Promise<void>;
  verifySecurityPin: (pin: string) => Promise<void>;
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
  if (email.startsWith('specialist')) return 'specialist';
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
    return applyUserPermissionOverride(applyUserAccessRoleAssignment(matchedProfile));
  }

  return applyUserPermissionOverride(applyUserAccessRoleAssignment({
    id: `profile_${email}`,
    authUserId: user?.id ?? `demo_${email}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    email,
    fullName: email.split('@')[0].replaceAll('.', ' '),
    role: (user?.app_metadata.role as Role | undefined) ?? roleFromEmail(email),
    phone: '',
  } satisfies UserProfile));
}

async function loadSecurityPinHash(profileId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('security_pin_hash')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const profileRow = (data ?? null) as { security_pin_hash: string | null } | null;
  return profileRow?.security_pin_hash ?? null;
}

async function loadHasSecurityPin(profile: UserProfile | null) {
  if (!profile) {
    return false;
  }

  if (!isSupabaseConfigured || !supabase) {
    return hasUserPin(profile);
  }

  return Boolean(await loadSecurityPinHash(profile.id));
}

async function saveSecurityPin(profile: UserProfile, pin: string) {
  if (!isSupabaseConfigured || !supabase) {
    await saveUserPin(profile, pin);
    return;
  }

  const securityPinHash = await hashSecret(pin);
  const { error } = await supabase
    .from('profiles')
    .update({
      security_pin_hash: securityPinHash,
      pin_updated_at: new Date().toISOString(),
    } as never)
    .eq('id', profile.id);

  if (error) {
    throw error;
  }
}

async function verifySecurityPinValue(profile: UserProfile, pin: string) {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('PIN must be exactly 6 digits.');
  }

  if (!isSupabaseConfigured || !supabase) {
    const pinMatches = await verifyUserPin(profile, pin);
    if (!pinMatches) {
      throw new Error('The security PIN you entered is incorrect.');
    }
    return;
  }

  const storedPinHash = await loadSecurityPinHash(profile.id);
  if (!storedPinHash) {
    throw new Error('No security PIN is set for this account yet.');
  }

  const providedPinHash = await hashSecret(pin);
  if (providedPinHash !== storedPinHash) {
    throw new Error('The security PIN you entered is incorrect.');
  }
}

async function resolveLiveProfile(user: User) {
  let profile = await getCurrentProfile(user.id);
  if (!profile) {
    profile = await ensureProfileForUser(user);
  }

  const userRole = (user.user_metadata.role as string | undefined) ?? profile?.role ?? 'patient';
  if (userRole === 'doctor' || userRole === 'specialist') {
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
  const [hasSecurityPin, setHasSecurityPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(true);
  const requirePinOnNextAuthenticatedSessionRef = useRef(false);
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
        setPinVerified(false);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await resolveLiveProfile(nextSession.user);
        if (!nextProfile) {
          throw new Error('Authenticated user profile could not be loaded.');
        }
        setProfile(nextProfile);
        const nextHasSecurityPin = await loadHasSecurityPin(nextProfile);
        setHasSecurityPin(nextHasSecurityPin);
        const shouldRequirePinVerification =
          requirePinOnNextAuthenticatedSessionRef.current && nextProfile.role !== 'patient' && nextHasSecurityPin;
        setPinVerified(!shouldRequirePinVerification);
        requirePinOnNextAuthenticatedSessionRef.current = false;
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

  useEffect(() => {
    if (!profile) {
      setHasSecurityPin(false);
      setPinVerified(false);
      return;
    }

    let cancelled = false;

    void loadHasSecurityPin(profile).then((value) => {
      if (!cancelled) {
        setHasSecurityPin(value);
        setPinVerified((currentValue) => {
          if (profile.role === 'patient' || !value) {
            return true;
          }

          return currentValue;
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = profile ? (profile.permissions ?? rolePermissions[profile.role]) : [];
    const pinSetupRequired = Boolean(profile && hasSecurityPin === false && profile.role !== 'patient');
    const pinVerificationRequired = Boolean(profile && hasSecurityPin && !pinVerified && profile.role !== 'patient');

    return {
      loading,
      session,
      profile,
      permissions,
      hasSecurityPin,
      pinSetupRequired,
      pinVerificationRequired,
      isAuthenticated: Boolean(profile ?? session),
      async signIn(email, password) {
        if (isSupabaseConfigured && supabase) {
          requirePinOnNextAuthenticatedSessionRef.current = true;
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            requirePinOnNextAuthenticatedSessionRef.current = false;
            throw error;
          }

          const sessionUser = data.user;
          if (!sessionUser) {
            return 'patient';
          }

          const nextProfile = await resolveLiveProfile(sessionUser);
          return nextProfile?.role ?? ((sessionUser.user_metadata.role as Role | undefined) ?? 'patient');
        }

        if (!password) {
          throw new Error('Password is required.');
        }

        window.localStorage.setItem(DEMO_AUTH_KEY, email);
        const nextProfile = getDemoProfile(email);
        setProfile(nextProfile);
        setHasSecurityPin(await hasUserPin(nextProfile));
        setPinVerified(nextProfile.role === 'patient' || !(await hasUserPin(nextProfile)));
        return nextProfile.role;
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
        setHasSecurityPin(false);
        setPinVerified(false);
      },
      async setSecurityPin(pin) {
        if (!profile) {
          throw new Error('You must be signed in to set a PIN.');
        }

        if (!/^\d{6}$/.test(pin)) {
          throw new Error('PIN must be exactly 6 digits.');
        }

        await saveSecurityPin(profile, pin);
        setHasSecurityPin(true);
        setPinVerified(true);
      },
      async verifySecurityPin(pin) {
        if (!profile) {
          throw new Error('You must be signed in to verify a PIN.');
        }

        await verifySecurityPinValue(profile, pin);
        setPinVerified(true);
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
        const nextProfile = getDemoProfile(input.email);
        setProfile(nextProfile);
        setHasSecurityPin(await hasUserPin(nextProfile));
        setPinVerified(true);
        return { requiresEmailConfirmation: false };
      },
      can(permission) {
        return permissions.includes(permission);
      },
    };
  }, [hasSecurityPin, loading, pinVerified, profile, session]);

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






