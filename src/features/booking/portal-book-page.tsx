import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
  fullName: z.string().min(2),
  email: z.email(),
  password: z.string().min(6),
  phone: z.string().min(5),
  birthDate: z.string().min(1),
  serviceId: z.string().min(1),
  doctorId: z.string().min(1),
  preferredDate: z.string().min(1),
  preferredTime: z.string().min(1),
  intakeNotes: z.string().min(3),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export function PortalBookPage() {
  const { profile, session, signUpPatient } = useAuth();
  const { data: services = [] } = useBookableServices();
  const { data: doctors = [] } = useDoctorDirectory();
  const { data: currentPatient, refetch: refetchPatient } = useCurrentPatient(session?.user.id ?? null, profile?.email);
  const createBooking = useCreateBooking(session?.user.id ?? null);
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      fullName: profile?.fullName ?? '',
      email: profile?.email ?? '',
      password: 'demo1234',
      phone: profile?.phone ?? '',
      birthDate: '1991-04-18',
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
    if (profile?.fullName) {
      form.setValue('fullName', profile.fullName);
      form.setValue('email', profile.email);
      form.setValue('phone', profile.phone);
    }
  }, [doctors, form, profile, services]);

  const onSubmit = form.handleSubmit(async (values) => {
    let patient = currentPatient;

    if (!patient) {
      const result = await signUpPatient({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        phone: values.phone,
        birthDate: values.birthDate,
      });

      const refreshed = await refetchPatient();
      patient = refreshed.data ?? null;

      if (!patient && result.requiresEmailConfirmation) {
        toast.success('Your account was created. Please verify your email, sign in, and then complete the booking.');
        return;
      }
    }

    if (!patient) {
      toast.error('Unable to create or resolve the patient profile.');
      return;
    }

    await createBooking.mutateAsync({
      patientId: patient.id,
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
        <CardTitle className="mt-4 text-3xl">Create appointment request</CardTitle>
        <p className="mt-3 text-sm text-slate-500">
          Patients can browse services, choose a doctor, and submit intake details before the visit.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Full name">
              <Input {...form.register('fullName')} />
            </FormField>
            <FormField label="Email">
              <Input {...form.register('email')} />
            </FormField>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField hint="Used when creating a new patient account" label="Password">
              <Input type="password" {...form.register('password')} />
            </FormField>
            <FormField label="Phone">
              <Input {...form.register('phone')} />
            </FormField>
            <FormField label="Birth date">
              <Input type="date" {...form.register('birthDate')} />
            </FormField>
          </div>
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
                    {doctor.fullName}{doctor.specialtyName ? ` (${doctor.specialtyName})` : ''}
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
          <FormField label="Intake notes">
            <Textarea {...form.register('intakeNotes')} />
          </FormField>
          <Button className="w-full" disabled={createBooking.isPending} type="submit">
            {createBooking.isPending ? 'Submitting...' : 'Submit booking request'}
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Booking guidance</CardTitle>
        <div className="mt-5 space-y-4 text-sm text-slate-600">
          <p>Clinic settings, services, doctors, and bookings now read from your Supabase project when configured.</p>
          <p>New patient sign-up stores auth metadata first, then boots profile and patient records after session resolution.</p>
          <p>Bookings are still separate from appointments so staff can confirm, reschedule, or reject requests cleanly.</p>
        </div>
      </Card>
    </div>
  );
}
