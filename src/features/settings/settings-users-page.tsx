import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { roleLabels, rolePermissions } from '../../config/permissions';
import { createUserProfile, getDatabase, listUsers } from '../../lib/local-db';
import { isSupabaseConfigured } from '../../lib/supabase';
import type { Role } from '../../types/domain';

const userSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  phone: z.string().min(5),
  role: z.enum(['owner_admin', 'doctor', 'nurse_staff', 'front_desk_cashier', 'lab_staff', 'inventory_staff', 'patient']),
  title: z.string().optional(),
  specialtyId: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export function SettingsUsersPage() {
  const database = getDatabase();
  const { data: users = [] } = useQuery({ queryKey: ['settings-users'], queryFn: async () => listUsers() });
  const createUserMutation = useMutation({
    mutationFn: async (values: UserFormValues) =>
      createUserProfile({
        authUserId: `demo_${values.email}`,
        email: values.email,
        fullName: values.fullName,
        role: values.role,
        phone: values.phone,
        title: values.title || null,
        specialtyId: values.specialtyId || null,
      }),
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      role: 'nurse_staff',
      title: '',
      specialtyId: database.specialties[0]?.id ?? '',
    },
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <Card>
          <CardTitle>User management CMS</CardTitle>
          <p className="mt-3 text-sm text-slate-500">
            {isSupabaseConfigured
              ? 'Live production staff provisioning should use a secured admin API or Edge Function. This screen currently stages the CMS workflow in the app layer.'
              : 'Demo mode can add users directly so you can validate role-aware navigation and staff directories.'}
          </p>
          <form
            className="mt-5 space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              await createUserMutation.mutateAsync(values);
              form.reset({ ...values, fullName: '', email: '', phone: '', title: '' });
            })}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Full name">
                <Input {...form.register('fullName')} />
              </FormField>
              <FormField label="Email">
                <Input {...form.register('email')} />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Phone">
                <Input {...form.register('phone')} />
              </FormField>
              <FormField label="Role">
                <Select {...form.register('role')}>
                  {(Object.keys(roleLabels) as Role[]).map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Title / position">
                <Input {...form.register('title')} />
              </FormField>
              <FormField label="Specialty">
                <Select {...form.register('specialtyId')}>
                  <option value="">None</option>
                  {database.specialties.map((specialty) => (
                    <option key={specialty.id} value={specialty.id}>
                      {specialty.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <Button className="w-full" disabled={createUserMutation.isPending} type="submit">
              {createUserMutation.isPending ? 'Saving...' : 'Add user'}
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
                    <p className="mt-1 text-sm text-slate-500">{user.title || 'No title set'}</p>
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
          {Object.entries(rolePermissions).map(([role, permissions]) => (
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
