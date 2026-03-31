import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarCheck2, Clock, Video } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
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
  teleconsultationUrl: z.string().optional(),
  teleconsultationAccessInstructions: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

function StatusPill({ status }: { status: string }) {
  const label = status.replace('_', ' ');
  if (status === 'confirmed' || status === 'completed') return <span className="bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">{label}</span>;
  if (status === 'cancelled' || status === 'no_show') return <span className="bg-rose-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-rose-700">{label}</span>;
  if (status === 'in_progress') return <span className="bg-sky-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-sky-700">{label}</span>;
  return <span className="bg-orange-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-700">{label}</span>;
}

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
      teleconsultationUrl: '',
      teleconsultationAccessInstructions: '',
    },
  });

  const visitType = useWatch({ control: form.control, name: 'visitType' });

  const onSubmit = form.handleSubmit(async (values) => {
    await createAppointmentMutation.mutateAsync({
      ...values,
      scheduledAt: new Date(values.scheduledAt).toISOString(),
      teleconsultationPlatform: values.visitType === 'teleconsultation' ? values.teleconsultationPlatform || 'Jitsi Meet' : undefined,
      teleconsultationUrl: values.visitType === 'teleconsultation' ? values.teleconsultationUrl || undefined : undefined,
      teleconsultationAccessInstructions: values.visitType === 'teleconsultation' ? values.teleconsultationAccessInstructions || undefined : undefined,
    });

    form.reset({
      ...values,
      reason: '',
      notes: '',
      teleconsultationPlatform: 'Jitsi Meet',
      teleconsultationUrl: '',
      teleconsultationAccessInstructions: '',
    });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 bg-orange-600 p-2 text-white">
              <CalendarCheck2 className="size-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-slate-950">Operations</p>
              <p className="text-[11px] font-medium text-slate-400">Appointments and Queue</p>
            </div>
          </div>
          <Badge intent="info" className="rounded-none text-[10px] font-bold uppercase tracking-widest">
            Teleconsultation-ready
          </Badge>
        </div>
        <div className="divide-y divide-slate-100">
          {appointments.map((appointment) => {
            const patient = database.patients.find((item) => item.id === appointment.patientId);
            const doctor = database.users.find((item) => item.id === appointment.doctorId);
            const service = database.services.find((item) => item.id === appointment.serviceId);

            return (
              <div key={appointment.id} className="px-6 py-4 transition-colors hover:bg-slate-50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-orange-100 bg-orange-50 text-xs font-extrabold text-orange-700">
                      {patient?.firstName?.[0]}
                      {patient?.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-950">
                        {patient?.firstName} {patient?.lastName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {doctor?.fullName} - {service?.name}
                      </p>
                      {appointment.reason ? <p className="mt-1 text-xs italic text-slate-400">{appointment.reason}</p> : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusPill status={appointment.status} />
                    <p className="mt-1.5 flex items-center justify-end gap-1 text-xs text-slate-500">
                      <Clock className="size-3" />
                      {formatDateTimeLabel(appointment.scheduledAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {appointment.visitType === 'teleconsultation' ? (
                    <span className="inline-flex items-center gap-1 bg-sky-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-sky-700">
                      <Video className="size-3" /> Teleconsultation
                    </span>
                  ) : (
                    <span className="bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-600">In Person</span>
                  )}
                  {appointment.teleconsultationPlatform ? (
                    <span className="bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-600">
                      {appointment.teleconsultationPlatform}
                    </span>
                  ) : null}
                </div>
                {appointment.teleconsultationUrl ? <p className="mt-2 text-xs text-slate-400">Join: {appointment.teleconsultationUrl}</p> : null}
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
      </div>

      <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="bg-orange-600 px-6 py-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">New Appointment</p>
          <p className="mt-0.5 text-sm font-bold text-white">Schedule Appointment</p>
        </div>
        <form className="divide-y divide-slate-100" onSubmit={onSubmit}>
          <div className="space-y-4 px-6 py-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient and Provider</p>
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
                  {database.users
                    .filter((user) => user.role === 'doctor')
                    .map((doctor) => (
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
          </div>
          <div className="space-y-4 px-6 py-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Appointment Details</p>
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
          </div>
          {visitType === 'teleconsultation' ? (
            <div className="space-y-4 px-6 py-5">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Teleconsultation</p>
              <FormField label="Platform">
                <Input placeholder="Jitsi Meet" {...form.register('teleconsultationPlatform')} />
              </FormField>
              <FormField label="URL">
                <Input placeholder="https://..." {...form.register('teleconsultationUrl')} />
              </FormField>
              <FormField label="Access instructions">
                <Textarea placeholder="Tell the patient what to prepare before joining." {...form.register('teleconsultationAccessInstructions')} />
              </FormField>
            </div>
          ) : null}
          <div className="space-y-4 px-6 py-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Notes</p>
            <FormField label="Reason for visit">
              <Input {...form.register('reason')} />
            </FormField>
            <FormField label="Internal notes">
              <Textarea {...form.register('notes')} />
            </FormField>
          </div>
          <div className="bg-slate-50 px-6 py-4">
            <Button className="w-full rounded-none bg-orange-600 py-5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700" disabled={createAppointmentMutation.isPending} type="submit">
              {createAppointmentMutation.isPending ? 'Saving...' : 'Create Appointment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
