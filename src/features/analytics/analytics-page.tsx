import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Coins,
  Minus,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { queryKeys } from '../../lib/query-keys';
import {
  listInvoicesLiveOrDemo,
  listPatientsLiveOrDemo,
  listPosSalesLiveOrDemo,
  listServicesLiveOrDemo,
} from '../../lib/supabase-clinic';
import { useAppointments } from '../appointments/hooks/use-appointments';
import {
  INTERNAL_SURFACE,
  INTERNAL_SURFACE_PADDING,
  INTERNAL_TABLE,
  INTERNAL_TD,
  INTERNAL_TH,
  INTERNAL_THEAD_ROW,
  INTERNAL_TR,
  INTERNAL_TABLE_SCROLL,
} from '../../lib/internal-ui';
import { cn, formatCurrency } from '../../lib/utils';

type Period = '7d' | '30d' | '90d' | '12m' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  '12m': '12 Months',
  all: 'All Time',
};

const BRAND_GREEN = '#4cb154';
const BRAND_RED = '#ef282c';
const SLATE_400 = '#94a3b8';
const SLATE_200 = '#e2e8f0';

const iconCls =
  'bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] text-[var(--color-primary)] ring-1 ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]';

function TrendBadge({ trend, suffix = 'vs last period' }: { trend: number; suffix?: string }) {
  if (trend === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
        <Minus className="size-3 shrink-0" strokeWidth={2.5} />
        No change · {suffix}
      </span>
    );
  }
  if (trend > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700 ring-1 ring-green-100">
        <ArrowUpRight className="size-3 shrink-0" strokeWidth={2.5} />
        +{trend}% · {suffix}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100">
      <ArrowDownRight className="size-3 shrink-0" strokeWidth={2.5} />
      {trend}% · {suffix}
    </span>
  );
}

