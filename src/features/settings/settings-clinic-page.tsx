import { zodResolver } from '@hookform/resolvers/zod';
import { Building2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
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
    <div className="space-y-4 max-w-3xl">
      {/* Page header */}
      <div className="bg-white border border-slate-200 shadow-sm px-6 py-5 flex items-center gap-3">
        <div className="p-2.5 bg-orange-600 text-white shrink-0">
          <Building2 className="size-5" />
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Settings</p>
          <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">Clinic Profile & Branding</h1>
          <p className="text-xs text-slate-500 mt-0.5">Branding, contact details, colors, and operating preferences are stored centrally.</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <form className="divide-y divide-slate-100" onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Identity</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Clinic name"><Input {...form.register('clinicName')} /></FormField>
              <FormField label="Legal name"><Input {...form.register('legalName')} /></FormField>
            </div>
            <FormField label="Short code"><Input {...form.register('shortCode')} /></FormField>
          </div>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Contact Information</p>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Contact number"><Input {...form.register('contactNumber')} /></FormField>
              <FormField label="Email"><Input {...form.register('email')} /></FormField>
              <FormField label="Website"><Input {...form.register('website')} /></FormField>
            </div>
            <FormField label="Address"><Textarea {...form.register('address')} /></FormField>
          </div>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Branding Colors</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Primary color"><Input {...form.register('primaryColor')} /></FormField>
              <FormField label="Accent color"><Input {...form.register('accentColor')} /></FormField>
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50 flex flex-wrap gap-3">
            <Button className="rounded-none bg-orange-600 hover:bg-orange-700 font-extrabold uppercase tracking-widest text-sm" disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Saving…' : 'Save Clinic Settings'}
            </Button>
            <Button className="rounded-none font-bold uppercase tracking-wide text-sm" type="button" variant="secondary" onClick={() => resetDemoData()}>
              Clear Local Data
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
