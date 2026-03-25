import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { createSupplier, getDatabase, listSuppliers } from '../../lib/local-db';

const supplierSchema = z.object({
  name: z.string().min(2),
  contactPerson: z.string().min(2),
  phone: z.string().min(5),
  email: z.email(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

export function SettingsSupportPage() {
  const database = getDatabase();
  const clinic = database.clinicSettings;
  const { data: suppliers = [] } = useQuery({ queryKey: ['settings-suppliers'], queryFn: async () => listSuppliers() });
  const createSupplierMutation = useMutation({ mutationFn: async (values: SupplierFormValues) => createSupplier(values) });
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
    },
  });

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardTitle>Supplier CMS</CardTitle>
          <form
            className="mt-5 space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              await createSupplierMutation.mutateAsync(values);
              form.reset();
            })}
          >
            <FormField label="Supplier name">
              <Input {...form.register('name')} />
            </FormField>
            <FormField label="Contact person">
              <Input {...form.register('contactPerson')} />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Phone">
                <Input {...form.register('phone')} />
              </FormField>
              <FormField label="Email">
                <Input {...form.register('email')} />
              </FormField>
            </div>
            <Button className="w-full" disabled={createSupplierMutation.isPending} type="submit">
              {createSupplierMutation.isPending ? 'Saving...' : 'Add supplier'}
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Suppliers</CardTitle>
          <div className="mt-5 space-y-4">
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-950">{supplier.name}</p>
                <p className="mt-1 text-sm text-slate-500">{supplier.contactPerson}</p>
                <p className="mt-1 text-sm text-slate-500">{supplier.phone} • {supplier.email}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Booking rules and operating hours</CardTitle>
        <div className="mt-5 space-y-4 text-sm text-slate-600">
          <p>{clinic.bookingLeadDays} days allowed for advance booking.</p>
          <p>{clinic.bookingCancellationHours} hours notice for cancellation.</p>
          <p>{clinic.appointmentSlotMinutes}-minute default appointment slots.</p>
          <p>Teleconsultation-ready services should use hybrid or teleconsultation delivery modes so your scheduling team can route them correctly.</p>
          <div className="space-y-2">
            {clinic.operatingHours.map((slot) => (
              <div key={slot.day} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-medium text-slate-950">{slot.day}</span>
                <span>{slot.enabled ? `${slot.open} - ${slot.close}` : 'Closed'}</span>
              </div>
            ))}
          </div>
          <Textarea readOnly value={`Clinic address: ${clinic.address}
Contact number: ${clinic.contactNumber}
Email: ${clinic.email}`} />
        </div>
      </Card>
    </div>
  );
}