export function AnalyticsContent() {
  const [period, setPeriod] = useState<Period>('30d');

  const { data: appointments = [], isLoading: appointmentsLoading } = useAppointments();
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: queryKeys.invoices,
    queryFn: listInvoicesLiveOrDemo,
  });
  const { data: posSales = [], isLoading: posSalesLoading } = useQuery({
    queryKey: queryKeys.posSales,
    queryFn: listPosSalesLiveOrDemo,
  });
  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: queryKeys.patients,
    queryFn: listPatientsLiveOrDemo,
  });
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: queryKeys.services,
    queryFn: listServicesLiveOrDemo,
  });

  const isLoading =
    appointmentsLoading || invoicesLoading || posSalesLoading || patientsLoading || servicesLoading;

  const dateRanges = useMemo(() => {
    const now = new Date();
    const currentStart = new Date();
    const prevStart = new Date();
    const prevEnd = new Date();
    let hasComparison = true;

    if (period === '7d') {
      currentStart.setDate(now.getDate() - 7);
      prevStart.setDate(now.getDate() - 14);
      prevEnd.setDate(now.getDate() - 7);
    } else if (period === '30d') {
      currentStart.setDate(now.getDate() - 30);
      prevStart.setDate(now.getDate() - 60);
      prevEnd.setDate(now.getDate() - 30);
    } else if (period === '90d') {
      currentStart.setDate(now.getDate() - 90);
      prevStart.setDate(now.getDate() - 180);
      prevEnd.setDate(now.getDate() - 90);
    } else if (period === '12m') {
      currentStart.setFullYear(now.getFullYear() - 1);
      prevStart.setFullYear(now.getFullYear() - 2);
      prevEnd.setFullYear(now.getFullYear() - 1);
    } else {
      hasComparison = false;
    }

    return { currentStart, prevStart, prevEnd, hasComparison };
  }, [period]);

  const isWithinRange = (dateStr: string | Date, start: Date, end?: Date) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    return end ? d >= start && d < end : d >= start;
  };

  const metrics = useMemo(() => {
    const currentApps = appointments.filter((a) =>
      period === 'all' ? true : isWithinRange(a.scheduledAt, dateRanges.currentStart),
    );
    const completedAppsCurrent = currentApps.filter((a) => a.status === 'completed').length;
    const currentPatientsCount = patients.filter((p) =>
      period === 'all' ? true : isWithinRange(p.createdAt, dateRanges.currentStart),
    ).length;
    const currentPaidInvoices = invoices.filter(
      (inv) =>
        inv.paymentStatus === 'paid' &&
        (period === 'all' ? true : isWithinRange(inv.createdAt, dateRanges.currentStart)),
    );
    const billingRevenueCurrent = currentPaidInvoices.reduce((s, inv) => s + inv.total, 0);
    const currentPosSales = posSales.filter((sale) =>
      period === 'all' ? true : isWithinRange(sale.createdAt, dateRanges.currentStart),
    );
    const posRevenueCurrent = currentPosSales.reduce((s, sale) => s + sale.total, 0);
    const totalRevenueCurrent = billingRevenueCurrent + posRevenueCurrent;

    let consultationsTrend = 0;
    let patientsTrend = 0;
    let billingRevenueTrend = 0;
    let posRevenueTrend = 0;
    let totalRevenueTrend = 0;

    if (dateRanges.hasComparison) {
      const prevApps = appointments.filter((a) =>
        isWithinRange(a.scheduledAt, dateRanges.prevStart, dateRanges.prevEnd),
      );
      const completedAppsPrev = prevApps.filter((a) => a.status === 'completed').length;
      consultationsTrend =
        completedAppsPrev === 0
          ? completedAppsCurrent > 0 ? 100 : 0
          : Math.round(((completedAppsCurrent - completedAppsPrev) / completedAppsPrev) * 100);

      const prevPatientsCount = patients.filter((p) =>
        isWithinRange(p.createdAt, dateRanges.prevStart, dateRanges.prevEnd),
      ).length;
      patientsTrend =
        prevPatientsCount === 0
          ? currentPatientsCount > 0 ? 100 : 0
          : Math.round(((currentPatientsCount - prevPatientsCount) / prevPatientsCount) * 100);

      const prevPaidInvoices = invoices.filter(
        (inv) =>
          inv.paymentStatus === 'paid' &&
          isWithinRange(inv.createdAt, dateRanges.prevStart, dateRanges.prevEnd),
      );
      const billingRevenuePrev = prevPaidInvoices.reduce((s, inv) => s + inv.total, 0);
      billingRevenueTrend =
        billingRevenuePrev === 0
          ? billingRevenueCurrent > 0 ? 100 : 0
          : Math.round(((billingRevenueCurrent - billingRevenuePrev) / billingRevenuePrev) * 100);

      const prevPosSales = posSales.filter((sale) =>
        isWithinRange(sale.createdAt, dateRanges.prevStart, dateRanges.prevEnd),
      );
      const posRevenuePrev = prevPosSales.reduce((s, sale) => s + sale.total, 0);
      posRevenueTrend =
        posRevenuePrev === 0
          ? posRevenueCurrent > 0 ? 100 : 0
          : Math.round(((posRevenueCurrent - posRevenuePrev) / posRevenuePrev) * 100);

      const totalRevenuePrev = billingRevenuePrev + posRevenuePrev;
      totalRevenueTrend =
        totalRevenuePrev === 0
          ? totalRevenueCurrent > 0 ? 100 : 0
          : Math.round(((totalRevenueCurrent - totalRevenuePrev) / totalRevenuePrev) * 100);
    }

    return {
      consultations: { value: completedAppsCurrent, trend: consultationsTrend },
      patients: { value: currentPatientsCount, trend: patientsTrend },
      billingRevenue: { value: billingRevenueCurrent, trend: billingRevenueTrend },
      posRevenue: { value: posRevenueCurrent, trend: posRevenueTrend },
      totalRevenue: { value: totalRevenueCurrent, trend: totalRevenueTrend },
      currentApps,
      currentPaidInvoices,
      currentPosSales,
    };
  }, [appointments, invoices, posSales, patients, period, dateRanges]);

  const formatKey = (date: Date) => {
    if (period === '7d' || period === '30d')
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (period === '90d') {
      const s = new Date(date);
      s.setDate(date.getDate() - date.getDay());
      return s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const buildKeys = (start: Date) => {
    const keys: string[] = [];
    const map: Record<string, unknown> = {};
    const temp = new Date(start);
    const end = new Date();
    let count = 0;
    while (temp <= end && count < 500) {
      const k = formatKey(temp);
      if (!map[k]) { map[k] = true; keys.push(k); }
      if (period === '7d' || period === '30d') temp.setDate(temp.getDate() + 1);
      else if (period === '90d') temp.setDate(temp.getDate() + 7);
      else temp.setMonth(temp.getMonth() + 1);
      count++;
    }
    if (keys.length === 0) keys.push(formatKey(new Date()));
    return keys;
  };

  const revenueTrendData = useMemo(() => {
    const start =
      period === 'all' && patients.length > 0
        ? new Date(Math.min(...patients.map((p) => new Date(p.createdAt).getTime())))
        : dateRanges.currentStart;
    const keys = buildKeys(start);
    const data: Record<string, { date: string; billing: number; pos: number; total: number }> = {};
    keys.forEach((k) => { data[k] = { date: k, billing: 0, pos: 0, total: 0 }; });
    metrics.currentPaidInvoices.forEach((inv) => {
      const k = formatKey(new Date(inv.createdAt));
      if (data[k]) { data[k].billing += inv.total; data[k].total += inv.total; }
    });
    metrics.currentPosSales.forEach((sale) => {
      const k = formatKey(new Date(sale.createdAt));
      if (data[k]) { data[k].pos += sale.total; data[k].total += sale.total; }
    });
    return keys.map((k) => data[k]);
  }, [period, dateRanges, metrics, patients]);

  const consultationsTrendData = useMemo(() => {
    const start =
      period === 'all' && patients.length > 0
        ? new Date(Math.min(...patients.map((p) => new Date(p.createdAt).getTime())))
        : dateRanges.currentStart;
    const keys = buildKeys(start);
    const data: Record<string, { date: string; completed: number; cancelled: number; scheduled: number }> = {};
    keys.forEach((k) => { data[k] = { date: k, completed: 0, cancelled: 0, scheduled: 0 }; });
    metrics.currentApps.forEach((app) => {
      const k = formatKey(new Date(app.scheduledAt));
      if (data[k]) {
        if (app.status === 'completed') data[k].completed += 1;
        else if (app.status === 'cancelled') data[k].cancelled += 1;
        else data[k].scheduled += 1;
      }
    });
    return keys.map((k) => data[k]);
  }, [period, dateRanges, metrics, patients]);

  const topServices = useMemo(() => {
    const counts: Record<string, number> = {};
    metrics.currentApps.forEach((app) => {
      if (app.serviceId) counts[app.serviceId] = (counts[app.serviceId] || 0) + 1;
    });
    const svcMap = new Map(services.map((s) => [s.id, s]));
    return Object.entries(counts)
      .map(([id, count]) => {
        const svc = svcMap.get(id);
        return { id, name: svc?.name ?? 'General Consultation', price: svc?.price ?? 0, count, revenue: count * (svc?.price ?? 0) };
      })
      .sort((a, b) => b.count - a.count);
  }, [metrics.currentApps, services]);

  const statusBreakdown = useMemo(() => {
    const STATUS_COLORS: Record<string, string> = {
      completed: BRAND_GREEN,
      scheduled: SLATE_400,
      confirmed: '#64748b',
      in_progress: '#334155',
      cancelled: BRAND_RED,
      no_show: '#cbd5e1',
    };
    const counts: Record<string, number> = {};
    metrics.currentApps.forEach((app) => { counts[app.status] = (counts[app.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      name: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: count,
      color: STATUS_COLORS[status] ?? SLATE_400,
    }));
  }, [metrics.currentApps]);

  const paymentMethodsDistribution = useMemo(() => {
    const methods: Record<string, number> = {};
    metrics.currentPosSales.forEach((sale) => {
      const m = sale.paymentMethod ?? 'Other';
      methods[m] = (methods[m] || 0) + sale.total;
    });
    const COLORS = ['#4cb154', '#94a3b8', '#64748b', '#334155'];
    return Object.entries(methods).map(([name, value], i) => ({
      name: name.toUpperCase(),
      value,
      color: COLORS[i % COLORS.length],
    }));
  }, [metrics.currentPosSales]);

  const recentRevenueList = useMemo(() => {
    const list: Array<{ id: string; reference: string; source: 'billing' | 'pos'; amount: number; date: string }> = [];
    metrics.currentPaidInvoices.slice(0, 10).forEach((inv) => {
      list.push({ id: inv.id, reference: inv.invoiceNumber, source: 'billing', amount: inv.total, date: inv.createdAt });
    });
    metrics.currentPosSales.slice(0, 10).forEach((sale) => {
      list.push({ id: sale.id, reference: sale.saleNumber, source: 'pos', amount: sale.total, date: sale.createdAt });
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
  }, [metrics.currentPaidInvoices, metrics.currentPosSales]);

  const tooltipStyle = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
    fontSize: '12px',
  };

  if (isLoading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <p className="text-sm font-medium text-slate-400">Loading analytics…</p>
      </div>
    );
  }

  return (
    <>
      {/* Page header */}
      <section className={cn(INTERNAL_SURFACE, 'divide-y divide-slate-100/90')}>
        <div className="flex flex-col gap-5 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Analytics</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Performance Overview</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Revenue trends, consultation volume, and service demand for the selected period.
            </p>
          </div>
          {/* Period selector */}
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200/90 bg-slate-50/80 p-1">
            {(['7d', '30d', '90d', '12m', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                type="button"
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition',
                  period === p
                    ? 'bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] text-[var(--color-primary)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--color-primary)_25%,white)]'
                    : 'text-slate-500 hover:bg-white hover:text-slate-800',
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* KPI row */}
      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Revenue', value: formatCurrency(metrics.totalRevenue.value), hint: `Billing ${formatCurrency(metrics.billingRevenue.value)} · POS ${formatCurrency(metrics.posRevenue.value)}`, icon: Coins, trend: metrics.totalRevenue.trend },
          { label: 'Consultations', value: metrics.consultations.value.toLocaleString(), hint: 'Completed clinic visits', icon: CalendarDays, trend: metrics.consultations.trend },
          { label: 'New Patients', value: metrics.patients.value.toLocaleString(), hint: 'Registrations in period', icon: Users, trend: metrics.patients.trend },
          { label: 'POS Transactions', value: metrics.currentPosSales.length.toLocaleString(), hint: 'Over-the-counter sales', icon: ShoppingBag, trend: metrics.posRevenue.trend },
        ].map(({ label, value, hint, icon: Icon, trend }) => (
          <div
            key={label}
            className={cn(INTERNAL_SURFACE, 'p-0 transition-[box-shadow] duration-200 hover:shadow-[0_4px_24px_-6px_rgba(15,41,71,0.12)]')}
          >
            <div className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
                {dateRanges.hasComparison && (
                  <div className="mt-3">
                    <TrendBadge trend={trend} />
                  </div>
                )}
              </div>
              <div className={cn('flex shrink-0 items-center justify-center rounded-xl p-2.5', iconCls)}>
                <Icon className="size-5" strokeWidth={2} />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Revenue + Appointment status */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className={cn(INTERNAL_SURFACE, 'flex flex-col lg:col-span-2')}>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100/90 px-6 py-4">
            <div>
              <p className="text-sm font-bold text-slate-900">Revenue Analysis</p>
              <p className="text-xs text-slate-500">Billing invoices vs. POS sales over time</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[var(--color-primary)]" />
                Billing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-slate-400" />
                POS
              </span>
            </div>
          </div>
          <div className="p-5">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData}>
                  <defs>
                    <linearGradient id="gBilling" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND_GREEN} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={BRAND_GREEN} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SLATE_400} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={SLATE_400} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={SLATE_200} />
                  <XAxis dataKey="date" stroke={SLATE_400} fontSize={11} tickLine={false} />
                  <YAxis stroke={SLATE_400} fontSize={11} tickLine={false} tickFormatter={(v) => `₱${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v: unknown) => [formatCurrency(Number(v) || 0), '']} contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="billing" name="Billing" stroke={BRAND_GREEN} strokeWidth={2} fillOpacity={1} fill="url(#gBilling)" />
                  <Area type="monotone" dataKey="pos" name="POS" stroke={SLATE_400} strokeWidth={2} fillOpacity={1} fill="url(#gPos)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className={cn(INTERNAL_SURFACE, 'flex flex-col')}>
          <div className="border-b border-slate-100/90 px-6 py-4">
            <p className="text-sm font-bold text-slate-900">Appointment Breakdown</p>
            <p className="text-xs text-slate-500">Status distribution for the period</p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center p-5">
            {statusBreakdown.length > 0 ? (
              <>
                <div className="relative flex h-52 w-full items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={58} outerRadius={78} paddingAngle={3} dataKey="value">
                        {statusBreakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v} visits`, '']} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute text-center">
                    <p className="text-2xl font-bold text-slate-900">{metrics.currentApps.length}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total</p>
                  </div>
                </div>
                <div className="mt-4 grid w-full grid-cols-2 gap-x-4 gap-y-2">
                  {statusBreakdown.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="truncate text-slate-600">{item.name}</span>
                      <span className="ml-auto font-bold text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">No appointment data for this period.</p>
            )}
          </div>
        </div>
      </section>

      {/* Consultations + POS payment methods */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className={cn(INTERNAL_SURFACE, 'flex flex-col lg:col-span-2')}>
          <div className="border-b border-slate-100/90 px-6 py-4">
            <p className="text-sm font-bold text-slate-900">Consultation Delivery</p>
            <p className="text-xs text-slate-500">Completed, scheduled, and cancelled appointments over time</p>
          </div>
          <div className="p-5">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consultationsTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={SLATE_200} />
                  <XAxis dataKey="date" stroke={SLATE_400} fontSize={11} tickLine={false} />
                  <YAxis stroke={SLATE_400} fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="completed" name="Completed" fill={BRAND_GREEN} radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="scheduled" name="Scheduled" fill={SLATE_400} radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="cancelled" name="Cancelled" fill={BRAND_RED} radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className={cn(INTERNAL_SURFACE, 'flex flex-col')}>
          <div className="border-b border-slate-100/90 px-6 py-4">
            <p className="text-sm font-bold text-slate-900">POS Payment Methods</p>
            <p className="text-xs text-slate-500">Breakdown by payment type</p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center p-5">
            {paymentMethodsDistribution.length > 0 ? (
              <>
                <div className="relative flex h-44 w-full items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentMethodsDistribution} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={3} dataKey="value">
                        {paymentMethodsDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: unknown) => [formatCurrency(Number(v) || 0), '']} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 w-full space-y-2">
                  {paymentMethodsDistribution.map((item, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-slate-600">{item.name}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">No POS data for this period.</p>
            )}
          </div>
        </div>
      </section>

      {/* Tables */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Popular services */}
        <div className={cn(INTERNAL_SURFACE)}>
          <div className="border-b border-slate-100/90 px-6 py-4">
            <p className="text-sm font-bold text-slate-900">Popular Services</p>
            <p className="text-xs text-slate-500">Most-booked procedures and consultation types</p>
          </div>
          <div className={INTERNAL_TABLE_SCROLL}>
            {topServices.length > 0 ? (
              <table className={INTERNAL_TABLE}>
                <thead>
                  <tr className={INTERNAL_THEAD_ROW}>
                    <th className={INTERNAL_TH}>Service</th>
                    <th className={cn(INTERNAL_TH, 'text-center')}>Bookings</th>
                    <th className={cn(INTERNAL_TH, 'text-right')}>Fee</th>
                    <th className={cn(INTERNAL_TH, 'text-right')}>Est. Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topServices.slice(0, 6).map((srv) => (
                    <tr key={srv.id} className={INTERNAL_TR}>
                      <td className={INTERNAL_TD}><span className="font-semibold text-slate-900">{srv.name}</span></td>
                      <td className={cn(INTERNAL_TD, 'text-center tabular-nums')}>{srv.count}</td>
                      <td className={cn(INTERNAL_TD, 'text-right tabular-nums')}>{formatCurrency(srv.price)}</td>
                      <td className={cn(INTERNAL_TD, 'text-right font-bold tabular-nums text-slate-900')}>{formatCurrency(srv.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-slate-400">No services data for this period.</div>
            )}
          </div>
        </div>

        {/* Recent revenue */}
        <div className={cn(INTERNAL_SURFACE)}>
          <div className="border-b border-slate-100/90 px-6 py-4">
            <p className="text-sm font-bold text-slate-900">Recent Revenue</p>
            <p className="text-xs text-slate-500">Cleared invoices and completed retail sales</p>
          </div>
          <div className={INTERNAL_TABLE_SCROLL}>
            {recentRevenueList.length > 0 ? (
              <table className={INTERNAL_TABLE}>
                <thead>
                  <tr className={INTERNAL_THEAD_ROW}>
                    <th className={INTERNAL_TH}>Reference</th>
                    <th className={INTERNAL_TH}>Source</th>
                    <th className={INTERNAL_TH}>Date</th>
                    <th className={cn(INTERNAL_TH, 'text-right')}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRevenueList.map((item) => (
                    <tr key={item.id} className={INTERNAL_TR}>
                      <td className={INTERNAL_TD}><span className="font-semibold text-slate-900">{item.reference}</span></td>
                      <td className={INTERNAL_TD}>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80">
                          {item.source === 'billing' ? 'Billing' : 'POS'}
                        </span>
                      </td>
                      <td className={cn(INTERNAL_TD, 'text-slate-500 tabular-nums')}>
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className={cn(INTERNAL_TD, 'text-right font-bold tabular-nums text-slate-900')}>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-slate-400">No revenue events for this period.</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
