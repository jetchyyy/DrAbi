import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { createService, createSpecialty, getDatabase, listServices, listSpecialties } from '../../lib/local-db';
import { formatCurrency } from '../../lib/utils';

const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(4),
  price: z.number().min(0),
  durationMinutes: z.number().min(5),
  specialtyId: z.string().optional(),
  isBookable: z.enum(['true', 'false']),
  deliveryMode: z.enum(['in_person', 'teleconsultation', 'hybrid']),
});

const specialtySchema = z.object({
  name: z.string().min(2),
  description: z.string().min(4),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;
type SpecialtyFormValues = z.infer<typeof specialtySchema>;

export function SettingsServicesPage() {
  const database = getDatabase();
  const { data: services = [] } = useQuery({ queryKey: ['settings-services'], queryFn: async () => listServices() });
  const { data: specialties = [] } = useQuery({ queryKey: ['settings-specialties'], queryFn: async () => listSpecialties() });
  const createServiceMutation = useMutation({
    mutationFn: async (values: ServiceFormValues) =>
      createService({
        name: values.name,
        description: values.description,
        price: values.price,
        durationMinutes: values.durationMinutes,
        specialtyId: values.specialtyId || null,
        isBookable: values.isBookable === 'true',
        deliveryMode: values.deliveryMode,
      }),
  });
  const createSpecialtyMutation = useMutation({
    mutationFn: async (values: SpecialtyFormValues) => createSpecialty(values),
  });

  const serviceForm = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 800,
      durationMinutes: 30,
      specialtyId: database.specialties[0]?.id ?? '',
      isBookable: 'true',
      deliveryMode: 'hybrid',
    },
  });

  const specialtyForm = useForm<SpecialtyFormValues>({
    resolver: zodResolver(specialtySchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardTitle>Service catalog CMS</CardTitle>
          <form
            className="mt-5 space-y-4"
            onSubmit={serviceForm.handleSubmit(async (values) => {
              await createServiceMutation.mutateAsync(values);
              serviceForm.reset({ ...values, name: '', description: '' });
            })}
          >
            <FormField label="Service name">
              <Input {...serviceForm.register('name')} />
            </FormField>
            <FormField label="Description">
              <Textarea {...serviceForm.register('description')} />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Price">
                <Input type="number" {...serviceForm.register('price', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Duration (minutes)">
                <Input type="number" {...serviceForm.register('durationMinutes', { valueAsNumber: true })} />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Specialty">
                <Select {...serviceForm.register('specialtyId')}>
                  <option value="">Unassigned</option>
                  {specialties.map((specialty) => (
                    <option key={specialty.id} value={specialty.id}>
                      {specialty.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Delivery mode">
                <Select {...serviceForm.register('deliveryMode')}>
                  <option value="in_person">In person</option>
                  <option value="teleconsultation">Teleconsultation</option>
                  <option value="hybrid">Hybrid</option>
                </Select>
              </FormField>
            </div>
            <FormField label="Bookable in portal">
              <Select {...serviceForm.register('isBookable')}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
            </FormField>
            <Button className="w-full" disabled={createServiceMutation.isPending} type="submit">
              {createServiceMutation.isPending ? 'Saving...' : 'Add service'}
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Service library</CardTitle>
          <div className="mt-5 space-y-4">
            {services.map((service) => (
              <div key={service.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-950">{service.name}</p>
                  <p className="text-sm font-semibold text-slate-950">{formatCurrency(service.price)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-500">{service.description}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">
                  {service.deliveryMode.replace('_', ' ')} • {service.durationMinutes} mins • {service.isBookable ? 'Portal enabled' : 'Internal only'}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardTitle>Specialties CMS</CardTitle>
          <form
            className="mt-5 space-y-4"
            onSubmit={specialtyForm.handleSubmit(async (values) => {
              await createSpecialtyMutation.mutateAsync(values);
              specialtyForm.reset();
            })}
          >
            <FormField label="Specialty name">
              <Input {...specialtyForm.register('name')} />
            </FormField>
            <FormField label="Description">
              <Textarea {...specialtyForm.register('description')} />
            </FormField>
            <Button className="w-full" disabled={createSpecialtyMutation.isPending} type="submit">
              {createSpecialtyMutation.isPending ? 'Saving...' : 'Add specialty'}
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Specialty list</CardTitle>
          <div className="mt-5 space-y-4">
            {specialties.map((specialty) => (
              <div key={specialty.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-950">{specialty.name}</p>
                <p className="mt-2 text-sm text-slate-500">{specialty.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
