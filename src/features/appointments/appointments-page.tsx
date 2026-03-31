import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { getDatabase } from '../../lib/local-db';
import { formatDateTimeLabel } from '../../lib/utils';
import { isTeleconsultJoinableStatus } from '../teleconsult/teleconsult-data';
import { useAppointments, useCreateAppointment } from './hooks/use-appointments';

const appointmentSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  specialtyId: z.string().min(1),
  serviceId: z.string().min(1),
  scheduledAt: z.string().min(1),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
  source: z.enum(['internal', 'portal']),
  visitType: z.enum(['in_person', 'teleconsultation']),
  reason: z.string().min(4),
  notes: z.string().min(2),
  teleconsultationPlatform: z.string().optional(),
  teleconsultationAccessInstructions: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

export function AppointmentsPage() {
  const database = getDatabase();
  const { data: appointments = [] } = useAppointments();
  const createAppointmentMutation = useCreateAppointment();
  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: database.patients[0]?.id ?? '',
      doctorId: database.users.find((user) => user.role === 'doctor')?.id ?? '',
      specialtyId: database.specialties[0]?.id ?? '',
      serviceId: database.services[0]?.id ?? '',
      scheduledAt: '2026-03-26T09:00',
      status: 'scheduled',
      source: 'internal',
      visitType: 'in_person',
      reason: '',
      notes: '',
      teleconsultationPlatform: 'Jitsi Meet',
      teleconsultationAccessInstructions: '',
    },
  });

  const visitType = useWatch({ control: form.control, name: 'visitType' });

  const onSubmit = form.handleSubmit(async (values) => {
    await createAppointmentMutation.mutateAsync({
      ...values,
      scheduledAt: new Date(values.scheduledAt).toISOString(),
      teleconsultationPlatform: values.visitType === 'teleconsultation' ? values.teleconsultationPlatform || 'Jitsi Meet' : undefined,
      teleconsultationAccessInstructions:
        values.visitType === 'teleconsultation' ? values.teleconsultationAccessInstructions || undefined : undefined,
    });

    form.reset({
      ...values,
      reason: '',
      notes: '',
      teleconsultationPlatform: 'Jitsi Meet',
      teleconsultationAccessInstructions: '',
    });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Operations</p>
            <CardTitle className="mt-2 text-3xl">Appointments and queue</CardTitle>
          </div>
          <Badge intent="info">In-app teleconsult workflow</Badge>
        </div>
        <div className="mt-6 space-y-4">
          {appointments.map((appointment) => {
            const patient = database.patients.find((item) => item.id === appointment.patientId);
            const doctor = database.users.find((item) => item.id === appointment.doctorId);
            const service = database.services.find((item) => item.id === appointment.serviceId);

            return (
              <div key={appointment.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">
                      {patient?.firstName} {patient?.lastName}
                    </p>
                    <p className="text-sm text-slate-500">
                      {doctor?.fullName} • {service?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge>{appointment.status.replace('_', ' ')}</Badge>
                    <p className="mt-2 text-sm text-slate-500">{formatDateTimeLabel(appointment.scheduledAt)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge intent={appointment.visitType === 'teleconsultation' ? 'info' : 'neutral'}>
                    {appointment.visitType === 'teleconsultation' ? 'Teleconsultation' : 'In person'}
                  </Badge>
                  {appointment.teleconsultationPlatform ? <Badge>{appointment.teleconsultationPlatform}</Badge> : null}
                </div>
                <p className="mt-3 text-sm text-slate-600">{appointment.reason}</p>
                {appointment.teleconsultationAccessInstructions ? (
                  <p className="mt-2 text-sm text-slate-500">{appointment.teleconsultationAccessInstructions}</p>
                ) : null}
                {appointment.visitType === 'teleconsultation' && isTeleconsultJoinableStatus(appointment.status) ? (
                  <Link className="mt-3 inline-flex text-sm font-semibold text-[var(--color-primary)]" to={`/app/teleconsult/${appointment.id}`}>
                    Join teleconsult
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Schedule appointment</CardTitle>
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
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Doctor">
              <Select {...form.register('doctorId')}>
                {database.users.filter((user) => user.role === 'doctor').map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Specialty">
              <Select {...form.register('specialtyId')}>
                {database.specialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>
                    {specialty.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Service">
              <Select {...form.register('serviceId')}>
                {database.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select {...form.register('status')}>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No show</option>
              </Select>
            </FormField>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Visit type">
              <Select {...form.register('visitType')}>
                <option value="in_person">In person</option>
                <option value="teleconsultation">Teleconsultation</option>
              </Select>
            </FormField>
            <FormField label="Source">
              <Select {...form.register('source')}>
                <option value="internal">Internal</option>
                <option value="portal">Portal</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Scheduled time">
            <Input type="datetime-local" {...form.register('scheduledAt')} />
          </FormField>
          {visitType === 'teleconsultation' ? (
            <div className="grid gap-4">
              <FormField label="Teleconsultation platform">
                <Input placeholder="Jitsi Meet" {...form.register('teleconsultationPlatform')} />
              </FormField>
              <FormField label="Access instructions">
                <Textarea placeholder="Tell the patient what to prepare before joining." {...form.register('teleconsultationAccessInstructions')} />
              </FormField>
            </div>
          ) : null}
          <FormField label="Reason for visit">
            <Input {...form.register('reason')} />
          </FormField>
          <FormField label="Internal notes">
            <Textarea {...form.register('notes')} />
          </FormField>
          <Button className="w-full" disabled={createAppointmentMutation.isPending} type="submit">
            {createAppointmentMutation.isPending ? 'Saving...' : 'Create appointment'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

