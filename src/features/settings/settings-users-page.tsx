import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { roleLabels, rolePermissions } from '../../config/permissions';
import { saveUserPermissionOverride } from '../../lib/local-db';
import {
  createAdminUserLiveOrDemo,
  deleteAdminUserLiveOrDemo,
  listUsersLiveOrDemo,
  updateAdminUserLiveOrDemo,
} from '../../lib/supabase-clinic';
import { isSupabaseConfigured } from '../../lib/supabase';
import type { AdminCreateUserInput, Permission, Role, UserProfile } from '../../types/domain';

const staffRoleOptions = [
  'owner_admin',
  'doctor',
  'nurse_staff',
  'front_desk_cashier',
  'lab_staff',
  'inventory_staff',
] as const satisfies ReadonlyArray<Exclude<Role, 'patient'>>;

const PASSWORD_RULES_HINT = 'At least 6 characters, with uppercase, lowercase, and a number.';
const permissionOptions = Array.from(new Set(Object.values(rolePermissions).flat())) as Permission[];

const userSchema = z
  .object({
    mode: z.enum(['create', 'edit']),
    firstName: z.string().trim().min(1, 'First name is required.'),
    lastName: z.string().trim().min(1, 'Last name is required.'),
    contactNumber: z.string().trim().min(1, 'Contact number is required.'),
    email: z.string().email('Enter a valid email address.'),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    role: z.enum(staffRoleOptions),
    permissions: z.array(z.enum(permissionOptions as [Permission, ...Permission[]])).min(1, 'Select at least one permission.'),
    prcLicenseNumber: z.string().optional(),
    prcLicenseExpiry: z.string().optional(),
    birNumber: z.string().optional(),
    consultationFee: z.number().min(0, 'Consultation fee must be 0 or higher.').optional(),
    followUpFee: z.number().min(0, 'Follow-up fee must be 0 or higher.').optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'create') {
      const password = value.password ?? '';
      const confirmPassword = value.confirmPassword ?? '';

      if (password.length < 6 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message: PASSWORD_RULES_HINT,
        });
      }

      if (password !== confirmPassword) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirmPassword'],
          message: 'Passwords do not match.',
        });
      }
    }

    if (value.role !== 'doctor' || value.mode === 'edit') {
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
  });

type UserFormValues = z.infer<typeof userSchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

function splitFullName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

function buildCreateUserInput(values: UserFormValues): AdminCreateUserInput {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    contactNumber: values.contactNumber.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password ?? '',
    role: values.role,
    permissions: values.permissions,
    prcLicenseNumber: values.role === 'doctor' ? values.prcLicenseNumber?.trim() ?? '' : undefined,
    prcLicenseExpiry: values.role === 'doctor' ? values.prcLicenseExpiry?.trim() ?? '' : undefined,
    birNumber: values.role === 'doctor' ? values.birNumber?.trim() ?? '' : undefined,
    consultationFee: values.role === 'doctor' ? values.consultationFee ?? 0 : undefined,
    followUpFee: values.role === 'doctor' ? values.followUpFee ?? 0 : undefined,
    prcIdFile: null,
  };
}

function formatPermissions(user: UserProfile) {
  return (user.permissions ?? rolePermissions[user.role]).join(', ');
}

