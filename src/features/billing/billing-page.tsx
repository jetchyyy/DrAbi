import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { createInvoice, getDatabase, listInvoices } from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';
import { formatCurrency } from '../../lib/utils';

const billingSchema = z.object({
  patientId: z.string().min(1),
  description: z.string().min(2),
  category: z.enum(['consultation', 'laboratory', 'medicine', 'other']),
  quantity: z.number().min(1),
  unitPrice: z.number().min(1),
});

type BillingFormValues = z.infer<typeof billingSchema>;

export function BillingPage() {
  const database = getDatabase();
  const { data: invoices = [] } = useQuery({
    queryKey: queryKeys.invoices,
    queryFn: async () => listInvoices(),
  });
  const mutation = useMutation({
    mutationFn: async (values: BillingFormValues) => {
      const total = values.quantity * values.unitPrice;
      return createInvoice(
        {
          patientId: values.patientId,
          appointmentId: null,
          invoiceNumber: `INV-${Date.now()}`,
          paymentStatus: 'unpaid',
          subtotal: total,
          total,
        },
        [
          {
            description: values.description,
            quantity: values.quantity,
            unitPrice: values.unitPrice,
            category: values.category,
          },
        ],
      );
    },
  });
  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      patientId: database.patients[0]?.id ?? '',
      description: 'General Consultation',
      category: 'consultation',
      quantity: 1,
      unitPrice: 800,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    form.reset({
      ...values,
      description: '',
    });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <Card>
        <CardTitle className="text-3xl">Billing and receipts</CardTitle>
        <div className="mt-6 space-y-4">
          {invoices.map((invoice) => {
            const patient = database.patients.find((item) => item.id === invoice.patientId);
            return (
              <div key={invoice.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-slate-500">
                      {patient?.firstName} {patient?.lastName}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge intent={invoice.paymentStatus === 'paid' ? 'success' : invoice.paymentStatus === 'partial' ? 'warning' : 'info'}>
                      {invoice.paymentStatus}
                    </Badge>
                    <p className="mt-2 font-semibold text-slate-950">{formatCurrency(invoice.total)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Create invoice</CardTitle>
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
          <FormField label="Line item">
            <Input {...form.register('description')} />
          </FormField>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Category">
              <Select {...form.register('category')}>
                <option value="consultation">Consultation</option>
                <option value="laboratory">Laboratory</option>
                <option value="medicine">Medicine</option>
                <option value="other">Other</option>
              </Select>
            </FormField>
            <FormField label="Quantity">
              <Input type="number" {...form.register('quantity', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Unit price">
              <Input type="number" {...form.register('unitPrice', { valueAsNumber: true })} />
            </FormField>
          </div>
          <Button className="w-full" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? 'Creating...' : 'Create invoice'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

