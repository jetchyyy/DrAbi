import { useMemo } from 'react';
import { BarChart3, Clock, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
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

function formatMinutes(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  const hours = Math.floor(mins / 60);
  const remaining = Math.round(mins % 60);
  return `${hours}h ${remaining}m`;
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

  // TAT metrics from live requests
  const { data: tatData = [] } = useQuery({
    queryKey: ['lis-tat-metrics', resolvedClinicId],
    queryFn: async () => {
      if (!supabase || !resolvedClinicId) return [];
      const { data, error } = await (supabase as any)
        .from('service_requests')
        .select('tat_minutes, service_category, created_at, completed_at')
        .eq('clinic_id', resolvedClinicId)
        .eq('status', 'completed')
        .not('tat_minutes', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(200);
      if (error) return [];
      return (data ?? []) as any[];
    },
    enabled: isSupabaseConfigured && Boolean(resolvedClinicId),
  });

  // Abnormal result rates
  const { data: abnormalData = { total: 0, abnormal: 0 } } = useQuery({
    queryKey: ['lis-abnormal-rates', resolvedClinicId],
    queryFn: async () => {
      if (!supabase) return { total: 0, abnormal: 0 };
      const { data: allResults, error } = await (supabase as any)
        .from('lab_result_entries')
        .select('abnormal_flag')
        .limit(1000);
      if (error) return { total: 0, abnormal: 0 };
      const entries = (allResults ?? []) as any[];
      const abnormal = entries.filter((e: any) => e.abnormal_flag !== 'normal').length;
      return { total: entries.length, abnormal };
    },
    enabled: isSupabaseConfigured,
  });

  const requests = useMemo(
    () => [
      ...liveRequests.map((request) => ({
        labTestName: request.serviceName ?? request.serviceCategory,
        status: toReportStatus(request.status),
        createdAt: request.createdAt,
        completedAt: request.completedAt,
      })),
      ...localRequests.map((request) => ({
        labTestName: request.labTestName,
        status: request.status as ReportRequestStatus,
        createdAt: request.createdAt,
        completedAt: null as string | null,
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

  // TAT computations
  const tatMetrics = useMemo(() => {
    if (tatData.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
    const minutes = tatData.map((d: any) => Number(d.tat_minutes)).filter((m: number) => m > 0);
    if (minutes.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
    const avg = minutes.reduce((a: number, b: number) => a + b, 0) / minutes.length;
    return { avg, min: Math.min(...minutes), max: Math.max(...minutes), count: minutes.length };
  }, [tatData]);

  // Completion rate
  const completionRate = useMemo(() => {
    const total = requests.length;
    if (total === 0) return 0;
    const completed = requests.filter((r) => r.status === 'Completed').length;
    return Math.round((completed / total) * 100);
  }, [requests]);

  const STATUS_COLORS: Record<string, string> = {
    Pending: 'bg-slate-400',
    Confirmed: 'bg-slate-500',
    Completed: 'bg-emerald-500',
    Cancelled: 'bg-red-400',
  };

  const totalRequests = requests.length;
  const abnormalRate = abnormalData.total > 0 ? Math.round((abnormalData.abnormal / abnormalData.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className={cn(INTERNAL_SURFACE, 'divide-y divide-slate-100/90')}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90">
              <BarChart3 className="size-5" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Laboratory Information System</p>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">LIS Analytics</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">Complete operational analytics including TAT, abnormal rates, and test demand.</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-100/90 bg-slate-50/80 px-5 py-3 text-right shadow-inner">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total requests</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900">{totalRequests}</p>
          </div>
        </div>
        <div className={cn(INTERNAL_SURFACE_FOOTER, 'px-6 py-2.5')}>
          <span className="text-xs font-medium text-slate-600">Live LIS workflow analytics</span>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {Object.entries(statusBreakdown).map(([status, count]) => (
          <div key={status} className={INTERNAL_SURFACE_PADDING}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{status}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{count}</p>
            <p className="mt-1 text-xs text-slate-500">{totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0}% of requests</p>
          </div>
        ))}
        {/* Completion Rate */}
        <div className={INTERNAL_SURFACE_PADDING}>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-emerald-600" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Completion Rate</p>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-700">{completionRate}%</p>
          <p className="mt-1 text-xs text-slate-500">of all requests</p>
        </div>
        {/* Abnormal Rate */}
        <div className={INTERNAL_SURFACE_PADDING}>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-slate-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Abnormal Rate</p>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{abnormalRate}%</p>
          <p className="mt-1 text-xs text-slate-500">{abnormalData.abnormal} of {abnormalData.total} results</p>
        </div>
      </div>

      {/* TAT Analytics */}
      <div className={cn(INTERNAL_SURFACE, 'divide-y divide-slate-100/90')}>
        <div className="border-b border-slate-100/90 px-6 py-4">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-slate-500" />
            <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Turnaround Time (TAT) Analytics</p>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Average time from lab order creation to completion</p>
        </div>
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Average TAT</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{tatMetrics.count > 0 ? formatMinutes(tatMetrics.avg) : '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Fastest</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{tatMetrics.count > 0 ? formatMinutes(tatMetrics.min) : '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Slowest</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{tatMetrics.count > 0 ? formatMinutes(tatMetrics.max) : '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Completed Tests</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{tatMetrics.count}</p>
          </div>
        </div>
        {tatMetrics.count > 0 && (
          <div className="px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">TAT Distribution</p>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${Math.min(100, (tatMetrics.min / tatMetrics.max) * 100)}%` }}
                title={`Min: ${formatMinutes(tatMetrics.min)}`}
              />
              <div
                className="h-full bg-green-500"
                style={{ width: `${Math.min(100, ((tatMetrics.avg - tatMetrics.min) / tatMetrics.max) * 100)}%` }}
                title={`Avg: ${formatMinutes(tatMetrics.avg)}`}
              />
              <div
                className="h-full bg-red-400 flex-1"
                title={`Max: ${formatMinutes(tatMetrics.max)}`}
              />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-slate-400">
              <span>Min: {formatMinutes(tatMetrics.min)}</span>
              <span>Avg: {formatMinutes(tatMetrics.avg)}</span>
              <span>Max: {formatMinutes(tatMetrics.max)}</span>
            </div>
          </div>
        )}
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
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-slate-600" />
            <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Lab Orders by Service</p>
          </div>
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