export function SettingsUsersPage() {
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ['settings-users'], queryFn: listUsersLiveOrDemo });
  const [search, setSearch] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const deferredSearch = useDeferredValue(search);

  const createUserMutation = useMutation({
    mutationFn: createAdminUserLiveOrDemo,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UserFormValues }) =>
      updateAdminUserLiveOrDemo(id, {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        contactNumber: values.contactNumber.trim(),
        email: values.email.trim().toLowerCase(),
        role: values.role,
        permissions: values.permissions,
        prcLicenseNumber: values.prcLicenseNumber?.trim(),
        prcLicenseExpiry: values.prcLicenseExpiry?.trim(),
        birNumber: values.birNumber?.trim(),
        consultationFee: values.consultationFee ?? 0,
        followUpFee: values.followUpFee ?? 0,
      }),
    onSuccess: async (_updatedUser, variables) => {
      saveUserPermissionOverride({
        userId: variables.id,
        email: variables.values.email.trim().toLowerCase(),
        permissions: variables.values.permissions,
      });
      await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (user: UserProfile) => deleteAdminUserLiveOrDemo(user.id, { email: user.email }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      mode: 'create',
      firstName: '',
      lastName: '',
      contactNumber: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'nurse_staff',
      permissions: [...rolePermissions.nurse_staff],
      prcLicenseNumber: '',
      prcLicenseExpiry: '',
      birNumber: '',
      consultationFee: 0,
      followUpFee: 0,
    },
  });

  const selectedRole = useWatch({ control: form.control, name: 'role' });
  const formMode = useWatch({ control: form.control, name: 'mode' });
  const selectedPermissions = useWatch({ control: form.control, name: 'permissions' });
  const isDoctor = selectedRole === 'doctor';
  const isEditing = formMode === 'edit';
  const isLiveEdit = isEditing && isSupabaseConfigured;

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        `${user.fullName} ${user.email} ${user.phone} ${roleLabels[user.role]} ${formatPermissions(user)}`.toLowerCase().includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, users],
  );

  useEffect(() => {
    if (!isUserModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUserModalOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUserModalOpen]);

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({ ...currentState, open: false }));
  };

  const closeUserModal = () => {
    setEditingUser(null);
    setIsUserModalOpen(false);
  };

  const openCreateModal = () => {
    form.reset({
      mode: 'create',
      firstName: '',
      lastName: '',
      contactNumber: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'nurse_staff',
      permissions: [...rolePermissions.nurse_staff],
      prcLicenseNumber: '',
      prcLicenseExpiry: '',
      birNumber: '',
      consultationFee: 0,
      followUpFee: 0,
    });
    setEditingUser(null);
    setIsUserModalOpen(true);
  };

  const openEditModal = (user: UserProfile) => {
    const { firstName, lastName } = splitFullName(user.fullName);
    const permissions = user.permissions ?? [...rolePermissions[user.role]];

    form.reset({
      mode: 'edit',
      firstName,
      lastName,
      contactNumber: user.phone ?? '',
      email: user.email,
      password: '',
      confirmPassword: '',
      role: user.role as Exclude<Role, 'patient'>,
      permissions,
      prcLicenseNumber: '',
      prcLicenseExpiry: '',
      birNumber: '',
      consultationFee: user.consultationFee ?? 0,
      followUpFee: user.followUpFee ?? 0,
    });
    setEditingUser(user);
    setIsUserModalOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editingUser) {
        await updateUserMutation.mutateAsync({ id: editingUser.id, values });
        setFeedbackModal({
          open: true,
          title: 'User updated',
          message: 'The user account was updated successfully.',
          variant: 'success',
        });
      } else {
        const createdUser = await createUserMutation.mutateAsync(buildCreateUserInput(values));
        saveUserPermissionOverride({
          userId: createdUser.id,
          email: createdUser.email,
          permissions: values.permissions,
        });
        setFeedbackModal({
          open: true,
          title: 'User created',
          message: `${roleLabels[values.role]} account created successfully.`,
          variant: 'success',
        });
      }

      closeUserModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingUser ? 'Unable to update user' : 'Unable to create user',
        message: error instanceof Error ? error.message : 'Something went wrong while saving the user.',
        variant: 'error',
      });
    }
  });

  const handleDeleteUser = async (user: UserProfile) => {
    if (!window.confirm(`Delete ${user.fullName}'s account?`)) return;

    try {
      await deleteUserMutation.mutateAsync(user);
      setFeedbackModal({
        open: true,
        title: 'User deleted',
        message: 'The user account was removed successfully.',
        variant: 'success',
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: 'Unable to delete user',
        message: error instanceof Error ? error.message : 'Something went wrong while deleting the user.',
        variant: 'error',
      });
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-orange-600 p-2.5 text-white">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">User and Role Management</h1>
                <p className="mt-1 text-sm text-slate-500">Manage staff accounts from a searchable table with modal-based create and edit forms.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="rounded-none bg-orange-600 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700" onClick={openCreateModal}>
                <Plus className="mr-2 size-4" />
                Add user
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search user, role, or permission"
                  value={search}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">User</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Role</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Contact</th>
                    <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Permissions</th>
                    <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr className="transition-colors hover:bg-slate-50" key={user.id}>
                      <td className="px-6 py-4 align-top">
                        <p className="font-bold text-slate-950">{user.fullName}</p>
                        <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-6 py-4 align-top text-sm font-medium text-slate-700">{roleLabels[user.role]}</td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">{user.phone || 'No contact number set'}</td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">
                        <p className="max-w-md">{formatPermissions(user)}</p>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                          <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditModal(user)} type="button">
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => void handleDeleteUser(user)} type="button">
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-slate-500" colSpan={5}>
                        No users matched your search.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-950">Role matrix</h2>
              <div className="mt-5 space-y-4">
                {Object.entries(rolePermissions)
                  .filter(([role]) => role !== 'patient')
                  .map(([role, permissions]) => (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={role}>
                      <p className="font-semibold text-slate-950">{roleLabels[role as Role]}</p>
                      <p className="mt-2 text-sm text-slate-500">{permissions.join(', ')}</p>
                    </div>
                  ))}
              </div>
            </div>

            <div className="border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-950">Live account note</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>Create works in both demo and live mode.</p>
                <p>Edit works for profile details and permission overrides.</p>
                <p>Deleting live accounts still needs an admin auth-delete backend, so the delete button will show a clear error until that flow is added.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isUserModalOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6" onClick={closeUserModal} role="dialog">
          <div className="my-auto flex w-full max-w-3xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 bg-orange-600 px-6 py-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">User Form</p>
                <p className="mt-0.5 text-sm font-bold text-white">{editingUser ? 'Edit user account' : 'Add user account'}</p>
              </div>
              <button aria-label="Close user modal" className="inline-flex items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20" onClick={closeUserModal} type="button">
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {isLiveEdit ? (
                  <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Role and email stay locked when editing live accounts. You can still update the contact number, doctor fees, and permission checklist here.
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField error={form.formState.errors.firstName?.message} label="First name">
                    <Input {...form.register('firstName')} />
                  </FormField>
                  <FormField error={form.formState.errors.lastName?.message} label="Last name">
                    <Input {...form.register('lastName')} />
                  </FormField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField error={form.formState.errors.contactNumber?.message} label="Contact number">
                    <Input {...form.register('contactNumber')} />
                  </FormField>
                  <FormField error={form.formState.errors.email?.message} label="Email address">
                    <Input disabled={isLiveEdit} type="email" {...form.register('email')} />
                  </FormField>
                </div>

                {!isEditing ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField error={form.formState.errors.password?.message} hint={PASSWORD_RULES_HINT} label="Password">
                      <Input type="password" {...form.register('password')} />
                    </FormField>
                    <FormField error={form.formState.errors.confirmPassword?.message} label="Confirm password">
                      <Input type="password" {...form.register('confirmPassword')} />
                    </FormField>
                  </div>
                ) : null}

                <FormField error={form.formState.errors.role?.message} label="Role">
                  <Select
                    disabled={isLiveEdit}
                    onChange={(event) => {
                      const nextRole = event.target.value as Exclude<Role, 'patient'>;
                      form.setValue('role', nextRole, { shouldDirty: true, shouldValidate: true });
                      form.setValue('permissions', [...rolePermissions[nextRole]], { shouldDirty: true, shouldValidate: true });
                    }}
                    value={selectedRole}
                  >
                    {staffRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField error={form.formState.errors.permissions?.message} hint="Check the actions this account should be allowed to perform." label="Permission checklist">
                  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                    {permissionOptions.map((permission) => {
                      const isChecked = selectedPermissions?.includes(permission) ?? false;

                      return (
                        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700" key={permission}>
                          <input
                            checked={isChecked}
                            className="mt-1"
                            onChange={(event) => {
                              const currentPermissions = form.getValues('permissions') ?? [];
                              if (event.target.checked) {
                                form.setValue('permissions', [...new Set([...currentPermissions, permission])], { shouldDirty: true, shouldValidate: true });
                                return;
                              }

                              form.setValue(
                                'permissions',
                                currentPermissions.filter((item) => item !== permission),
                                { shouldDirty: true, shouldValidate: true },
                              );
                            }}
                            type="checkbox"
                          />
                          <span className="font-medium">{permission}</span>
                        </label>
                      );
                    })}
                  </div>
                </FormField>

                {isDoctor ? (
                  <div className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
                    <p className="text-sm font-semibold text-orange-900">Doctor account fields</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField error={form.formState.errors.prcLicenseNumber?.message} label="PRC license number">
                        <Input disabled={isEditing} {...form.register('prcLicenseNumber')} />
                      </FormField>
                      <FormField error={form.formState.errors.prcLicenseExpiry?.message} label="PRC license expiry">
                        <Input disabled={isEditing} type="date" {...form.register('prcLicenseExpiry')} />
                      </FormField>
                    </div>
                    <FormField error={form.formState.errors.birNumber?.message} label="BIR number">
                      <Input disabled={isEditing} {...form.register('birNumber')} />
                    </FormField>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField error={form.formState.errors.consultationFee?.message} label="Consultation fee">
                        <Input min="0" step="0.01" type="number" {...form.register('consultationFee', { valueAsNumber: true })} />
                      </FormField>
                      <FormField error={form.formState.errors.followUpFee?.message} label="Follow-up fee">
                        <Input min="0" step="0.01" type="number" {...form.register('followUpFee', { valueAsNumber: true })} />
                      </FormField>
                    </div>
                    {isEditing ? (
                      <p className="text-xs text-orange-700">Doctor credential files and license details stay read-only during edit to avoid breaking the verified doctor setup.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-3 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <Button className="w-full rounded-none sm:w-auto" onClick={closeUserModal} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button className="w-full rounded-none bg-orange-600 hover:bg-orange-700 sm:w-auto" disabled={createUserMutation.isPending || updateUserMutation.isPending} type="submit">
                  {createUserMutation.isPending || updateUserMutation.isPending ? 'Saving...' : editingUser ? 'Save User' : 'Add User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <FeedbackModal autoCloseMs={3000} message={feedbackModal.message} onClose={closeFeedbackModal} open={feedbackModal.open} title={feedbackModal.title} variant={feedbackModal.variant} />
    </>
  );
}
