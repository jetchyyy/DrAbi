import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, LockKeyhole, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { queryClient } from '../../app/query-client';
import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { roleLabels } from '../../config/permissions';
import { queryKeys } from '../../lib/query-keys';
import { updateCurrentStaffProfileLiveOrDemo, updateCurrentUserPasswordLiveOrDemo } from '../../lib/supabase-clinic';
import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';

const profileSchema = z.object({
  phone: z.string().min(5, 'Contact number is required.'),
  title: z.string().optional(),
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

export function StaffProfilePage() {
  const { profile, setSecurityPin } = useAuth();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [activePinField, setActivePinField] = useState<'pin' | 'confirm'>('pin');
  const [pinError, setPinError] = useState('');
  const pinPadKeys = useMemo(() => ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const, []);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phone: '',
      title: '',
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
    if (!profile) {
      return;
    }

    profileForm.reset({
      phone: profile.phone ?? '',
      title: profile.title ?? '',
    });
  }, [profile, profileForm]);

  const profileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!profile?.id) {
        throw new Error('User profile not found.');
      }

      return updateCurrentStaffProfileLiveOrDemo(profile.id, values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.currentProfile(profile?.id ?? null) });
      await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
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

  const pinMutation = useMutation({
    mutationFn: async (nextPin: string) => setSecurityPin(nextPin),
    onSuccess: () => {
      setPin('');
      setConfirmPin('');
      setActivePinField('pin');
      setPinError('');
      toast.success('Security PIN updated.');
    },
    onError: (error) => {
      setPinError(error instanceof Error ? error.message : 'Unable to update PIN.');
    },
  });

  const handlePinDigit = (digit: string) => {
    if (pinError) setPinError('');

    if (activePinField === 'pin') {
      if (pin.length >= 6) return;
      const nextPin = `${pin}${digit}`;
      setPin(nextPin);
      if (nextPin.length === 6) {
        setActivePinField('confirm');
      }
      return;
    }

    if (confirmPin.length >= 6) return;
    setConfirmPin(`${confirmPin}${digit}`);
  };

  const handlePinBackspace = () => {
    if (pinError) setPinError('');

    if (activePinField === 'confirm') {
      if (confirmPin.length > 0) {
        setConfirmPin(confirmPin.slice(0, -1));
        return;
      }

      setActivePinField('pin');
    }

    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const handleSavePin = async () => {
    if (!/^\d{6}$/.test(pin)) {
      setPinError('PIN must be exactly 6 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setPinError('PIN entries do not match.');
      return;
    }

    await pinMutation.mutateAsync(pin);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card>
        <div className="flex items-center gap-3">
          <div className="rounded-none bg-orange-600 p-3 text-white">
            <UserRound className="size-5" />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">My Profile</p>
            <CardTitle className="mt-1">Staff account details</CardTitle>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={profileForm.handleSubmit(async (values) => profileMutation.mutateAsync(values))}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField hint="Your full name is shown from your account record." label="Full name">
              <Input disabled value={profile?.fullName ?? ''} />
            </FormField>
            <FormField hint="Email is used as your login." label="Email address">
              <Input disabled value={profile?.email ?? ''} />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField hint="This is your assigned staff role." label="Role">
              <Input disabled value={profile?.accessRoleName ?? (profile ? roleLabels[profile.role] : '')} />
            </FormField>
            <FormField error={profileForm.formState.errors.title?.message} label="Title">
              <Input placeholder="e.g. Staff Nurse, Cashier, Resident Doctor" {...profileForm.register('title')} />
            </FormField>
          </div>

          <FormField error={profileForm.formState.errors.phone?.message} label="Contact number">
            <Input {...profileForm.register('phone')} />
          </FormField>

          <p className="text-sm text-slate-500">
            Use this page to keep your own account details up to date. Your assigned access role is managed by the admin team.
          </p>

          <Button className="rounded-none bg-orange-600 px-6 py-3 font-extrabold uppercase tracking-widest hover:bg-orange-700" disabled={profileMutation.isPending} type="submit">
            {profileMutation.isPending ? 'Saving...' : 'Save profile'}
          </Button>
        </form>
      </Card>

      <div className="space-y-6">
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

            <Button className="rounded-none px-6 py-3 font-extrabold uppercase tracking-widest" disabled={passwordMutation.isPending} type="submit" variant="secondary">
              {passwordMutation.isPending ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-none bg-orange-600 p-3 text-white">
              <KeyRound className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Security</p>
              <CardTitle className="mt-1">Change security PIN</CardTitle>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className={cn(
                  'rounded-2xl border px-4 py-3 text-left transition-colors',
                  activePinField === 'pin' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-slate-50',
                )}
                onClick={() => setActivePinField('pin')}
                type="button"
              >
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">New PIN</p>
                <div className="mt-3 flex gap-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <span
                      className={cn(
                        'size-3 rounded-full border',
                        index < pin.length ? 'border-orange-600 bg-orange-600' : 'border-slate-300 bg-white',
                      )}
                      key={`staff-pin-dot-${index}`}
                    />
                  ))}
                </div>
              </button>

              <button
                className={cn(
                  'rounded-2xl border px-4 py-3 text-left transition-colors',
                  activePinField === 'confirm' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-slate-50',
                )}
                onClick={() => setActivePinField('confirm')}
                type="button"
              >
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Confirm PIN</p>
                <div className="mt-3 flex gap-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <span
                      className={cn(
                        'size-3 rounded-full border',
                        index < confirmPin.length ? 'border-orange-600 bg-orange-600' : 'border-slate-300 bg-white',
                      )}
                      key={`staff-confirm-pin-dot-${index}`}
                    />
                  ))}
                </div>
              </button>
            </div>

            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
              {activePinField === 'pin' ? 'Enter your new 6-digit PIN' : 'Re-enter your PIN to confirm'}
            </p>

            <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 justify-items-center gap-3">
              {pinPadKeys.slice(0, 9).map((digit) => (
                <button
                  className="flex size-16 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-extrabold text-slate-900 shadow-sm transition hover:border-orange-300 hover:bg-orange-50"
                  key={digit}
                  onClick={() => handlePinDigit(digit)}
                  type="button"
                >
                  {digit}
                </button>
              ))}
              <div className="size-16" />
              <button
                className="flex size-16 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-extrabold text-slate-900 shadow-sm transition hover:border-orange-300 hover:bg-orange-50"
                onClick={() => handlePinDigit('0')}
                type="button"
              >
                0
              </button>
              <button
                className="flex size-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-extrabold uppercase tracking-widest text-slate-600 shadow-sm transition hover:border-orange-300 hover:bg-orange-50"
                onClick={handlePinBackspace}
                type="button"
              >
                Delete
              </button>
            </div>

            {pinError ? <p className="text-sm font-medium text-rose-600">{pinError}</p> : null}

            <Button className="rounded-none bg-orange-600 px-6 py-3 font-extrabold uppercase tracking-widest hover:bg-orange-700" disabled={pinMutation.isPending} onClick={() => void handleSavePin()} type="button">
              {pinMutation.isPending ? 'Updating...' : 'Update PIN'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
