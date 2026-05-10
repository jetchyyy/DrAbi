import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import {
  INTERNAL_SURFACE,
  INTERNAL_SURFACE_FOOTER,
  INTERNAL_SURFACE_PADDING,
} from '../../../lib/internal-ui';
import { getDatabase, listLabBookingRequests, listLabOrders } from '../../../lib/local-db';
import { queryKeys } from '../../../lib/query-keys';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import { useClinicLabQueue } from '../../lab-requests/hooks/use-lab-requests';

interface ClinicListRow {
  id: string;
  name: string;
}

type ReportRequestStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

function toReportStatus(status: string): ReportRequestStatus {
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'in_progress') return 'Confirmed';
  return 'Pending';
}

export function ReportTab() {
  const { data: localRequests = [] } = useQuery({
    queryKey: queryKeys.labBookingRequests,
    queryFn: async () => listLabBookingRequests(),
  });
  const { data: localOrders = [] } = useQuery({ queryKey: queryKeys.laboratory, queryFn: async () => listLabOrders() });
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
  const database = getDatabase();

  const requests = useMemo(
    () => [
      ...liveRequests.map((request) => ({
        labTestName: request.serviceName ?? request.serviceCategory,
        status: toReportStatus(request.status),
      })),
      ...localRequests.map((request) => ({
        labTestName: request.labTestName,
        status: request.status,
      })),
    ],
    [liveRequests, localRequests],
  );

  const orders = useMemo(
    () => [
      ...liveRequests.map((request) => ({ serviceName: request.serviceName ?? request.serviceCategory })),
      ...localOrders.map((order) => {
        const service = database.labServices.find((item) => item.id === order.labServiceId);
        return { serviceName: service?.name ?? 'Unknown' };
      }),
    ],
    [database.labServices, liveRequests, localOrders],
  );

  const testFrequency = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const r of requests) { freq[r.labTestName] = (freq[r.labTestName] ?? 0) + 1; }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [requests]);

  const maxFreq = testFrequency[0]?.[1] ?? 1;

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = { Pending: 0, Confirmed: 0, Completed: 0, Cancelled: 0 };
    for (const r of requests) { counts[r.status] = (counts[r.status] ?? 0) + 1; }
    return counts;
  }, [requests]);

  const ordersByService = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const o of orders) {
      const name = o.serviceName;
      freq[name] = (freq[name] ?? 0) + 1;
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [orders]);

  const maxOrders = ordersByService[0]?.[1] ?? 1;

  const STATUS_COLORS: Record<string, string> = {
    Pending: 'bg-orange-400',
    Confirmed: 'bg-sky-400',
    Completed: 'bg-emerald-500',
    Cancelled: 'bg-rose-400',
  };

  const totalRequests = requests.length;

  return (
    <div className="space-y-6">
      <div className={cn(INTERNAL_SURFACE, 'divide-y divide-slate-100/90')}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90">
              <BarChart3 className="size-5" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Laboratory</p>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Reports</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">Operational snapshot of laboratory request flow and service demand.</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-100/90 bg-slate-50/80 px-5 py-3 text-right shadow-inner">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total requests</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900">{totalRequests}</p>
          </div>
        </div>
        <div className={cn(INTERNAL_SURFACE_FOOTER, 'px-6 py-2.5')}>
          <span className="text-xs font-medium text-slate-600">Live workflow analytics</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Object.entries(statusBreakdown).map(([status, count]) => (
          <div key={status} className={INTERNAL_SURFACE_PADDING}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{status}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{count}</p>
            <p className="mt-1 text-xs text-slate-500">{totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0}% of requests</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className={INTERNAL_SURFACE}>
          <div className="border-b border-slate-100/90 px-6 py-4">
            <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Test Request Frequency</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Top requested tests from bookings</p>
          </div>
          <div className="px-6 py-5 space-y-3">
            {testFrequency.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No booking requests yet.</p>
            ) : (
              testFrequency.map(([name, count]) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700 truncate pr-3">{name}</span>
                    <span className="text-xs font-bold text-slate-950 shrink-0">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(count / maxFreq) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={INTERNAL_SURFACE}>
          <div className="border-b border-slate-100/90 px-6 py-4">
            <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Request Status Breakdown</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Distribution by booking status</p>
          </div>
          <div className="px-6 py-5 space-y-3">
            {Object.entries(statusBreakdown).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <div className={cn('size-2.5 shrink-0 rounded-full', STATUS_COLORS[status] ?? 'bg-slate-300')} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">{status}</span>
                    <span className="text-xs font-bold text-slate-950">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn('h-full rounded-full transition-all', STATUS_COLORS[status] ?? 'bg-slate-300')}
                      style={{ width: totalRequests > 0 ? `${(count / totalRequests) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={INTERNAL_SURFACE}>
        <div className="border-b border-slate-100/90 px-6 py-4">
          <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Lab Orders by Service</p>
          <p className="text-[11px] text-slate-400 mt-0.5">From the workflow module</p>
        </div>
        <div className="px-6 py-5 space-y-3">
          {ordersByService.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No lab orders yet.</p>
          ) : (
            ordersByService.map(([name, count]) => (
              <div key={name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 truncate pr-3">{name}</span>
                  <span className="text-xs font-bold text-slate-950 shrink-0">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-400 transition-all" style={{ width: `${(count / maxOrders) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
