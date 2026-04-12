import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { roleLabels, rolePermissions } from '../../config/permissions';
import { createAccessRole, deleteAccessRoleRecord, listAccessRoles, updateAccessRoleRecord } from '../../lib/local-db';
import type { AccessRoleTemplate, Permission, Role } from '../../types/domain';

const permissionOptions = Array.from(new Set(Object.values(rolePermissions).flat())) as Permission[];
const baseRoleOptions = ['owner_admin', 'doctor', 'nurse_staff', 'front_desk_cashier', 'lab_staff', 'inventory_staff'] as const satisfies ReadonlyArray<Exclude<Role, 'patient'>>;

const accessRoleSchema = z.object({
  name: z.string().trim().min(2, 'Role name must be at least 2 characters.'),
  description: z.string().trim().min(4, 'Description must be at least 4 characters.'),
  baseRole: z.enum(baseRoleOptions),
  permissions: z.array(z.enum(permissionOptions as [Permission, ...Permission[]])).min(1, 'Select at least one permission.'),
});

type AccessRoleFormValues = z.infer<typeof accessRoleSchema>;

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

export function SettingsRolesPage() {
  const queryClient = useQueryClient();
  const { data: accessRoles = [] } = useQuery({ queryKey: ['access-roles'], queryFn: async () => listAccessRoles() });
  const [search, setSearch] = useState('');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AccessRoleTemplate | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const deferredSearch = useDeferredValue(search);

  const createRoleMutation = useMutation({
    mutationFn: async (values: AccessRoleFormValues) => createAccessRole(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['access-roles'] });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: AccessRoleFormValues }) => updateAccessRoleRecord(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['access-roles'] });
      await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => deleteAccessRoleRecord(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['access-roles'] });
      await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
  });

  const form = useForm<AccessRoleFormValues>({
    resolver: zodResolver(accessRoleSchema),
    defaultValues: {
      name: '',
      description: '',
      baseRole: 'nurse_staff',
      permissions: [...rolePermissions.nurse_staff],
    },
  });

  const selectedPermissions = useWatch({ control: form.control, name: 'permissions' });
  const selectedBaseRole = useWatch({ control: form.control, name: 'baseRole' });

  const filteredRoles = useMemo(
    () =>
      accessRoles.filter((role) =>
        `${role.name} ${role.description} ${roleLabels[role.baseRole]} ${role.permissions.join(' ')}`.toLowerCase().includes(deferredSearch.toLowerCase()),
      ),
    [accessRoles, deferredSearch],
  );

  useEffect(() => {
    if (!isRoleModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsRoleModalOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRoleModalOpen]);

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({ ...currentState, open: false }));
  };

  const closeRoleModal = () => {
    setEditingRole(null);
    setIsRoleModalOpen(false);
  };

  const openCreateModal = () => {
    form.reset({
      name: '',
      description: '',
      baseRole: 'nurse_staff',
      permissions: [...rolePermissions.nurse_staff],
    });
    setEditingRole(null);
    setIsRoleModalOpen(true);
  };

  const openEditModal = (role: AccessRoleTemplate) => {
    if (role.isSystem) return;

    form.reset({
      name: role.name,
      description: role.description,
      baseRole: role.baseRole,
      permissions: role.permissions,
    });
    setEditingRole(role);
    setIsRoleModalOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editingRole) {
        await updateRoleMutation.mutateAsync({ id: editingRole.id, values });
        setFeedbackModal({
          open: true,
          title: 'Role updated',
          message: 'The access role was updated successfully.',
          variant: 'success',
        });
      } else {
        await createRoleMutation.mutateAsync(values);
        setFeedbackModal({
          open: true,
          title: 'Role created',
          message: 'The access role was added successfully.',
          variant: 'success',
        });
      }

      closeRoleModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingRole ? 'Unable to update role' : 'Unable to create role',
        message: error instanceof Error ? error.message : 'Something went wrong while saving the role.',
        variant: 'error',
      });
    }
  });

  const handleDeleteRole = async (role: AccessRoleTemplate) => {
    if (role.isSystem) {
      setFeedbackModal({
        open: true,
        title: 'System role locked',
        message: 'Built-in system roles cannot be deleted.',
        variant: 'error',
      });
      return;
    }

    if (!window.confirm(`Delete the ${role.name} role?`)) return;

    try {
      await deleteRoleMutation.mutateAsync(role.id);
      setFeedbackModal({
        open: true,
        title: 'Role deleted',
        message: 'The access role was removed successfully.',
        variant: 'success',
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: 'Unable to delete role',
        message: error instanceof Error ? error.message : 'Something went wrong while deleting the role.',
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
                <KeyRound className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Role Management</h1>
                <p className="mt-1 text-sm text-slate-500">Create access roles and define what pages and actions each role can use.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="rounded-none bg-orange-600 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700" onClick={openCreateModal}>
                <Plus className="mr-2 size-4" />
                Add role
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search role, base role, or permission"
                  value={search}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Role</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Base Staff Role</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Permissions</th>
                  <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoles.map((role) => (
                  <tr className="transition-colors hover:bg-slate-50" key={role.id}>
                    <td className="px-6 py-4 align-top">
                      <p className="font-bold text-slate-950">{role.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{role.description}</p>
                      {role.isSystem ? <p className="mt-2 text-xs font-bold uppercase tracking-widest text-orange-600">System role</p> : null}
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-slate-700">{roleLabels[role.baseRole]}</td>
                    <td className="px-6 py-4 align-top text-sm text-slate-600">{role.permissions.join(', ')}</td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                        {!role.isSystem ? (
                          <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditModal(role)} type="button">
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                        ) : null}
                        {!role.isSystem ? (
                          <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => void handleDeleteRole(role)} type="button">
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRoles.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-slate-500" colSpan={4}>
                      No roles matched your search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isRoleModalOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6" onClick={closeRoleModal} role="dialog">
          <div className="my-auto flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl sm:max-h-[80vh]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 bg-orange-600 px-6 py-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">Role Form</p>
                <p className="mt-0.5 text-sm font-bold text-white">{editingRole ? 'Edit access role' : 'Add access role'}</p>
              </div>
              <button aria-label="Close role modal" className="inline-flex items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20" onClick={closeRoleModal} type="button">
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                <FormField error={form.formState.errors.name?.message} label="Role name">
                  <Input {...form.register('name')} />
                </FormField>
                <FormField error={form.formState.errors.description?.message} label="Description">
                  <Textarea {...form.register('description')} />
                </FormField>
                <FormField error={form.formState.errors.baseRole?.message} label="Base staff role">
                  <Select
                    onChange={(event) => {
                      const nextBaseRole = event.target.value as Exclude<Role, 'patient'>;
                      form.setValue('baseRole', nextBaseRole, { shouldDirty: true, shouldValidate: true });
                      form.setValue('permissions', [...rolePermissions[nextBaseRole]], { shouldDirty: true, shouldValidate: true });
                    }}
                    value={selectedBaseRole}
                  >
                    {baseRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField error={form.formState.errors.permissions?.message} hint="Check the pages and actions this role can access." label="Permissions">
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
              </div>

              <div className="flex flex-col-reverse gap-3 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <Button className="w-full rounded-none sm:w-auto" onClick={closeRoleModal} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button className="w-full rounded-none bg-orange-600 hover:bg-orange-700 sm:w-auto" disabled={createRoleMutation.isPending || updateRoleMutation.isPending} type="submit">
                  {createRoleMutation.isPending || updateRoleMutation.isPending ? 'Saving...' : editingRole ? 'Save Role' : 'Add Role'}
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
