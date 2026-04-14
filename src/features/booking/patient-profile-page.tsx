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
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <div className="flex items-center gap-3">
          <div className="rounded-none bg-orange-600 p-3 text-white">
            <UserRound className="size-5" />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">My Profile</p>
            <CardTitle className="mt-1">Patient account details</CardTitle>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={profileForm.handleSubmit(async (values) => profileMutation.mutateAsync(values))}>
          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
            <div className="flex items-center gap-2 text-orange-700">
              <QrCode className="size-4" />
              <p className="text-xs font-extrabold uppercase tracking-[0.18em]">Patient QR Code</p>
            </div>
            <p className="mt-2 text-sm text-slate-600">Show this QR at the clinic front desk when requested.</p>
            <div className="mt-3 flex justify-center rounded-xl bg-white p-4">
              {patientQrSvg ? (
                <div
                  aria-label="Patient QR code"
                  className="size-[200px]"
                  dangerouslySetInnerHTML={{ __html: patientQrSvg }}
                />
              ) : (
                <div className="flex size-[200px] items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 text-center text-sm text-slate-500">
                  QR code is not available yet.
                </div>
              )}
            </div>
            {currentPatient?.qrCode ? (
              <p className="mt-3 break-all text-center font-mono text-xs font-semibold text-slate-700">{currentPatient.qrCode}</p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField hint="Full name is locked for patient records." label="Full name">
              <Input disabled value={profile?.fullName ?? ''} />
            </FormField>
            <FormField hint="Email is shown for reference." label="Email address">
              <Input disabled value={profile?.email ?? ''} />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField error={profileForm.formState.errors.mobileNumber?.message} label="Mobile number">
              <Input {...profileForm.register('mobileNumber')} />
            </FormField>
            <FormField error={profileForm.formState.errors.address?.message} label="Address">
              <Input {...profileForm.register('address')} />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField error={profileForm.formState.errors.emergencyContactName?.message} label="Emergency contact name">
              <Input {...profileForm.register('emergencyContactName')} />
            </FormField>
            <FormField error={profileForm.formState.errors.emergencyContactPhone?.message} label="Emergency contact phone">
              <Input {...profileForm.register('emergencyContactPhone')} />
            </FormField>
          </div>

          <FormField error={profileForm.formState.errors.allergies?.message} label="Allergies">
            <Textarea className="rounded-none" {...profileForm.register('allergies')} />
          </FormField>

          <FormField error={profileForm.formState.errors.medicalHistory?.message} label="Medical history">
            <Textarea className="rounded-none" {...profileForm.register('medicalHistory')} />
          </FormField>

          <Button className="rounded-none bg-orange-600 px-6 py-3 font-extrabold uppercase tracking-widest hover:bg-orange-700" disabled={profileMutation.isPending} type="submit">
            {profileMutation.isPending ? 'Saving...' : 'Save profile'}
          </Button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <div className="rounded-none bg-slate-900 p-3 text-white">
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

          <Button className="rounded-none px-6 py-3 font-extrabold uppercase tracking-widest" disabled={passwordMutation.isPending} type="submit" variant="secondary">
            {passwordMutation.isPending ? 'Updating...' : 'Update password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
