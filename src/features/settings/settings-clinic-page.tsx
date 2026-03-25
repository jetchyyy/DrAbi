import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { getClinicSettings, resetDemoData, updateClinicSettings } from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';

const clinicSchema = z.object({
  clinicName: z.string().min(2),
  legalName: z.string().min(2),
  shortCode: z.string().min(2),
  address: z.string().min(4),
  contactNumber: z.string().min(5),
  email: z.email(),
  website: z.url(),
  primaryColor: z.string().min(4),
  accentColor: z.string().min(4),
});

type ClinicFormValues = z.infer<typeof clinicSchema>;

export function SettingsClinicPage() {
  const { data: clinic } = useQuery({
    queryKey: queryKeys.clinicSettings,
    queryFn: async () => getClinicSettings(),
  });
  const mutation = useMutation({
    mutationFn: async (values: ClinicFormValues) => updateClinicSettings(values),
  });
  const form = useForm<ClinicFormValues>({
    resolver: zodResolver(clinicSchema),
    values: {
      clinicName: clinic?.clinicName ?? '',
      legalName: clinic?.legalName ?? '',
      shortCode: clinic?.shortCode ?? '',
      address: clinic?.address ?? '',
      contactNumber: clinic?.contactNumber ?? '',
      email: clinic?.email ?? '',
      website: clinic?.website ?? '',
      primaryColor: clinic?.primaryColor ?? '#155eef',
      accentColor: clinic?.accentColor ?? '#0f766e',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle className="text-3xl">Clinic profile and branding</CardTitle>
        <p className="mt-3 text-sm text-slate-500">
          Branding, contact details, colors, booking windows, and operating preferences are all stored centrally for future white-label adaptation.
        </p>
      </Card>
      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Clinic name">
              <Input {...form.register('clinicName')} />
            </FormField>
            <FormField label="Legal name">
              <Input {...form.register('legalName')} />
            </FormField>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Short code">
              <Input {...form.register('shortCode')} />
            </FormField>
            <FormField label="Contact number">
              <Input {...form.register('contactNumber')} />
            </FormField>
            <FormField label="Email">
              <Input {...form.register('email')} />
            </FormField>
          </div>
          <FormField label="Address">
            <Textarea {...form.register('address')} />
          </FormField>
          <FormField label="Website">
            <Input {...form.register('website')} />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Primary color">
              <Input {...form.register('primaryColor')} />
            </FormField>
            <FormField label="Accent color">
              <Input {...form.register('accentColor')} />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Saving...' : 'Save clinic settings'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => resetDemoData()}>
              Reset demo data
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

