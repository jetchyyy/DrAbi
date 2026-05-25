import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LockKeyhole, QrCode, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { z } from 'zod';

import { queryClient } from '../../app/query-client';
import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { queryKeys } from '../../lib/query-keys';
import { updateCurrentUserPasswordLiveOrDemo, updatePatientAccountLiveOrDemo } from '../../lib/supabase-clinic';
import { useAuth } from '../auth/auth-context';
import { useCurrentPatient } from './hooks/use-bookings';

const profileSchema = z.object({
  mobileNumber: z.string().min(5, 'Mobile number is required.'),
  address: z.string().min(4, 'Address is required.'),
  allergies: z.string(),
  medicalHistory: z.string(),
  emergencyContactName: z.string().min(2, 'Emergency contact name is required.'),
  emergencyContactPhone: z.string().min(5, 'Emergency contact phone is required.'),
});

const passwordSchema = z
  .object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters.'),
    confirmPassword: z.string().min(6, 'Please confirm your password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export function PatientProfilePage() {
  const { profile, session } = useAuth();
  const { data: currentPatient } = useCurrentPatient(session?.user.id ?? null, profile?.email);
  const [patientQrSvg, setPatientQrSvg] = useState('');

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      mobileNumber: '',
      address: '',
      allergies: '',
      medicalHistory: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!currentPatient) {
      return;
    }

    profileForm.reset({
      mobileNumber: currentPatient.mobileNumber ?? '',
      address: currentPatient.address ?? '',
      allergies: currentPatient.allergies ?? '',
      medicalHistory: currentPatient.medicalHistory ?? '',
      emergencyContactName: currentPatient.emergencyContactName ?? '',
      emergencyContactPhone: currentPatient.emergencyContactPhone ?? '',
    });
  }, [currentPatient, profileForm]);

  useEffect(() => {
    const qrValue = currentPatient?.qrCode?.trim();
    if (!qrValue) {
      setPatientQrSvg('');
      return;
    }

    let active = true;
    void QRCode.toString(qrValue, {
      errorCorrectionLevel: 'M',
      margin: 1,
      type: 'svg',
      width: 200,
    })
      .then((svg: string) => {
        if (active) {
          setPatientQrSvg(svg);
        }
      })
      .catch(() => {
        if (active) {
          setPatientQrSvg('');
        }
      });

    return () => {
      active = false;
    };
  }, [currentPatient?.qrCode]);

  const profileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!profile?.id) {
        throw new Error('User profile not found.');
      }
      return updatePatientAccountLiveOrDemo(profile.id, values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.currentPatient(session?.user.id ?? profile?.email ?? null) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.currentProfile(profile?.id ?? null) });
      toast.success('Profile updated.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to update profile.');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (values: PasswordFormValues) => updateCurrentUserPasswordLiveOrDemo(values.newPassword),
    onSuccess: () => {
      passwordForm.reset();
      toast.success('Password updated.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to update password.');
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <section className="relative overflow-hidden border border-slate-200 bg-white p-6 shadow-sm animate-slide-left">
        <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-orange-200/50 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="border-l-4 border-orange-600 pl-4">
            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-950">
              My profile
            </h1>
            <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
              Manage your personal details, emergency contact, and security settings in one place.
            </p>
          </div>
          <div className="grid min-w-[260px] gap-2 text-right">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient account</p>
            <p className="text-base font-extrabold text-slate-900">{profile?.fullName ?? 'Not available'}</p>
            <p className="truncate text-xs font-semibold text-slate-500">{profile?.email ?? 'Not available'}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 animate-fade-up">
        <div className="border border-orange-200 bg-orange-50 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-700">Identity</p>
          <p className="mt-1 text-sm font-extrabold text-orange-900">Verified patient profile</p>
        </div>
        <div className="border border-red-200 bg-red-50 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-red-700">Contact</p>
          <p className="mt-1 text-sm font-extrabold text-red-900">Keep details current for reminders</p>
        </div>
        <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Security</p>
          <p className="mt-1 text-sm font-extrabold text-emerald-900">Password update available</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <div className="flex items-center gap-3 border-l-4 border-orange-600 pl-3">
            <div className="rounded-xl bg-orange-600 p-3 text-white">
              <UserRound className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Profile editor</p>
              <CardTitle className="mt-1">Patient account details</CardTitle>
            </div>
          </div>

          <form className="mt-6 space-y-5" onSubmit={profileForm.handleSubmit(async (values) => profileMutation.mutateAsync(values))}>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Identity (Read-only)</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <FormField hint="Full name is locked for patient records." label="Full name">
                  <Input disabled value={profile?.fullName ?? ''} />
                </FormField>
                <FormField hint="Email is shown for reference." label="Email address">
                  <Input disabled value={profile?.email ?? ''} />
                </FormField>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Contact information</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <FormField error={profileForm.formState.errors.mobileNumber?.message} label="Mobile number">
                  <Input {...profileForm.register('mobileNumber')} />
                </FormField>
                <FormField error={profileForm.formState.errors.address?.message} label="Address">
                  <Input {...profileForm.register('address')} />
                </FormField>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Emergency contact</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <FormField error={profileForm.formState.errors.emergencyContactName?.message} label="Emergency contact name">
                  <Input {...profileForm.register('emergencyContactName')} />
                </FormField>
                <FormField error={profileForm.formState.errors.emergencyContactPhone?.message} label="Emergency contact phone">
                  <Input {...profileForm.register('emergencyContactPhone')} />
                </FormField>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Health notes</p>
              <div className="mt-3 space-y-4">
                <FormField error={profileForm.formState.errors.allergies?.message} label="Allergies">
                  <Textarea {...profileForm.register('allergies')} />
                </FormField>

                <FormField error={profileForm.formState.errors.medicalHistory?.message} label="Medical history">
                  <Textarea {...profileForm.register('medicalHistory')} />
                </FormField>
              </div>
            </div>

            <Button className="rounded-xl bg-orange-600 px-6 py-3 font-extrabold uppercase tracking-widest hover:bg-orange-700" disabled={profileMutation.isPending} type="submit">
              {profileMutation.isPending ? 'Saving...' : 'Save profile'}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-3 border-l-4 border-orange-500 pl-3">
              <div className="rounded-xl bg-orange-600 p-3 text-white">
                <QrCode className="size-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Patient QR</p>
                <CardTitle className="mt-1">Clinic check-in code</CardTitle>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600">
              Show this QR at the clinic front desk when requested.
            </p>

            <div className="mt-4 flex justify-center border border-orange-100 bg-orange-50 p-4">
              {patientQrSvg ? (
                <div
                  aria-label="Patient QR code"
                  className="size-[200px] bg-white p-2"
                  dangerouslySetInnerHTML={{ __html: patientQrSvg }}
                />
              ) : (
                <div className="flex size-[200px] items-center justify-center border border-dashed border-slate-300 bg-white px-4 text-center text-sm text-slate-500">
                  QR code is not available yet.
                </div>
              )}
            </div>

            {currentPatient?.qrCode ? (
              <p className="mt-3 break-all text-center font-mono text-xs font-semibold text-slate-700">{currentPatient.qrCode}</p>
            ) : null}
          </Card>

          <Card>
            <div className="flex items-center gap-3 border-l-4 border-slate-800 pl-3">
              <div className="rounded-xl bg-slate-900 p-3 text-white">
                <LockKeyhole className="size-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Security</p>
                <CardTitle className="mt-1">Change password</CardTitle>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={passwordForm.handleSubmit(async (values) => passwordMutation.mutateAsync(values))}>
              <FormField error={passwordForm.formState.errors.newPassword?.message} label="New password">
                <Input type="password" {...passwordForm.register('newPassword')} />
              </FormField>

              <FormField error={passwordForm.formState.errors.confirmPassword?.message} label="Confirm new password">
                <Input type="password" {...passwordForm.register('confirmPassword')} />
              </FormField>

              <p className="text-sm text-slate-500">
                You can update your password here at any time. Your patient name stays fixed to protect the integrity of medical records.
              </p>

              <Button className="rounded-xl px-6 py-3 font-extrabold uppercase tracking-widest" disabled={passwordMutation.isPending} type="submit" variant="secondary">
                {passwordMutation.isPending ? 'Updating...' : 'Update password'}
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}
