import { ClipboardList, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '../../../components/ui/button';
import {
  deleteLabBookingRequest,
  listLabBookingRequests,
  updateLabBookingRequestStatus,
} from '../../../lib/local-db';
import { queryKeys } from '../../../lib/query-keys';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import type { LabBookingRequest, LabBookingStatus } from '../../../types/domain';
import { useAuth } from '../../auth/auth-context';
import { useCancelLabRequest, useClinicLabQueue, useConfirmLabRequestByFrontDesk, useUpdateLabRequestDetails } from '../../lab-requests/hooks/use-lab-requests';
import { toLabRequestDisplayStatus, toLabRequestLiveStatus } from './lab-request-status';
import { LabStatusPill } from './lab-status-pill';

interface ClinicListRow {
  id: string;
  name: string;
}

const LAB_REQUEST_SCHEDULES_KEY = 'odc.lab-request-schedules.v1';

function loadSupabaseSchedules(): Record<string, { date: string; time: string }> {
  if (typeof window === 'undefined') {
    return {};
  }

  const raw = window.localStorage.getItem(LAB_REQUEST_SCHEDULES_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, { date: string; time: string }>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

type RequestListItem = LabBookingRequest & {
  paymentStatus: 'pending_cashier' | 'paid' | string;
  receiptCode: string | null;
  source: 'local' | 'supabase';
};

export function RequestsTab() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'patient';
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
  const confirmByFrontDeskMutation = useConfirmLabRequestByFrontDesk();
  const cancelLiveMutation = useCancelLabRequest();

  const [statusFilter, setStatusFilter] = useState<'All' | LabBookingStatus>('All');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewModal, setViewModal] = useState<RequestListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RequestListItem | null>(null);
  const [supabaseSchedules, setSupabaseSchedules] = useState<Record<string, { date: string; time: string }>>(() => loadSupabaseSchedules());

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LAB_REQUEST_SCHEDULES_KEY) {
        return;
      }

      setSupabaseSchedules(loadSupabaseSchedules());
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const requests = useMemo<RequestListItem[]>(() => {
    const mappedLive: RequestListItem[] = liveRequests.map((request) => ({
      id: request.id,
      patientName: request.patientName ?? 'Unknown patient',
      email: 'N/A',
      labTestName: request.serviceName ?? request.serviceCategory,
      slotNumber: null,
      status: toLabRequestDisplayStatus(request.status, Boolean(supabaseSchedules[request.id])),
      confirmedAt: request.status === 'in_progress' ? request.updatedAt : null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      paymentStatus: request.paymentStatus,
      receiptCode: request.receiptCode,
      source: 'supabase',
    }));

    const mappedLocal: RequestListItem[] = localRequests.map((request) => ({
      ...request,
      paymentStatus: 'pending_cashier',
      receiptCode: null,
      source: 'local' as const,
    }));

    return [...mappedLive, ...mappedLocal];
  }, [liveRequests, localRequests, supabaseSchedules]);

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
        r.labTestName.toLowerCase().includes(q) ||
        (r.receiptCode ?? '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [requests, statusFilter, search]);

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [currentPage, filtered]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const statusMutation = useMutation({
    mutationFn: async ({ request, status }: { request: RequestListItem; status: LabBookingStatus }) => {
      if (request.source === 'supabase') {
        if (role === 'front_desk_cashier' && status === 'Confirmed') {
          return confirmByFrontDeskMutation.mutateAsync(request.id);
        }

        return updateLiveMutation.mutateAsync({
          requestId: request.id,
          status: toLabRequestLiveStatus(status),
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
  const STATUS_OPTIONS: LabBookingStatus[] = role === 'front_desk_cashier'
    ? ['Pending', 'Confirmed', 'Cancelled']
    : ['Pending', 'Confirmed', 'Completed', 'Cancelled'];

  const handleRowStatusChange = (request: RequestListItem, nextStatus: LabBookingStatus) => {
    if (request.status === nextStatus || statusMutation.isPending) {
      return;
    }

    void statusMutation.mutate({ request, status: nextStatus });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="shrink-0 bg-violet-700 p-2.5 text-white">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-violet-700">Laboratory Workflow</p>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-950">Requests</h2>
              <p className="mt-1 text-sm text-slate-500">Track status, triage updates, and manage incoming lab requests.</p>
            </div>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="Search patient, email, or test"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
          <span className="text-xs font-bold text-slate-500">{filtered.length} request{filtered.length !== 1 ? 's' : ''} found</span>
        </div>
      </div>

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

      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Patient</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Email</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Test</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Created</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Receipt</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Payment</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Status</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Update</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-slate-400" colSpan={9}>No requests match the current filter.</td>
                </tr>
              ) : (
                paginatedRequests.map((req) => (
                  <tr key={req.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-2.5 align-top">
                      <p className="font-semibold text-xs text-slate-900 truncate max-w-40">{req.patientName}</p>
                      {req.slotNumber ? <p className="text-[10px] text-slate-400 mt-0.5">Slot: {req.slotNumber}</p> : null}
                      {req.confirmedAt ? <p className="text-[10px] text-slate-400 mt-0.5">Confirmed: {new Date(req.confirmedAt).toLocaleDateString()}</p> : null}
                    </td>
                    <td className="px-4 py-2.5 align-top text-xs text-slate-600 max-w-44 truncate">{req.email}</td>
                    <td className="px-4 py-2.5 align-top text-xs font-semibold text-violet-700 max-w-52 truncate">{req.labTestName}</td>
                    <td className="px-4 py-2.5 align-top text-[11px] text-slate-600 whitespace-nowrap">{new Date(req.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2.5 align-top text-[11px] text-slate-600 font-mono whitespace-nowrap">{req.receiptCode ?? 'N/A'}</td>
                    <td className="px-4 py-2.5 align-top">
                      <span className={cn(
                        'px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest',
                        req.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700',
                      )}
                      >
                        {req.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <LabStatusPill status={req.status} />
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <select
                        value={req.status}
                        disabled={statusMutation.isPending}
                        onChange={(event) => handleRowStatusChange(req, event.target.value as LabBookingStatus)}
                        className="h-8 w-32 border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 focus:border-violet-500 focus:outline-none"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewModal(req)}
                          className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs text-slate-500">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-600">Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
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
