import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { queryClient } from '../../app/query-client';
import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useServicesCatalog, useSpecialtiesCatalog } from '../../hooks/use-clinic-data';
import { queryKeys } from '../../lib/query-keys';
import { createServiceLiveOrDemo, createSpecialtyLiveOrDemo } from '../../lib/supabase-clinic';
import { formatCurrency } from '../../lib/utils';
import type { ServiceDeliveryMode, ServiceType } from '../../types/domain';

const serviceSchema = z.object({
  serviceType: z.enum(['medical_service', 'consultation', 'follow_up']),
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

function formatDeliveryMode(deliveryMode?: ServiceDeliveryMode | null) {
  return (deliveryMode ?? 'hybrid').replace('_', ' ');
}

function formatServiceType(serviceType: ServiceType) {
  if (serviceType === 'consultation') return 'Consultation';
  if (serviceType === 'follow_up') return 'Follow-up';
  return 'Medical Service';
}

export function SettingsServicesPage() {
  const { data: services = [] } = useServicesCatalog();
  const { data: specialties = [] } = useSpecialtiesCatalog();
  const createServiceMutation = useMutation({
    mutationFn: async (values: ServiceFormValues) =>
      createServiceLiveOrDemo({
        serviceType: values.serviceType,
        name: values.name,
        description: values.description,
        price: values.price,
        durationMinutes: values.durationMinutes,
        specialtyId: values.specialtyId || null,
        isBookable: values.isBookable === 'true',
        deliveryMode: values.deliveryMode,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.services });
    },
  });
  const createSpecialtyMutation = useMutation({
    mutationFn: async (values: SpecialtyFormValues) => createSpecialtyLiveOrDemo(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.specialties });
    },
  });

  const serviceForm = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      serviceType: 'medical_service',
      name: '',
      description: '',
      price: 800,
      durationMinutes: 30,
      specialtyId: '',
      isBookable: 'true',
      deliveryMode: 'hybrid',
    },
  });

  useEffect(() => {
    if (!serviceForm.getValues('specialtyId') && specialties[0]) {
      serviceForm.setValue('specialtyId', specialties[0].id);
    }
  }, [serviceForm, specialties]);

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
            <FormField label="Service Type">
              <Select {...serviceForm.register('serviceType')}>
                <option value="medical_service">Medical Service</option>
                <option value="consultation">Consultation</option>
                <option value="follow_up">Follow-up</option>
              </Select>
            </FormField>
            <FormField label="Name">
              <Input {...serviceForm.register('name')} />
            </FormField>
            <FormField label="Description">
              <Textarea {...serviceForm.register('description')} />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Service Fee">
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
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-600">{formatServiceType(service.serviceType)}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">
                  {formatDeliveryMode(service.deliveryMode)} - {service.durationMinutes ?? 30} mins - {(service.isBookable ?? true) ? 'Portal enabled' : 'Internal only'}
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
