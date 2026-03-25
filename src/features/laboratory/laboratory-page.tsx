import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { createLabOrder, getDatabase, listLabOrders } from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';

const labSchema = z.object({
  patientId: z.string().min(1),
  labServiceId: z.string().min(1),
  requestedBy: z.string().min(1),
  status: z.enum(['requested', 'collected', 'processing', 'ready', 'released']),
  notes: z.string().min(2),
  resultSummary: z.string().min(2),
});

type LabFormValues = z.infer<typeof labSchema>;

export function LaboratoryPage() {
  const database = getDatabase();
  const { data: orders = [] } = useQuery({
    queryKey: queryKeys.laboratory,
    queryFn: async () => listLabOrders(),
  });
  const mutation = useMutation({
    mutationFn: async (values: LabFormValues) =>
      createLabOrder(
        {
          patientId: values.patientId,
          appointmentId: null,
          labServiceId: values.labServiceId,
          requestedBy: values.requestedBy,
          status: values.status,
          notes: values.notes,
        },
        values.resultSummary,
      ),
  });
  const form = useForm<LabFormValues>({
    resolver: zodResolver(labSchema),
    defaultValues: {
      patientId: database.patients[0]?.id ?? '',
      labServiceId: database.labServices[0]?.id ?? '',
      requestedBy: database.users.find((user) => user.role === 'doctor')?.id ?? '',
      status: 'requested',
      notes: '',
      resultSummary: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    form.reset({
      ...values,
      notes: '',
      resultSummary: '',
    });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <Card>
        <CardTitle className="text-3xl">Laboratory workflow</CardTitle>
        <div className="mt-6 space-y-4">
          {orders.map((order) => {
            const patient = database.patients.find((item) => item.id === order.patientId);
            const labService = database.labServices.find((item) => item.id === order.labServiceId);
            return (
              <div key={order.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{labService?.name}</p>
                    <p className="text-sm text-slate-500">
                      {patient?.firstName} {patient?.lastName}
                    </p>
                  </div>
                  <Badge intent={order.status === 'released' ? 'success' : 'info'}>{order.status}</Badge>
                </div>
                <p className="mt-3 text-sm text-slate-600">{order.notes}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Create lab request</CardTitle>
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <FormField label="Patient">
            <Select {...form.register('patientId')}>
              {database.patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.firstName} {patient.lastName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Lab service">
            <Select {...form.register('labServiceId')}>
              {database.labServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Requested by">
            <Select {...form.register('requestedBy')}>
              {database.users.filter((user) => user.role === 'doctor').map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.fullName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status">
            <Select {...form.register('status')}>
              <option value="requested">Requested</option>
              <option value="collected">Collected</option>
              <option value="processing">Processing</option>
              <option value="ready">Ready</option>
              <option value="released">Released</option>
            </Select>
          </FormField>
          <FormField label="Request notes">
            <Textarea {...form.register('notes')} />
          </FormField>
          <FormField label="Result summary">
            <Textarea {...form.register('resultSummary')} />
          </FormField>
          <Button className="w-full" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? 'Saving...' : 'Save lab order'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

