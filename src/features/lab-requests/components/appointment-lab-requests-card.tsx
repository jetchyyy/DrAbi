import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ImageIcon, Plus, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';

import { FormField } from '../../../components/forms/form-field';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { formatCurrency, formatDateTimeLabel } from '../../../lib/utils';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { useCreateLabRequest, useAppointmentLabRequests } from '../hooks/use-lab-requests';
import type { LabRequestRecord } from '../types';
import { LabStatusPill } from '../../laboratory/components/lab-status-pill';

const requestSchema = z.object({
  serviceId: z.string().min(1, 'Choose a laboratory service.'),
  serviceCategory: z.string().min(1, 'Choose a laboratory service.'),
  patientNotes: z.string().optional(),
  urgentFlag: z.boolean(),
});

type RequestForm = z.infer<typeof requestSchema>;

type ServiceOption = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  service_fee: number;
};

interface AppointmentLabRequestsCardProps {
  appointmentId: string | null;
  patientId: string;
  requestedBy: string;
  title?: string;
  canCreate?: boolean;
  compact?: boolean;
}

function isImageMedia(fileName: string, mimeType: string | null) {
  return Boolean(mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName));
}

function RequestItem({ request }: { request: LabRequestRecord }) {
  const hasMedia = request.media.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-950">{request.serviceName ?? request.serviceCategory}</p>
          <p className="mt-1 text-xs text-slate-500">Requested by {request.requestedByName ?? 'clinic staff'}</p>
          {request.patientNotes ? <p className="mt-2 text-sm text-slate-600">{request.patientNotes}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <LabStatusPill status={request.status} />
          {request.urgentFlag ? (
            <Badge intent="danger">
              <AlertTriangle className="mr-1 size-3" />
              Urgent
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Sample status</p>
          <p className="mt-1 font-semibold text-slate-800">{request.sampleStatus}</p>
        </div>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Result status</p>
          <p className="mt-1 font-semibold text-slate-800">{request.resultStatus}</p>
        </div>
      </div>

      {request.resultNotes ? (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/80 p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Result notes</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-emerald-950">{request.resultNotes}</p>
        </div>
      ) : null}

      {request.resultData ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Result summary</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{request.resultData}</p>
        </div>
      ) : null}

      {hasMedia ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">
            <ImageIcon className="size-3.5" />
            Attachments
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {request.media.map((attachment) => (
              <a
                key={attachment.id}
                className="block overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:shadow-sm"
                href={attachment.fileUrl}
                rel="noreferrer"
                target="_blank"
              >
                {isImageMedia(attachment.fileName, attachment.mimeType) ? (
                  <img alt={attachment.fileName} className="aspect-[4/3] w-full object-cover" src={attachment.fileUrl} />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-slate-50 px-4 text-center text-xs font-semibold text-slate-500">
                    {attachment.fileName}
                  </div>
                )}
                <div className="border-t border-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                  {attachment.fileName}
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-slate-400">{formatDateTimeLabel(request.createdAt)}</p>
    </div>
  );
}

export function AppointmentLabRequestsCard({
  appointmentId,
  patientId,
  requestedBy,
  title = 'Lab requests',
  canCreate = false,
  compact = false,
}: AppointmentLabRequestsCardProps) {
  const [isFormOpen, setIsFormOpen] = useState(!compact);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const createLabRequest = useCreateLabRequest();
  const { data: requests = [], isLoading } = useAppointmentLabRequests(appointmentId);

  const { data: serviceOptions = [], error: serviceOptionsError } = useQuery({
    queryKey: ['lab-request-services'],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) {
        return [] as ServiceOption[];
      }

      const { data, error } = await supabase
        .from('medical_services')
        .select('id, name, description, category, service_fee')
        .eq('department', 'Laboratory')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as ServiceOption[];
    },
    enabled: Boolean(isSupabaseConfigured),
  });

  const requestForm = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      serviceId: '',
      serviceCategory: '',
      patientNotes: '',
      urgentFlag: false,
    },
  });

  const servicesState = serviceOptions;

  const form = requestForm;

  const normalizedServices = useMemo(() => {
    const q = deferredSearch.toLowerCase();
    return servicesState.filter((service) =>
      `${service.name} ${service.description ?? ''} ${service.category}`.toLowerCase().includes(q),
    );
  }, [deferredSearch, servicesState]);

  const selectedServiceId = form.watch('serviceId');

  const submitRequest = form.handleSubmit(async (values) => {
    const selectedService = servicesState.find((service) => service.id === values.serviceId);
    if (!selectedService) {
      return;
    }

    await createLabRequest.mutateAsync({
      clinicId: null,
      patientId,
      requestedBy,
      appointmentId,
      serviceId: values.serviceId,
      serviceCategory: values.serviceCategory,
      patientNotes: values.patientNotes?.trim() || '',
      urgentFlag: values.urgentFlag,
    });

    form.reset({
      serviceId: '',
      serviceCategory: '',
      patientNotes: '',
      urgentFlag: false,
    });
    setIsFormOpen(false);
  });

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-violet-700">{title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {appointmentId ? 'This appointment-linked request history is shared between the doctor, lab, and patient record.' : 'Select an appointment first to create a lab request.'}
          </p>
        </div>
        {canCreate ? (
          <Button className="rounded-none bg-violet-700 px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest hover:bg-violet-800" type="button" onClick={() => setIsFormOpen((current) => !current)}>
            <Plus className="mr-2 size-4" />
            {isFormOpen ? 'Hide request form' : 'Request service'}
          </Button>
        ) : null}
      </div>

      {canCreate && isFormOpen ? (
        <form className="space-y-4 border-t border-slate-100 pt-4" onSubmit={submitRequest}>
          {!isSupabaseConfigured ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Supabase is not configured, so live lab requests are unavailable.
            </div>
          ) : null}

          {isSupabaseConfigured && serviceOptions.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No active laboratory services were found in the Supabase medical_services table.
              Add rows with department = Laboratory and is_active = true to populate this dropdown.
            </div>
          ) : null}

          {serviceOptionsError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Unable to load laboratory services: {serviceOptionsError instanceof Error ? serviceOptionsError.message : 'Unknown query error.'}
            </div>
          ) : null}

          <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
            <Search className="size-4 shrink-0 text-slate-400" />
            <Input
              className="border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search lab services"
              value={search}
            />
          </div>

          <FormField error={form.formState.errors.serviceId?.message} label="Lab service">
            <Select
              {...form.register('serviceId', {
                onChange: (event) => {
                  const selected = servicesState.find((entry) => entry.id === event.target.value);
                  form.setValue('serviceCategory', selected?.category ?? '', { shouldValidate: true });
                },
              })}
              disabled={serviceOptions.length === 0}
            >
              <option value="">Select a laboratory service</option>
              {normalizedServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} - {formatCurrency(Number(service.service_fee ?? 0))}
                </option>
              ))}
            </Select>
          </FormField>

          {selectedServiceId ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{servicesState.find((service) => service.id === selectedServiceId)?.name ?? 'Selected service'}</p>
              <p className="mt-1">{servicesState.find((service) => service.id === selectedServiceId)?.description ?? 'No description available.'}</p>
            </div>
          ) : null}

          <input type="hidden" {...form.register('serviceCategory')} />

          <FormField label="Doctor notes" error={form.formState.errors.patientNotes?.message}>
            <Textarea rows={3} placeholder="Optional details or clinical notes for the laboratory team" {...form.register('patientNotes')} />
          </FormField>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input className="accent-violet-600" type="checkbox" {...form.register('urgentFlag')} />
            Mark as urgent
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button className="rounded-none" type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-none bg-violet-700 font-extrabold uppercase tracking-widest hover:bg-violet-800" disabled={createLabRequest.isPending} type="submit">
              {createLabRequest.isPending ? 'Sending...' : 'Send request'}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            {requests.length} request{requests.length !== 1 ? 's' : ''}
          </p>
          {appointmentId ? <Badge intent="info">Appointment linked</Badge> : <Badge intent="warning">No appointment</Badge>}
        </div>

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading lab requests...</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-slate-500">No lab requests recorded for this appointment yet.</p>
          ) : (
            requests.map((request) => <RequestItem key={request.id} request={request} />)
          )}
        </div>
      </div>
    </div>
  );
}
