import { Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  deleteLabBookingRequest,
  listLabBookingRequests,
  updateLabBookingRequestStatus,
} from '../../../lib/local-db';
import { queryKeys } from '../../../lib/query-keys';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import type { LabBookingRequest, LabBookingStatus } from '../../../types/domain';
import { useCancelLabRequest, useClinicLabQueue, useUpdateLabRequestDetails } from '../../lab-requests/hooks/use-lab-requests';
import { LabStatusPill } from './lab-status-pill';

interface ClinicListRow {
  id: string;
  name: string;
}

type RequestListItem = LabBookingRequest & {
  source: 'local' | 'supabase';
};

function toBookingStatus(status: string): LabBookingStatus {
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'in_progress') return 'Confirmed';
  return 'Pending';
}

function toLiveStatus(status: LabBookingStatus): 'pending' | 'in_progress' | 'completed' | 'cancelled' {
  if (status === 'Completed') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  if (status === 'Confirmed') return 'in_progress';
  return 'pending';
}

export function RequestsTab() {
  const qc = useQueryClient();
  const { data: localRequests = [] } = useQuery({
    queryKey: queryKeys.labBookingRequests,
    queryFn: async () => listLabBookingRequests(),
  });

  const { data: availableClinics = [] } = useQuery({
    queryKey: ['lab-form-clinics'],
    queryFn: async () => {
      if (!supabase) {
        return [] as ClinicListRow[];
      }

      const { data, error } = await supabase.from('clinics').select('id, name').order('name', { ascending: true });
      if (error) {
        throw error;
      }

      return (data ?? []) as ClinicListRow[];
    },
    enabled: Boolean(isSupabaseConfigured),
  });

  const resolvedClinicId = availableClinics[0]?.id ?? null;
  const { data: liveRequests = [] } = useClinicLabQueue(isSupabaseConfigured ? resolvedClinicId : null);
  const updateLiveMutation = useUpdateLabRequestDetails();
  const cancelLiveMutation = useCancelLabRequest();

  const [statusFilter, setStatusFilter] = useState<'All' | LabBookingStatus>('All');
  const [search, setSearch] = useState('');
  const [viewModal, setViewModal] = useState<RequestListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RequestListItem | null>(null);

  const requests = useMemo<RequestListItem[]>(() => {
    const mappedLive: RequestListItem[] = liveRequests.map((request) => ({
      id: request.id,
      patientName: request.patientName ?? 'Unknown patient',
      email: 'N/A',
      labTestName: request.serviceName ?? request.serviceCategory,
      slotNumber: null,
      status: toBookingStatus(request.status),
      confirmedAt: request.status === 'in_progress' ? request.updatedAt : null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      source: 'supabase',
    }));

    const mappedLocal = localRequests.map((request) => ({
      ...request,
      source: 'local' as const,
    }));

    return [...mappedLive, ...mappedLocal];
  }, [liveRequests, localRequests]);

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
    mutationFn: async ({ request, status }: { request: RequestListItem; status: LabBookingStatus }) => {
      if (request.source === 'supabase') {
        return updateLiveMutation.mutateAsync({
          requestId: request.id,
          status: toLiveStatus(status),
        });
      }

      return updateLabBookingRequestStatus(request.id, status);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.labBookingRequests });
      if (resolvedClinicId) {
        void qc.invalidateQueries({ queryKey: queryKeys.labQueue(resolvedClinicId) });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (request: RequestListItem) => {
      if (request.source === 'supabase') {
        return cancelLiveMutation.mutateAsync({
          requestId: request.id,
          reason: 'Cancelled from laboratory requests tab.',
        });
      }

      return deleteLabBookingRequest(request.id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.labBookingRequests });
      if (resolvedClinicId) {
        void qc.invalidateQueries({ queryKey: queryKeys.labQueue(resolvedClinicId) });
      }
      setDeleteTarget(null);
      setViewModal(null);
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
                        onClick={() => setDeleteTarget(req)}
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
                      onClick={() => void statusMutation.mutate({ request: req, status: s })}
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
                        void statusMutation.mutateAsync({ request: viewModal, status: s }).then(() => {
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
                onClick={() => setDeleteTarget(viewModal)}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-rose-500 hover:text-rose-700"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
              <Button onClick={() => setViewModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-rose-600">
              <p className="text-sm font-bold text-white">Confirm Deletion</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700">
                {deleteTarget.source === 'supabase'
                  ? 'This request will be marked as cancelled.'
                  : 'This lab booking request will be permanently deleted. This action cannot be undone.'}
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex gap-3 justify-end">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-slate-200 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => void deleteMutation.mutate(deleteTarget)}
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
