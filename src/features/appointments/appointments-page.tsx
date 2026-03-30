import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarCheck2, Clock, Video } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { createAppointment, getDatabase } from '../../lib/local-db';
import { formatDateTimeLabel } from '../../lib/utils';
import { useAppointments } from './hooks/use-appointments';

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
  if (status === 'confirmed' || status === 'completed') return <span className="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{label}</span>;
  if (status === 'cancelled' || status === 'no_show') return <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{label}</span>;
  if (status === 'in_progress') return <span className="bg-sky-100 text-sky-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{label}</span>;
  return <span className="bg-orange-100 text-orange-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{label}</span>;
}

export function AppointmentsPage() {
  const database = getDatabase();
  const { data: appointments = [] } = useAppointments();
  const createAppointmentMutation = useMutation({
    mutationFn: async (values: Omit<AppointmentFormValues, 'scheduledAt'> & { scheduledAt: string }) =>
      createAppointment(values),
  });
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
      teleconsultationPlatform: '',
      teleconsultationUrl: '',
      teleconsultationAccessInstructions: '',
    },
  });

  const visitType = useWatch({ control: form.control, name: 'visitType' });

  const onSubmit = form.handleSubmit(async (values) => {
    await createAppointmentMutation.mutateAsync({
      ...values,
      scheduledAt: new Date(values.scheduledAt).toISOString(),
      teleconsultationPlatform: values.visitType === 'teleconsultation' ? values.teleconsultationPlatform || undefined : undefined,
      teleconsultationUrl: values.visitType === 'teleconsultation' ? values.teleconsultationUrl || undefined : undefined,
      teleconsultationAccessInstructions: values.visitType === 'teleconsultation' ? values.teleconsultationAccessInstructions || undefined : undefined,
    });
    form.reset({ ...values, reason: '', notes: '', teleconsultationPlatform: '', teleconsultationUrl: '', teleconsultationAccessInstructions: '' });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      {/* Appointment list */}
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-600 text-white shrink-0">
              <CalendarCheck2 className="size-4" />
            </div>
            <div>
              <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Operations</p>
              <p className="text-[11px] text-slate-400 font-medium">Appointments & Queue</p>
            </div>
          </div>
          <Badge intent="info" className="rounded-none text-[10px] uppercase tracking-widest font-bold">Teleconsultation-ready</Badge>
        </div>
        <div className="divide-y divide-slate-100">
          {appointments.map((appointment) => {
            const patient = database.patients.find((item) => item.id === appointment.patientId);
            const doctor = database.users.find((item) => item.id === appointment.doctorId);
            const service = database.services.find((item) => item.id === appointment.serviceId);
            return (
              <div key={appointment.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0 text-orange-700 text-xs font-extrabold mt-0.5">
                      {patient?.firstName?.[0]}{patient?.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-950">{patient?.firstName} {patient?.lastName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{doctor?.fullName} · {service?.name}</p>
                      {appointment.reason && <p className="text-xs text-slate-400 mt-1 italic">{appointment.reason}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusPill status={appointment.status} />
                    <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1 justify-end">
                      <Clock className="size-3" />{formatDateTimeLabel(appointment.scheduledAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {appointment.visitType === 'teleconsultation' ? (
                    <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">
                      <Video className="size-3" /> Teleconsultation
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">In Person</span>
                  )}
                  {appointment.teleconsultationPlatform && (
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{appointment.teleconsultationPlatform}</span>
                  )}
                </div>
                {appointment.teleconsultationUrl && (
                  <p className="mt-2 text-xs text-slate-400">Join: {appointment.teleconsultationUrl}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule form */}
      <div className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-orange-600 px-6 py-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">New Appointment</p>
          <p className="text-sm font-bold text-white mt-0.5">Schedule Appointment</p>
        </div>
        <form className="divide-y divide-slate-100" onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient & Provider</p>
            <FormField label="Patient">
              <Select {...form.register('patientId')}>
                {database.patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>
                ))}
              </Select>
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Doctor">
                <Select {...form.register('doctorId')}>
                  {database.users.filter((user) => user.role === 'doctor').map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Specialty">
                <Select {...form.register('specialtyId')}>
                  {database.specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </FormField>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Appointment Details</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Service">
                <Select {...form.register('serviceId')}>
                  {database.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
          {visitType === 'teleconsultation' && (
            <div className="px-6 py-5 space-y-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Teleconsultation</p>
              <FormField label="Platform"><Input placeholder="Zoom, Google Meet…" {...form.register('teleconsultationPlatform')} /></FormField>
              <FormField label="URL"><Input placeholder="https://…" {...form.register('teleconsultationUrl')} /></FormField>
              <FormField label="Access instructions"><Textarea {...form.register('teleconsultationAccessInstructions')} /></FormField>
            </div>
          )}
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Notes</p>
            <FormField label="Reason for visit"><Input {...form.register('reason')} /></FormField>
            <FormField label="Internal notes"><Textarea {...form.register('notes')} /></FormField>
          </div>
          <div className="px-6 py-4 bg-slate-50">
            <Button className="w-full rounded-none bg-orange-600 hover:bg-orange-700 font-extrabold uppercase tracking-widest text-sm py-5" disabled={createAppointmentMutation.isPending} type="submit">
              {createAppointmentMutation.isPending ? 'Saving…' : 'Create Appointment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
