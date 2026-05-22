import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Coins,
  TrendingUp,
  TrendingDown,
  Users,
  CheckCircle,
  XCircle,
  Activity,
  ArrowUpRight,
  RefreshCw,
  ShoppingBag,
  CreditCard
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
  Cell
} from 'recharts';

import { queryKeys } from '../../lib/query-keys';
import {
  listInvoicesLiveOrDemo,
  listPatientsLiveOrDemo,
  listPosSalesLiveOrDemo,
  listServicesLiveOrDemo
} from '../../lib/supabase-clinic';
import { useAppointments } from '../appointments/hooks/use-appointments';
import { InternalPage } from '../../components/ui/internal-page';
import { INTERNAL_SURFACE, INTERNAL_SURFACE_PADDING } from '../../lib/internal-ui';
import { cn, formatCurrency } from '../../lib/utils';

type Period = '7d' | '30d' | '90d' | '12m' | 'all';

export function AnalyticsDashboardPage() {
  const [period, setPeriod] = useState<Period>('30d');

  // Fetch all necessary data
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

  const isLoading = appointmentsLoading || invoicesLoading || posSalesLoading || patientsLoading || servicesLoading;

  // 1. Calculate Date Ranges for comparison
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

    return {
      currentStart,
      prevStart,
      prevEnd,
      hasComparison,
    };
  }, [period]);

  // Helper to check if a date is within a range
  const isWithinRange = (dateStr: string | Date, start: Date, end?: Date) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    if (end) {
      return d >= start && d < end;
    }
    return d >= start;
  };

  // 2. Aggregate metrics and compare with previous period
  const metrics = useMemo(() => {
    // Current period data
    const currentApps = appointments.filter(a =>
      period === 'all' ? true : isWithinRange(a.scheduledAt, dateRanges.currentStart)
    );
    const completedAppsCurrent = currentApps.filter(a => a.status === 'completed').length;

    const currentPatientsCount = patients.filter(p =>
      period === 'all' ? true : isWithinRange(p.createdAt, dateRanges.currentStart)
    ).length;

    const currentPaidInvoices = invoices.filter(inv =>
      inv.paymentStatus === 'paid' &&
      (period === 'all' ? true : isWithinRange(inv.createdAt, dateRanges.currentStart))
    );
    const billingRevenueCurrent = currentPaidInvoices.reduce((sum, inv) => sum + inv.total, 0);

    const currentPosSales = posSales.filter(sale =>
      period === 'all' ? true : isWithinRange(sale.createdAt, dateRanges.currentStart)
    );
    const posRevenueCurrent = currentPosSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalRevenueCurrent = billingRevenueCurrent + posRevenueCurrent;

    // Previous period data (for comparison trends)
    let consultationsTrend = 0;
    let patientsTrend = 0;
    let billingRevenueTrend = 0;
    let posRevenueTrend = 0;
    let totalRevenueTrend = 0;

    if (dateRanges.hasComparison) {
      const prevApps = appointments.filter(a =>
        isWithinRange(a.scheduledAt, dateRanges.prevStart, dateRanges.prevEnd)
      );
      const completedAppsPrev = prevApps.filter(a => a.status === 'completed').length;
      consultationsTrend = completedAppsPrev === 0
        ? (completedAppsCurrent > 0 ? 100 : 0)
        : Math.round(((completedAppsCurrent - completedAppsPrev) / completedAppsPrev) * 100);

      const prevPatientsCount = patients.filter(p =>
        isWithinRange(p.createdAt, dateRanges.prevStart, dateRanges.prevEnd)
      ).length;
      patientsTrend = prevPatientsCount === 0
        ? (currentPatientsCount > 0 ? 100 : 0)
        : Math.round(((currentPatientsCount - prevPatientsCount) / prevPatientsCount) * 100);

      const prevPaidInvoices = invoices.filter(inv =>
        inv.paymentStatus === 'paid' &&
        isWithinRange(inv.createdAt, dateRanges.prevStart, dateRanges.prevEnd)
      );
      const billingRevenuePrev = prevPaidInvoices.reduce((sum, inv) => sum + inv.total, 0);
      billingRevenueTrend = billingRevenuePrev === 0
        ? (billingRevenueCurrent > 0 ? 100 : 0)
        : Math.round(((billingRevenueCurrent - billingRevenuePrev) / billingRevenuePrev) * 100);

      const prevPosSales = posSales.filter(sale =>
        isWithinRange(sale.createdAt, dateRanges.prevStart, dateRanges.prevEnd)
      );
      const posRevenuePrev = prevPosSales.reduce((sum, sale) => sum + sale.total, 0);
      posRevenueTrend = posRevenuePrev === 0
        ? (posRevenueCurrent > 0 ? 100 : 0)
        : Math.round(((posRevenueCurrent - posRevenuePrev) / posRevenuePrev) * 100);

      const totalRevenuePrev = billingRevenuePrev + posRevenuePrev;
      totalRevenueTrend = totalRevenuePrev === 0
        ? (totalRevenueCurrent > 0 ? 100 : 0)
        : Math.round(((totalRevenueCurrent - totalRevenuePrev) / totalRevenuePrev) * 100);
    }

    return {
      consultations: {
        value: completedAppsCurrent,
        trend: consultationsTrend,
      },
      patients: {
        value: currentPatientsCount,
        trend: patientsTrend,
      },
      billingRevenue: {
        value: billingRevenueCurrent,
        trend: billingRevenueTrend,
      },
      posRevenue: {
        value: posRevenueCurrent,
        trend: posRevenueTrend,
      },
      totalRevenue: {
        value: totalRevenueCurrent,
        trend: totalRevenueTrend,
      },
      currentApps,
      currentPaidInvoices,
      currentPosSales,
    };
  }, [appointments, invoices, posSales, patients, period, dateRanges]);

  // 3. Prepare Revenue Trends Chart Data
  const revenueTrendData = useMemo(() => {
    const dataMap: Record<string, { date: string; billing: number; pos: number; total: number }> = {};
    const formatKey = (date: Date) => {
      if (period === '7d' || period === '30d') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (period === '90d') {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        return startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }
    };

    const keys: string[] = [];
    const temp = new Date(
      period === 'all' && patients.length > 0
        ? Math.min(...patients.map(p => new Date(p.createdAt).getTime()))
        : dateRanges.currentStart.getTime()
    );
    const end = new Date();
    
    // Safety check
    let loopCount = 0;
    const maxLoops = 500;
    while (temp <= end && loopCount < maxLoops) {
      const key = formatKey(temp);
      if (!dataMap[key]) {
        dataMap[key] = { date: key, billing: 0, pos: 0, total: 0 };
        keys.push(key);
      }
      if (period === '7d' || period === '30d') {
        temp.setDate(temp.getDate() + 1);
      } else if (period === '90d') {
        temp.setDate(temp.getDate() + 7);
      } else {
        temp.setMonth(temp.getMonth() + 1);
      }
      loopCount++;
    }

    if (keys.length === 0) {
      const key = formatKey(new Date());
      dataMap[key] = { date: key, billing: 0, pos: 0, total: 0 };
      keys.push(key);
    }

    metrics.currentPaidInvoices.forEach(inv => {
      const key = formatKey(new Date(inv.createdAt));
      if (dataMap[key]) {
        dataMap[key].billing += inv.total;
        dataMap[key].total += inv.total;
      }
    });

    metrics.currentPosSales.forEach(sale => {
      const key = formatKey(new Date(sale.createdAt));
      if (dataMap[key]) {
        dataMap[key].pos += sale.total;
        dataMap[key].total += sale.total;
      }
    });

    return keys.map(k => dataMap[k]);
  }, [period, dateRanges, metrics, patients]);

  // 4. Prepare Consultation Trends Chart Data
  const consultationsTrendData = useMemo(() => {
    const dataMap: Record<string, { date: string; completed: number; cancelled: number; scheduled: number }> = {};
    const formatKey = (date: Date) => {
      if (period === '7d' || period === '30d') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (period === '90d') {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        return startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }
    };

    const keys: string[] = [];
    const temp = new Date(
      period === 'all' && patients.length > 0
        ? Math.min(...patients.map(p => new Date(p.createdAt).getTime()))
        : dateRanges.currentStart.getTime()
    );
    const end = new Date();
    
    let loopCount = 0;
    const maxLoops = 500;
    while (temp <= end && loopCount < maxLoops) {
      const key = formatKey(temp);
      if (!dataMap[key]) {
        dataMap[key] = { date: key, completed: 0, cancelled: 0, scheduled: 0 };
        keys.push(key);
      }
      if (period === '7d' || period === '30d') {
        temp.setDate(temp.getDate() + 1);
      } else if (period === '90d') {
        temp.setDate(temp.getDate() + 7);
      } else {
        temp.setMonth(temp.getMonth() + 1);
      }
      loopCount++;
    }

    if (keys.length === 0) {
      const key = formatKey(new Date());
      dataMap[key] = { date: key, completed: 0, cancelled: 0, scheduled: 0 };
      keys.push(key);
    }

    metrics.currentApps.forEach(app => {
      const key = formatKey(new Date(app.scheduledAt));
      if (dataMap[key]) {
        if (app.status === 'completed') {
          dataMap[key].completed += 1;
        } else if (app.status === 'cancelled') {
          dataMap[key].cancelled += 1;
        } else {
          dataMap[key].scheduled += 1;
        }
      }
    });

    return keys.map(k => dataMap[k]);
  }, [period, dateRanges, metrics, patients]);

  // 5. Prepare Top Booked Services
  const topServices = useMemo(() => {
    const counts: Record<string, number> = {};
    metrics.currentApps.forEach(app => {
      if (app.serviceId) {
        counts[app.serviceId] = (counts[app.serviceId] || 0) + 1;
      }
    });

    const serviceMap = new Map(services.map(s => [s.id, s]));

    return Object.entries(counts)
      .map(([serviceId, count]) => {
        const details = serviceMap.get(serviceId);
        return {
          id: serviceId,
          name: details?.name || 'General Consultation',
          type: details?.serviceType || 'consultation',
          price: details?.price || 0,
          count,
          revenue: count * (details?.price || 0),
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [metrics.currentApps, services]);

  // 6. Appointment Status Breakdown
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    metrics.currentApps.forEach(app => {
      counts[app.status] = (counts[app.status] || 0) + 1;
    });

    const statusMap: Record<string, { label: string; color: string }> = {
      completed: { label: 'Completed', color: '#10B981' },
      scheduled: { label: 'Scheduled', color: '#3B82F6' },
      confirmed: { label: 'Confirmed', color: '#8B5CF6' },
      in_progress: { label: 'In Progress', color: '#F59E0B' },
      cancelled: { label: 'Cancelled', color: '#EF4444' },
      no_show: { label: 'No Show', color: '#6B7280' },
    };

    return Object.entries(counts).map(([status, count]) => ({
      name: statusMap[status]?.label || status,
      value: count,
      color: statusMap[status]?.color || '#94A3B8',
    }));
  }, [metrics.currentApps]);

  // 7. POS Payment Method Distribution
  const paymentMethodsDistribution = useMemo(() => {
    const methods: Record<string, number> = {};
    metrics.currentPosSales.forEach(sale => {
      const method = sale.paymentMethod || 'Other';
      methods[method] = (methods[method] || 0) + sale.total;
    });

    const colors: Record<string, string> = {
      cash: '#10B981',
      gcash: '#3B82F6',
      card: '#EC4899',
      Other: '#8B5CF6',
    };

    return Object.entries(methods).map(([method, amount]) => ({
      name: method.toUpperCase(),
      value: amount,
      color: colors[method] || '#94A3B8',
    }));
  }, [metrics.currentPosSales]);

  // 8. Recent Revenue Activity List
  const recentRevenueList = useMemo(() => {
    const list: Array<{
      id: string;
      reference: string;
      source: 'billing' | 'pos';
      amount: number;
      date: string;
      patientName?: string;
    }> = [];

    metrics.currentPaidInvoices.slice(0, 10).forEach(inv => {
      list.push({
        id: inv.id,
        reference: inv.invoiceNumber,
        source: 'billing',
        amount: inv.total,
        date: inv.createdAt,
      });
    });

    metrics.currentPosSales.slice(0, 10).forEach(sale => {
      list.push({
        id: sale.id,
        reference: sale.saleNumber,
        source: 'pos',
        amount: sale.total,
        date: sale.createdAt,
      });
    });

    return list
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [metrics.currentPaidInvoices, metrics.currentPosSales]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-10 w-10 animate-spin text-[var(--color-primary)]" />
          <p className="text-sm font-medium text-slate-500">Compiling analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <InternalPage>
      {/* Upper header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics Dashboard</h1>
          <p className="text-sm text-slate-500">
            Real-time metric visualization, service popularity trends, and financial reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(['7d', '30d', '90d', '12m', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                  period === p
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {p === '7d' && '7 Days'}
                {p === '30d' && '30 Days'}
                {p === '90d' && '90 Days'}
                {p === '12m' && '12 Months'}
                {p === 'all' && 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue KPI */}
        <div className={cn(INTERNAL_SURFACE, 'p-6 flex flex-col justify-between hover:shadow-md transition-all border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/10')}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Revenue</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900">
              {formatCurrency(metrics.totalRevenue.value)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Billing: {formatCurrency(metrics.billingRevenue.value)} • POS: {formatCurrency(metrics.posRevenue.value)}
            </p>
          </div>
          {dateRanges.hasComparison && (
            <div className="flex items-center gap-1 mt-4 text-xs font-semibold">
              {metrics.totalRevenue.trend >= 0 ? (
                <span className="flex items-center gap-0.5 text-emerald-600">
                  <TrendingUp className="h-3.5 w-3.5" />
                  +{metrics.totalRevenue.trend}%
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-rose-600">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {metrics.totalRevenue.trend}%
                </span>
              )}
              <span className="text-slate-400">vs last period</span>
            </div>
          )}
        </div>

        {/* Consultations KPI */}
        <div className={cn(INTERNAL_SURFACE, 'p-6 flex flex-col justify-between hover:shadow-md transition-all border-l-4 border-l-blue-500 bg-gradient-to-br from-white to-blue-50/10')}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Consultations</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900">
              {metrics.consultations.value.toLocaleString()}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Completed clinic visits</p>
          </div>
          {dateRanges.hasComparison && (
            <div className="flex items-center gap-1 mt-4 text-xs font-semibold">
              {metrics.consultations.trend >= 0 ? (
                <span className="flex items-center gap-0.5 text-emerald-600">
                  <TrendingUp className="h-3.5 w-3.5" />
                  +{metrics.consultations.trend}%
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-rose-600">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {metrics.consultations.trend}%
                </span>
              )}
              <span className="text-slate-400">vs last period</span>
            </div>
          )}
        </div>

        {/* New Patients KPI */}
        <div className={cn(INTERNAL_SURFACE, 'p-6 flex flex-col justify-between hover:shadow-md transition-all border-l-4 border-l-violet-500 bg-gradient-to-br from-white to-violet-50/10')}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">New Patients</span>
            <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900">
              {metrics.patients.value.toLocaleString()}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Registrations in period</p>
          </div>
          {dateRanges.hasComparison && (
            <div className="flex items-center gap-1 mt-4 text-xs font-semibold">
              {metrics.patients.trend >= 0 ? (
                <span className="flex items-center gap-0.5 text-emerald-600">
                  <TrendingUp className="h-3.5 w-3.5" />
                  +{metrics.patients.trend}%
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-rose-600">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {metrics.patients.trend}%
                </span>
              )}
              <span className="text-slate-400">vs last period</span>
            </div>
          )}
        </div>

        {/* POS Sales KPI */}
        <div className={cn(INTERNAL_SURFACE, 'p-6 flex flex-col justify-between hover:shadow-md transition-all border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/10')}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">POS Sales Volume</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900">
              {metrics.currentPosSales.length.toLocaleString()}
            </h3>
            <p className="text-xs text-slate-400 mt-1">OTC sales transactions</p>
          </div>
          {dateRanges.hasComparison && (
            <div className="flex items-center gap-1 mt-4 text-xs font-semibold">
              {metrics.posRevenue.trend >= 0 ? (
                <span className="flex items-center gap-0.5 text-emerald-600">
                  <TrendingUp className="h-3.5 w-3.5" />
                  +{metrics.posRevenue.trend}%
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-rose-600">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {metrics.posRevenue.trend}%
                </span>
              )}
              <span className="text-slate-400">vs last period</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Area Chart */}
        <div className={cn(INTERNAL_SURFACE_PADDING, 'lg:col-span-2 flex flex-col')}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Revenue Analysis</h4>
              <p className="text-xs text-slate-500">Daily invoicing vs. product point-of-sale revenues</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-emerald-500"></span>Invoices</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-blue-500"></span>POS Sales</span>
            </div>
          </div>
          <div className="h-80 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="colorBilling" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} tickFormatter={(val) => `₱${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), '']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                />
                <Area type="monotone" dataKey="billing" name="Billing" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBilling)" />
                <Area type="monotone" dataKey="pos" name="POS" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPos)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status distribution donut chart */}
        <div className={cn(INTERNAL_SURFACE_PADDING, 'flex flex-col')}>
          <h4 className="text-sm font-bold text-slate-900 mb-1">Appointment Metrics</h4>
          <p className="text-xs text-slate-500 mb-6">Status allocation of all visits in timeframe</p>
          <div className="flex-1 flex flex-col items-center justify-center">
            {statusBreakdown.length > 0 ? (
              <>
                <div className="h-52 w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} bookings`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text */}
                  <div className="absolute text-center">
                    <p className="text-2xl font-black text-slate-900">
                      {metrics.currentApps.length}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bookings</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 w-full text-xs">
                  {statusBreakdown.map((item, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600 truncate">{item.name}</span>
                      <span className="font-bold text-slate-900 ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 italic">No appointment status records found.</p>
            )}
          </div>
        </div>
      </div>

      {/* Consultations and POS breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Consultations volume trend */}
        <div className={cn(INTERNAL_SURFACE_PADDING, 'lg:col-span-2 flex flex-col')}>
          <h4 className="text-sm font-bold text-slate-900 mb-1">Consultation Delivery</h4>
          <p className="text-xs text-slate-500 mb-4">Completed, cancelled, and scheduled appointments</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consultationsTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="scheduled" name="Scheduled" fill="#3B82F6" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="cancelled" name="Cancelled" fill="#EF4444" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Distribution */}
        <div className={cn(INTERNAL_SURFACE_PADDING, 'flex flex-col')}>
          <h4 className="text-sm font-bold text-slate-900 mb-1">POS Payment Methods</h4>
          <p className="text-xs text-slate-500 mb-6">Aggregate payment totals for POS sales</p>
          <div className="flex-1 flex flex-col items-center justify-center">
            {paymentMethodsDistribution.length > 0 ? (
              <>
                <div className="h-44 w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodsDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {paymentMethodsDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-4 w-full text-xs">
                  {paymentMethodsDistribution.map((item, index) => (
                    <div key={index} className="flex items-center justify-between border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600 font-semibold">{item.name}</span>
                      </div>
                      <span className="font-extrabold text-slate-900">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 italic">No POS payment distribution data available.</p>
            )}
          </div>
        </div>
      </div>

      {/* Tables section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Popular Services table */}
        <div className={cn(INTERNAL_SURFACE, 'flex flex-col')}>
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Popular Services</h4>
              <p className="text-xs text-slate-500">Frequently booked clinic procedures and consultation types</p>
            </div>
            <Activity className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex-1 overflow-x-auto">
            {topServices.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50/75">
                  <tr className="text-slate-500 text-[10px] uppercase font-bold tracking-wider text-left">
                    <th className="px-6 py-3">Service Name</th>
                    <th className="px-6 py-3 text-center">Bookings</th>
                    <th className="px-6 py-3 text-right">Standard Fee</th>
                    <th className="px-6 py-3 text-right">Est. Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topServices.slice(0, 5).map((srv, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 font-semibold text-slate-800">{srv.name}</td>
                      <td className="px-6 py-3.5 text-center font-bold text-slate-600">{srv.count}</td>
                      <td className="px-6 py-3.5 text-right text-slate-600">{formatCurrency(srv.price)}</td>
                      <td className="px-6 py-3.5 text-right font-extrabold text-emerald-600">{formatCurrency(srv.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 italic">No services data for selected period.</div>
            )}
          </div>
        </div>

        {/* Recent Revenue Transactions list */}
        <div className={cn(INTERNAL_SURFACE, 'flex flex-col')}>
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Recent Revenue Stream</h4>
              <p className="text-xs text-slate-500">Invoices cleared and retail points-of-sale completed</p>
            </div>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex-1 overflow-y-auto max-h-[320px]">
            {recentRevenueList.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentRevenueList.map((item, idx) => (
                  <div key={idx} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-xs">{item.reference}</span>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider',
                          item.source === 'billing' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                        )}>
                          {item.source === 'billing' ? 'Billing' : 'Retail POS'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(item.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span className="font-extrabold text-slate-900 text-sm">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 italic">No financial revenue events registered.</div>
            )}
          </div>
        </div>
      </div>
    </InternalPage>
  );
}
