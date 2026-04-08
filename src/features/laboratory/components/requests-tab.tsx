import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FormField } from '../../../components/forms/form-field';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  createLabBookingRequest,
  deleteLabBookingRequest,
  listLabBookingRequests,
  updateLabBookingRequestStatus,
} from '../../../lib/local-db';
import { queryKeys } from '../../../lib/query-keys';
import { cn } from '../../../lib/utils';
import type { LabBookingRequest, LabBookingStatus } from '../../../types/domain';
import { LabStatusPill } from './lab-status-pill';

const labReqSchema = z.object({
  patientName: z.string().min(2),
  email: z.string().email(),
  labTestName: z.string().min(2),
  slotNumber: z.string().optional(),
});
type LabReqForm = z.infer<typeof labReqSchema>;

export function RequestsTab() {
  const qc = useQueryClient();
  const { data: requests = [] } = useQuery({
    queryKey: queryKeys.labBookingRequests,
    queryFn: async () => listLabBookingRequests(),
  });

  const [statusFilter, setStatusFilter] = useState<'All' | LabBookingStatus>('All');
  const [search, setSearch] = useState('');
  const [viewModal, setViewModal] = useState<LabBookingRequest | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const counts = useMemo(() => ({
    total: requests.length,
    Pending: requests.filter((r) => r.status === 'Pending').length,
    Confirmed: requests.filter((r) => r.status === 'Confirmed').length,
    Completed: requests.filter((r) => r.status === 'Completed').length,
    Cancelled: requests.filter((r) => r.status === 'Cancelled').length,
  }), [requests]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return requests.filter((r) => {
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      const matchSearch =
        !q ||
        r.patientName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.labTestName.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [requests, statusFilter, search]);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LabBookingStatus }) =>
      updateLabBookingRequestStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.labBookingRequests }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteLabBookingRequest(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.labBookingRequests });
      setDeleteId(null);
      setViewModal(null);
    },
  });

  const form = useForm<LabReqForm>({
    resolver: zodResolver(labReqSchema),
    defaultValues: { patientName: '', email: '', labTestName: '', slotNumber: '' },
  });

  const createMutation = useMutation({
    mutationFn: async (values: LabReqForm) =>
      createLabBookingRequest({
        patientName: values.patientName,
        email: values.email,
        labTestName: values.labTestName,
        slotNumber: values.slotNumber || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.labBookingRequests });
      form.reset({ patientName: '', email: '', labTestName: '', slotNumber: '' });
    },
  });

  const STATUS_FILTERS: Array<{ label: string; value: 'All' | LabBookingStatus; color: string; activeColor: string }> = [
    { label: `All (${counts.total})`, value: 'All', color: 'border-slate-200 bg-white text-slate-600', activeColor: 'bg-slate-800 text-white border-slate-800' },
    { label: `Pending (${counts.Pending})`, value: 'Pending', color: 'border-orange-200 bg-orange-50 text-orange-700', activeColor: 'bg-orange-600 text-white border-orange-600' },
    { label: `Confirmed (${counts.Confirmed})`, value: 'Confirmed', color: 'border-sky-200 bg-sky-50 text-sky-700', activeColor: 'bg-sky-600 text-white border-sky-600' },
    { label: `Completed (${counts.Completed})`, value: 'Completed', color: 'border-emerald-200 bg-emerald-50 text-emerald-700', activeColor: 'bg-emerald-600 text-white border-emerald-600' },
    { label: `Cancelled (${counts.Cancelled})`, value: 'Cancelled', color: 'border-rose-200 bg-rose-50 text-rose-700', activeColor: 'bg-rose-600 text-white border-rose-600' },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={cn(
                'px-4 py-2 border text-xs font-extrabold uppercase tracking-widest transition-colors',
                statusFilter === f.value ? f.activeColor : f.color,
              )}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Input placeholder="Search patient, email, or test…" value={search} onChange={(e) => setSearch(e.target.value)} />

        <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-400">No requests match the current filter.</div>
            ) : (
              filtered.map((req) => (
                <div key={req.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-950 truncate">{req.patientName}</p>
                      <p className="text-xs text-slate-500">{req.email}</p>
                      <p className="text-xs font-medium text-violet-700 mt-0.5">{req.labTestName}</p>
                      {req.slotNumber && <p className="text-[11px] text-slate-400 mt-0.5">Slot: {req.slotNumber}</p>}
                      {req.confirmedAt && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Confirmed: {new Date(req.confirmedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <LabStatusPill status={req.status} />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setViewModal(req)}
                          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(req.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-200"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(['Pending', 'Confirmed', 'Completed', 'Cancelled'] as LabBookingStatus[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={req.status === s || statusMutation.isPending}
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-widest px-2 py-1 border transition-colors',
                          req.status === s
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-100',
                        )}
                        onClick={() => void statusMutation.mutate({ id: req.id, status: s })}
                      >
                        {String.fromCharCode(8594)} {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-violet-700 px-6 py-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-violet-200">New Request</p>
          <p className="text-sm font-bold text-white mt-0.5">Submit Lab Booking</p>
        </div>
        <form
          className="divide-y divide-slate-100"
          onSubmit={form.handleSubmit(async (v) => void createMutation.mutate(v))}
        >
          <div className="px-6 py-5 space-y-4">
            <FormField label="Patient name" error={form.formState.errors.patientName?.message}>
              <Input {...form.register('patientName')} />
            </FormField>
            <FormField label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register('email')} />
            </FormField>
            <FormField label="Lab test name" error={form.formState.errors.labTestName?.message}>
              <Input {...form.register('labTestName')} />
            </FormField>
            <FormField label="Slot number (optional)">
              <Input {...form.register('slotNumber')} />
            </FormField>
          </div>
          <div className="px-6 py-4 bg-slate-50">
            <Button
              className="w-full rounded-none bg-violet-700 hover:bg-violet-800 font-extrabold uppercase tracking-widest text-sm py-5"
              disabled={createMutation.isPending}
              type="submit"
            >
              {createMutation.isPending ? 'Submitting…' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </div>

      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-violet-700">
              <p className="text-sm font-bold text-white">Lab Booking Details</p>
              <button type="button" onClick={() => setViewModal(null)} className="text-violet-200 hover:text-white">
                <X className="size-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3 text-sm">
              <div><span className="text-slate-400 text-xs uppercase tracking-widest font-bold">Patient</span><p className="font-semibold text-slate-950 mt-0.5">{viewModal.patientName}</p></div>
              <div><span className="text-slate-400 text-xs uppercase tracking-widest font-bold">Email</span><p className="mt-0.5">{viewModal.email}</p></div>
              <div><span className="text-slate-400 text-xs uppercase tracking-widest font-bold">Test</span><p className="font-semibold text-violet-700 mt-0.5">{viewModal.labTestName}</p></div>
              {viewModal.slotNumber && <div><span className="text-slate-400 text-xs uppercase tracking-widest font-bold">Slot</span><p className="mt-0.5">{viewModal.slotNumber}</p></div>}
              <div><span className="text-slate-400 text-xs uppercase tracking-widest font-bold">Status</span><div className="mt-1"><LabStatusPill status={viewModal.status} /></div></div>
              {viewModal.confirmedAt && <div><span className="text-slate-400 text-xs uppercase tracking-widest font-bold">Confirmed at</span><p className="mt-0.5">{new Date(viewModal.confirmedAt).toLocaleString()}</p></div>}
              <div><span className="text-slate-400 text-xs uppercase tracking-widest font-bold">Submitted</span><p className="mt-0.5">{new Date(viewModal.createdAt).toLocaleString()}</p></div>
              <div className="pt-2">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Update Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['Pending', 'Confirmed', 'Completed', 'Cancelled'] as LabBookingStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={viewModal.status === s || statusMutation.isPending}
                      className={cn(
                        'text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 border transition-colors',
                        viewModal.status === s
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-100',
                      )}
                      onClick={() => {
                        void statusMutation.mutateAsync({ id: viewModal.id, status: s }).then(() => {
                          setViewModal((prev) =>
                            prev
                              ? { ...prev, status: s, confirmedAt: s === 'Confirmed' ? new Date().toISOString() : prev.confirmedAt }
                              : null,
                          );
                        });
                      }}
                    >
                      {String.fromCharCode(8594)} {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-between">
              <button
                type="button"
                onClick={() => setDeleteId(viewModal.id)}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-rose-500 hover:text-rose-700"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
              <Button onClick={() => setViewModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-rose-600">
              <p className="text-sm font-bold text-white">Confirm Deletion</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700">This lab booking request will be permanently deleted. This action cannot be undone.</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex gap-3 justify-end">
              <button type="button" onClick={() => setDeleteId(null)} className="px-4 py-2 border border-slate-200 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => void deleteMutation.mutate(deleteId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
