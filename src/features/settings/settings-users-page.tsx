import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { roleLabels, rolePermissions } from '../../config/permissions';
import { createAdminUserLiveOrDemo, listUsersLiveOrDemo } from '../../lib/supabase-clinic';
import { isSupabaseConfigured } from '../../lib/supabase';
import type { AdminCreateUserInput, Role } from '../../types/domain';

const staffRoleOptions = [
  'owner_admin',
  'doctor',
  'nurse_staff',
  'front_desk_cashier',
  'lab_staff',
  'inventory_staff',
] as const satisfies ReadonlyArray<Exclude<Role, 'patient'>>;

const PASSWORD_RULES_HINT = 'At least 6 characters, with uppercase, lowercase, and a number.';

const userSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required.'),
    lastName: z.string().trim().min(1, 'Last name is required.'),
    contactNumber: z.string().trim().min(1, 'Contact number is required.'),
    email: z.string().email('Enter a valid email address.'),
    password: z.string(),
    confirmPassword: z.string(),
    role: z.enum(staffRoleOptions),
    prcLicenseNumber: z.string().optional(),
    prcLicenseExpiry: z.string().optional(),
    birNumber: z.string().optional(),
    consultationFee: z.number().min(0, 'Consultation fee must be 0 or higher.').optional(),
    followUpFee: z.number().min(0, 'Follow-up fee must be 0 or higher.').optional(),
    prcIdFile: z.any().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.password.length < 6 || !/[A-Z]/.test(value.password) || !/[a-z]/.test(value.password) || !/\d/.test(value.password)) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: PASSWORD_RULES_HINT,
      });
    }

    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }

    if (value.role !== 'doctor') {
      return;
    }

    if (!value.prcLicenseNumber?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['prcLicenseNumber'],
        message: 'PRC license number is required for doctors.',
      });
    }

    if (!value.prcLicenseExpiry?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['prcLicenseExpiry'],
        message: 'PRC license expiry is required for doctors.',
      });
    }

    if (!value.birNumber?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['birNumber'],
        message: 'BIR number is required for doctors.',
      });
    }

    if (typeof value.consultationFee !== 'number' || Number.isNaN(value.consultationFee)) {
      ctx.addIssue({
        code: 'custom',
        path: ['consultationFee'],
        message: 'Consultation fee is required for doctors.',
      });
    }

    if (typeof value.followUpFee !== 'number' || Number.isNaN(value.followUpFee)) {
      ctx.addIssue({
        code: 'custom',
        path: ['followUpFee'],
        message: 'Follow-up fee is required for doctors.',
      });
    }

    const files = value.prcIdFile as FileList | File[] | undefined;
    const file =
      typeof FileList !== 'undefined' && files instanceof FileList
        ? files.item(0)
        : Array.isArray(files)
          ? files[0]
          : undefined;
    if (!file) {
      ctx.addIssue({
        code: 'custom',
        path: ['prcIdFile'],
        message: 'Upload PRC ID is required for doctors.',
      });
    }
  });

type UserFormValues = z.infer<typeof userSchema>;

function getSelectedFile(value: UserFormValues['prcIdFile']) {
  if (typeof FileList !== 'undefined' && value instanceof FileList) {
    return value.item(0);
  }
  if (Array.isArray(value)) {
    return typeof File !== 'undefined' && value[0] instanceof File ? value[0] : null;
  }
  return typeof File !== 'undefined' && value instanceof File ? value : null;
}

function toCreateUserInput(values: UserFormValues): AdminCreateUserInput {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    contactNumber: values.contactNumber.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    role: values.role,
    prcLicenseNumber: values.role === 'doctor' ? values.prcLicenseNumber?.trim() ?? '' : undefined,
    prcLicenseExpiry: values.role === 'doctor' ? values.prcLicenseExpiry?.trim() ?? '' : undefined,
    birNumber: values.role === 'doctor' ? values.birNumber?.trim() ?? '' : undefined,
    consultationFee: values.role === 'doctor' ? values.consultationFee ?? 0 : undefined,
    followUpFee: values.role === 'doctor' ? values.followUpFee ?? 0 : undefined,
    prcIdFile: values.role === 'doctor' ? getSelectedFile(values.prcIdFile) : null,
  };
}

