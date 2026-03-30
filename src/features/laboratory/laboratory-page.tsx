import { zodResolver } from '@hookform/resolvers/zod';
import { FlaskConical } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
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

function LabStatusPill({ status }: { status: string }) {
  if (status === 'released') return <span className="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{status}</span>;
  if (status === 'ready') return <span className="bg-sky-100 text-sky-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{status}</span>;
  if (status === 'processing') return <span className="bg-violet-100 text-violet-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{status}</span>;
  return <span className="bg-orange-100 text-orange-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{status}</span>;
}

export function LaboratoryPage() {
  const database = getDatabase();
  const { data: orders = [] } = useQuery({
    queryKey: queryKeys.laboratory,
    queryFn: async () => listLabOrders(),
  });
  const mutation = useMutation({
    mutationFn: async (values: LabFormValues) =>
      createLabOrder(
        { patientId: values.patientId, appointmentId: null, labServiceId: values.labServiceId, requestedBy: values.requestedBy, status: values.status, notes: values.notes },
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
    form.reset({ ...values, notes: '', resultSummary: '' });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      {/* Lab orders list */}
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
          <div className="p-2 bg-violet-700 text-white shrink-0">
            <FlaskConical className="size-4" />
          </div>
          <div>
            <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Laboratory Workflow</p>
            <p className="text-[11px] text-slate-400 font-medium">{orders.length} order{orders.length !== 1 ? 's' : ''} on record</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {orders.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">No lab orders yet.</div>
          ) : (
            orders.map((order) => {
              const patient = database.patients.find((item) => item.id === order.patientId);
              const labService = database.labServices.find((item) => item.id === order.labServiceId);
              return (
                <div key={order.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 bg-violet-50 text-violet-600 shrink-0 mt-0.5">
                        <FlaskConical className="size-3.5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-950">{labService?.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{patient?.firstName} {patient?.lastName}</p>
                        {order.notes && <p className="text-xs text-slate-400 mt-1 italic">{order.notes}</p>}
                      </div>
                    </div>
                    <LabStatusPill status={order.status} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create lab request form */}
      <div className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-violet-700 px-6 py-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-violet-200">New Order</p>
          <p className="text-sm font-bold text-white mt-0.5">Create Lab Request</p>
        </div>
        <form className="divide-y divide-slate-100" onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient & Provider</p>
            <FormField label="Patient">
              <Select {...form.register('patientId')}>
                {database.patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </Select>
            </FormField>
            <FormField label="Requested by">
              <Select {...form.register('requestedBy')}>
                {database.users.filter((u) => u.role === 'doctor').map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Order Details</p>
            <FormField label="Lab service">
              <Select {...form.register('labServiceId')}>
                {database.labServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
            <FormField label="Request notes"><Textarea {...form.register('notes')} /></FormField>
            <FormField label="Result summary"><Textarea {...form.register('resultSummary')} /></FormField>
          </div>
          <div className="px-6 py-4 bg-slate-50">
            <Button className="w-full rounded-none bg-violet-700 hover:bg-violet-800 font-extrabold uppercase tracking-widest text-sm py-5" disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Saving…' : 'Save Lab Order'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
