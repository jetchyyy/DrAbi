import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useDoctorDirectory, useBookableServices } from '../../hooks/use-clinic-data';
import { useAuth } from '../auth/auth-context';
import { useCreateBooking, useCurrentPatient } from './hooks/use-bookings';

const bookingSchema = z.object({
  serviceId: z.string().min(1),
  doctorId: z.string().min(1),
  preferredDate: z.string().min(1),
  preferredTime: z.string().min(1),
  intakeNotes: z.string().min(3),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export function PortalBookPage() {
  const { profile, session } = useAuth();
  const { data: services = [] } = useBookableServices();
  const { data: doctors = [] } = useDoctorDirectory();
  const { data: currentPatient } = useCurrentPatient(session?.user.id ?? null, profile?.email);
  const createBooking = useCreateBooking(session?.user.id ?? null);
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      serviceId: '',
      doctorId: '',
      preferredDate: '2026-03-28',
      preferredTime: '09:30',
      intakeNotes: '',
    },
  });

  useEffect(() => {
    if (services[0] && !form.getValues('serviceId')) {
      form.setValue('serviceId', services[0].id);
    }
    if (doctors[0] && !form.getValues('doctorId')) {
      form.setValue('doctorId', doctors[0].id);
    }
  }, [doctors, form, services]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!currentPatient) {
      toast.error('Your patient profile is not ready yet. Please sign in again or contact the clinic.');
      return;
    }

    await createBooking.mutateAsync({
      patientId: currentPatient.id,
      serviceId: values.serviceId,
      doctorId: values.doctorId,
      preferredDate: values.preferredDate,
      preferredTime: values.preferredTime,
      intakeNotes: values.intakeNotes,
    });

    toast.success('Booking submitted. Staff can now confirm or reschedule it.');
    form.reset({
      ...values,
      intakeNotes: '',
    });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <Card>
        <Badge intent="info">Booking portal</Badge>
        <CardTitle className="mt-4 text-3xl">Request an appointment</CardTitle>
        <p className="mt-3 text-sm text-slate-500">
          You are signed in as {profile?.fullName ?? profile?.email}. Your patient account already holds the medical history used by the clinic.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Service">
              <Select {...form.register('serviceId')}>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Doctor">
              <Select {...form.register('doctorId')}>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName}{doctor.specialtyName ? ' (' + doctor.specialtyName + ')' : ''}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Preferred date">
              <Input type="date" {...form.register('preferredDate')} />
            </FormField>
            <FormField label="Preferred time">
              <Input type="time" {...form.register('preferredTime')} />
            </FormField>
          </div>
          <FormField label="Reason or intake notes">
            <Textarea {...form.register('intakeNotes')} />
          </FormField>
          <Button className="w-full" disabled={createBooking.isPending || !currentPatient} type="submit">
            {createBooking.isPending ? 'Submitting...' : 'Submit booking request'}
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Before you book</CardTitle>
        <div className="mt-5 space-y-4 text-sm text-slate-600">
          <p>Booking is available only to signed-in patient accounts so the clinic can keep one continuous chart per patient.</p>
          <p>Your medical history, allergies, emergency contacts, and referrals stay attached to your account and are visible to the care team.</p>
          <p>
            Need to update your details first? Return to the <Link className="font-semibold text-[var(--color-primary)]" to="/portal">patient portal</Link> or contact the clinic staff.
          </p>
        </div>
      </Card>
    </div>
  );
}

