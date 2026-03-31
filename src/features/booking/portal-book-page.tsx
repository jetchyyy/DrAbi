import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarDays,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Phone,
  Stethoscope,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
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

function SectionHeader({ step, icon: Icon, title }: { step: string; icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 px-6 py-4 border-b border-slate-200">
      <div className="p-1.5 bg-orange-600 text-white shrink-0">
        <Icon className="size-3.5" />
      </div>
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-600">{step}</p>
        <p className="text-sm font-extrabold text-slate-950 leading-tight">{title}</p>
      </div>
    </div>
  );
}

export function PortalBookPage() {
  const { profile, session, signUpPatient } = useAuth();
  const { data: services = [] } = useBookableServices();
  const { data: doctors = [] } = useDoctorDirectory();
  const { data: currentPatient, refetch: refetchPatient } = useCurrentPatient(session?.user.id ?? null, profile?.email);
  const createBooking = useCreateBooking(session?.user.id ?? null);
  const [showPassword, setShowPassword] = useState(false);

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
    form.reset({ ...values, intakeNotes: '' });
  });

  return (
    <div className="mx-auto max-w-5xl pb-16">

      {/* Page header */}
      <div className="mb-8 border-l-4 border-orange-600 pl-5 animate-slide-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 uppercase">Book an Appointment</h1>
        <p className="mt-1 text-sm text-slate-500 font-medium">Fill out the form below and our staff will confirm your request within 24 hours.</p>
      </div>

      <div className="grid gap-6 items-start lg:grid-cols-[1fr_300px] animate-fade-up delay-100">

        {/* ── Main form ─────────────────────────────── */}
        <div className="border border-slate-200 bg-white shadow-sm overflow-hidden">

          {/* ── 01 Patient Details ─────────────────── */}
          <SectionHeader step="Step 01" icon={User} title="Your Personal Details" />
          <div className="px-6 py-7 space-y-6 border-b border-slate-100">

            {/* Row 1: Full name + Email */}
            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Full name">
                <Input
                  placeholder="e.g. Juan dela Cruz"
                  {...form.register('fullName')}
                />
                {form.formState.errors.fullName && (
                  <span className="text-xs text-rose-600">{form.formState.errors.fullName.message}</span>
                )}
              </FormField>
              <FormField label="Email address">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <span className="text-xs text-rose-600">{form.formState.errors.email.message}</span>
                )}
              </FormField>
            </div>

            {/* Row 2: Phone + Date of birth */}
            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Phone number">
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    className="pl-10"
                    placeholder="09XX-XXX-XXXX"
                    {...form.register('phone')}
                  />
                </div>
                {form.formState.errors.phone && (
                  <span className="text-xs text-rose-600">{form.formState.errors.phone.message}</span>
                )}
              </FormField>
              <FormField label="Date of birth">
                <Input
                  type="date"
                  {...form.register('birthDate')}
                />
                {form.formState.errors.birthDate && (
                  <span className="text-xs text-rose-600">{form.formState.errors.birthDate.message}</span>
                )}
              </FormField>
            </div>

            {/* Row 3: Password (full width on its own row — important field) */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Portal Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    className="pr-11"
                    {...form.register('password')}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Save this — you'll use it to sign in to your patient portal and view booking history.
                </p>
                {form.formState.errors.password && (
                  <span className="text-xs text-rose-600">{form.formState.errors.password.message}</span>
                )}
              </div>
            </div>
          </div>

          {/* ── 02 Service & Specialist ────────────── */}
          <SectionHeader step="Step 02" icon={Stethoscope} title="Service & Specialist" />
          <div className="px-6 py-7 border-b border-slate-100">
            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Select service">
                <Select {...form.register('serviceId')}>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Select specialist">
                <Select {...form.register('doctorId')}>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName}{doctor.specialtyName ? ` — ${doctor.specialtyName}` : ''}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </div>

          {/* ── 03 Schedule & Notes ────────────────── */}
          <SectionHeader step="Step 03" icon={CalendarDays} title="Preferred Schedule & Notes" />
          <div className="px-6 py-7 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Preferred date">
                <div className="relative">
                  <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input className="pl-10" type="date" {...form.register('preferredDate')} />
                </div>
              </FormField>
              <FormField label="Preferred time">
                <div className="relative">
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input className="pl-10" type="time" {...form.register('preferredTime')} />
                </div>
              </FormField>
            </div>

            <FormField label="Reason for visit / Symptoms">
              <Textarea
                className="min-h-[140px] resize-none"
                placeholder="Briefly describe what brings you in — e.g. fever for 3 days, follow-up for lab results, annual check-up. This helps our staff prepare for your visit."
                {...form.register('intakeNotes')}
              />
              {form.formState.errors.intakeNotes && (
                <span className="text-xs text-rose-600">{form.formState.errors.intakeNotes.message}</span>
              )}
            </FormField>
          </div>

          {/* Submit bar */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-5">
            <Button
              className="w-full bg-orange-600 py-5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700 transition-colors"
              disabled={createBooking.isPending}
              type="submit"
              onClick={onSubmit}
            >
              {createBooking.isPending ? 'Submitting…' : 'Submit Appointment Request →'}
            </Button>
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────── */}
        <div className="lg:sticky lg:top-28 space-y-4 animate-slide-right delay-200">

          {/* Booking guide */}
          <div className="border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-orange-600 px-5 py-4 flex items-center gap-2.5">
              <FileText className="size-4 text-orange-100" />
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">Booking Guide</p>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                {
                  title: 'New Patients',
                  body: "Your profile is created automatically. Save your password — you'll need it to view your booking history.",
                },
                {
                  title: 'Confirmation',
                  body: 'Staff will review your request and confirm it. You\'ll see updates in "My Bookings".',
                },
                {
                  title: 'Cancellations',
                  body: 'Please cancel at least 24 hours before your visit to free up the slot for others.',
                },
              ].map((item) => (
                <div key={item.title} className="px-5 py-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-600 mb-1">{item.title}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact block */}
          <div className="border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">Need help?</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              Call our front desk or visit us in person. Our staff are happy to assist with your booking.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