export function SettingsUsersPage() {
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ['settings-users'], queryFn: listUsersLiveOrDemo });
  const createUserMutation = useMutation({
    mutationFn: createAdminUserLiveOrDemo,
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
      toast.success(`${roleLabels[user.role]} account created for ${user.fullName}.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to create account.');
    },
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      contactNumber: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'nurse_staff',
      prcLicenseNumber: '',
      prcLicenseExpiry: '',
      birNumber: '',
      consultationFee: 0,
      followUpFee: 0,
    },
  });

  const selectedRole = useWatch({ control: form.control, name: 'role' });
  const isDoctor = selectedRole === 'doctor';

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <Card>
          <CardTitle>User management CMS</CardTitle>
          <p className="mt-3 text-sm text-slate-500">
            {isSupabaseConfigured
              ? 'Owner/admin can create staff accounts here, set the initial password, and bypass email verification for those admin-created users.'
              : 'Demo mode can add users directly so you can validate role-aware navigation and staff directories.'}
          </p>
          <form
            className="mt-5 space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              await createUserMutation.mutateAsync(toCreateUserInput(values));
              form.reset({
                firstName: '',
                lastName: '',
                contactNumber: '',
                email: '',
                password: '',
                confirmPassword: '',
                role: 'nurse_staff',
                prcLicenseNumber: '',
                prcLicenseExpiry: '',
                birNumber: '',
                consultationFee: 0,
                followUpFee: 0,
                prcIdFile: undefined,
              });
            })}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField error={form.formState.errors.firstName?.message} label="First Name">
                <Input {...form.register('firstName')} />
              </FormField>
              <FormField error={form.formState.errors.lastName?.message} label="Last Name">
                <Input {...form.register('lastName')} />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField error={form.formState.errors.contactNumber?.message} label="Contact Number">
                <Input {...form.register('contactNumber')} />
              </FormField>
              <FormField error={form.formState.errors.email?.message} label="Email Address">
                <Input type="email" {...form.register('email')} />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                error={form.formState.errors.password?.message}
                hint={PASSWORD_RULES_HINT}
                label="Password"
              >
                <Input type="password" {...form.register('password')} />
              </FormField>
              <FormField error={form.formState.errors.confirmPassword?.message} label="Confirm Password">
                <Input type="password" {...form.register('confirmPassword')} />
              </FormField>
            </div>
            <FormField error={form.formState.errors.role?.message} label="Role">
              <Select {...form.register('role')}>
                {staffRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </Select>
            </FormField>

            {isDoctor ? (
              <div className="space-y-4 rounded-3xl border border-orange-200 bg-orange-50/50 p-4">
                <p className="text-sm font-semibold text-orange-900">Doctor account requirements</p>
                <p className="text-xs text-orange-700">The selected role must stay set to Doctor for these fields.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField error={form.formState.errors.prcLicenseNumber?.message} label="PRC License Number">
                    <Input {...form.register('prcLicenseNumber')} />
                  </FormField>
                  <FormField error={form.formState.errors.prcLicenseExpiry?.message} label="PRC License Expiry">
                    <Input type="date" {...form.register('prcLicenseExpiry')} />
                  </FormField>
                </div>
                <FormField error={form.formState.errors.birNumber?.message} label="BIR Number">
                  <Input {...form.register('birNumber')} />
                </FormField>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField error={form.formState.errors.consultationFee?.message} label="Consultation Fee">
                    <Input type="number" min="0" step="0.01" {...form.register('consultationFee', { valueAsNumber: true })} />
                  </FormField>
                  <FormField error={form.formState.errors.followUpFee?.message} label="Follow-up Fee">
                    <Input type="number" min="0" step="0.01" {...form.register('followUpFee', { valueAsNumber: true })} />
                  </FormField>
                </div>
                <FormField
                  error={form.formState.errors.prcIdFile?.message as string | undefined}
                  hint="Accepted formats: PDF, JPG, or PNG up to 5MB."
                  label="Upload PRC ID"
                >
                  <Input accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" type="file" {...form.register('prcIdFile')} />
                </FormField>
              </div>
            ) : null}

            <Button className="w-full" disabled={createUserMutation.isPending} type="submit">
              {createUserMutation.isPending ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Users</CardTitle>
          <div className="mt-5 space-y-4">
            {users.map((user) => (
              <div key={user.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{user.fullName}</p>
                    <p className="text-sm text-slate-500">{user.email}</p>
                    <p className="mt-1 text-sm text-slate-500">{user.phone || 'No contact number set'}</p>
                  </div>
                  <Badge>{roleLabels[user.role]}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <CardTitle>Role matrix</CardTitle>
        <div className="mt-5 space-y-4">
          {Object.entries(rolePermissions)
            .filter(([role]) => role !== 'patient')
            .map(([role, permissions]) => (
              <div key={role} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-950">{roleLabels[role as Role]}</p>
                <p className="mt-2 text-sm text-slate-500">{permissions.join(', ')}</p>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
