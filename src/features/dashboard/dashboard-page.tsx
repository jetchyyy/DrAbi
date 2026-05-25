import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  LayoutDashboard,
  Minus,
  CalendarCheck2,
  Coins,
  FlaskConical,
  PackageSearch,
  TrendingUp,
  UserRound,
  Droplet,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { defaultClinicSettings } from '../../config/clinic';
import { useClinicSettingsData, useServicesCatalog } from '../../hooks/use-clinic-data';
import { queryKeys } from '../../lib/query-keys';
import {
  listInventoryItemsLiveOrDemo,
  listInvoicesLiveOrDemo,
  listPatientsLiveOrDemo,
} from '../../lib/supabase-clinic';
import { InternalPage } from '../../components/ui/internal-page';
import {
  INTERNAL_SURFACE,
  INTERNAL_SURFACE_FOOTER,
} from '../../lib/internal-ui';
import { AnalyticsContent } from '../analytics/analytics-page';
import { cn, formatCurrency } from '../../lib/utils';
import { useAppointments } from '../appointments/hooks/use-appointments';

function getLocalDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

interface KpiInsight {
  trend: 'up' | 'down' | 'neutral';
  label: string;
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  insight,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  insight: KpiInsight;
}) {
  const iconCls =
    'bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] text-[var(--color-primary)] ring-1 ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]';

  const TrendIcon = {
    up: ArrowUpRight,
    down: ArrowDownRight,
    neutral: Minus,
  }[insight.trend];

  return (
    <div
      className={cn(
        INTERNAL_SURFACE,
        'p-0 transition-[box-shadow,transform] duration-200 hover:shadow-[0_4px_24px_-6px_rgba(15,41,71,0.12)]',
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
          <div className="mt-3">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
                insight.trend === 'up' && 'bg-emerald-50 text-emerald-700 ring-emerald-100',
                insight.trend === 'down' && 'bg-rose-50 text-rose-700 ring-rose-100',
                insight.trend === 'neutral' && 'bg-white text-slate-600 ring-slate-200',
              )}
            >
              <TrendIcon className="size-3 shrink-0" strokeWidth={2.5} />
              {insight.label}
            </span>
          </div>
        </div>
        <div className={cn('flex shrink-0 items-center justify-center rounded-xl p-2.5', iconCls)}>
          <Icon className="size-5" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function DashboardOverviewContent() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { data: appointments = [], isLoading: isAppointmentsLoading } = useAppointments();
  const { data: patients = [], isLoading: isPatientsLoading } = useQuery({
    queryKey: queryKeys.patients,
    queryFn: listPatientsLiveOrDemo,
  });
  const { data: invoices = [], isLoading: isInvoicesLoading } = useQuery({
    queryKey: queryKeys.invoices,
    queryFn: listInvoicesLiveOrDemo,
  });
  const { data: inventoryItems = [], isLoading: isInventoryLoading } = useQuery({
    queryKey: queryKeys.inventory,
    queryFn: listInventoryItemsLiveOrDemo,
  });
  const { data: services = [] } = useServicesCatalog();

  const isLoading =
    isAppointmentsLoading ||
    isPatientsLoading ||
    isInvoicesLoading ||
    isInventoryLoading;

  const todayKey = getLocalDateKey(new Date());

  const yesterdayKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateKey(d);
  }, []);

  const todaysAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => getLocalDateKey(appointment.scheduledAt) === todayKey)
        .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
        .slice(0, 6),
    [appointments, todayKey],
  );

  const yesterdayAppointmentCount = useMemo(
    () => appointments.filter((a) => getLocalDateKey(a.scheduledAt) === yesterdayKey).length,
    [appointments, yesterdayKey],
  );

  const pendingConsultations = useMemo(
    () =>
      appointments.filter((appointment) =>
        ['scheduled', 'confirmed', 'in_progress'].includes(appointment.status),
      ).length,
    [appointments],
  );

  const lowStockItems = useMemo(
    () =>
      inventoryItems
        .filter((item) => item.stockOnHand <= item.reorderLevel)
        .sort(
          (left, right) =>
            left.stockOnHand - left.reorderLevel - (right.stockOnHand - right.reorderLevel),
        ),
    [inventoryItems],
  );

  const revenue = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.paymentStatus === 'paid')
        .reduce((sum, invoice) => sum + invoice.total, 0),
    [invoices],
  );

  const thisMonthRevenue = useMemo(() => {
    const now = new Date();
    return invoices
      .filter((inv) => {
        if (inv.paymentStatus !== 'paid') return false;
        const d = new Date(inv.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, inv) => sum + inv.total, 0);
  }, [invoices]);

  const lastMonthRevenue = useMemo(() => {
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return invoices
      .filter((inv) => {
        if (inv.paymentStatus !== 'paid') return false;
        const d = new Date(inv.createdAt);
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      })
      .reduce((sum, inv) => sum + inv.total, 0);
  }, [invoices]);

  const newPatientsThisMonth = useMemo(() => {
    const now = new Date();
    return patients.filter((p) => {
      const d = new Date(p.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [patients]);

  const newPatientsLastMonth = useMemo(() => {
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return patients.filter((p) => {
      const d = new Date(p.createdAt);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    }).length;
  }, [patients]);

  const patientMap = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient])),
    [patients],
  );
  const serviceMap = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }).format(new Date()),
    [],
  );

  // KPI insights
  const appointmentInsight = useMemo((): KpiInsight => {
    const today = todaysAppointments.length;
    const yesterday = yesterdayAppointmentCount;
    if (today > yesterday) return { trend: 'up', label: `Up from ${yesterday} yesterday` };
    if (today < yesterday) return { trend: 'down', label: `Down from ${yesterday} yesterday` };
    return { trend: 'neutral', label: `${yesterday} scheduled yesterday` };
  }, [todaysAppointments.length, yesterdayAppointmentCount]);

  const consultationInsight = useMemo((): KpiInsight => {
    if (pendingConsultations === 0) return { trend: 'neutral', label: '0 pending — queue is clear' };
    if (pendingConsultations <= 3) return { trend: 'neutral', label: `${pendingConsultations} active · light load` };
    if (pendingConsultations <= 7) return { trend: 'up', label: `${pendingConsultations} active · monitor closely` };
    return { trend: 'down', label: `${pendingConsultations} active · act quickly` };
  }, [pendingConsultations]);

  const patientInsight = useMemo((): KpiInsight => {
    if (newPatientsThisMonth > newPatientsLastMonth)
      return { trend: 'up', label: `${newPatientsThisMonth} new this month · up from last` };
    if (newPatientsThisMonth < newPatientsLastMonth)
      return { trend: 'down', label: `${newPatientsThisMonth} new this month · slower than last` };
    return { trend: 'neutral', label: `${newPatientsThisMonth} new this month · same pace` };
  }, [newPatientsThisMonth, newPatientsLastMonth]);

  const revenueInsight = useMemo((): KpiInsight => {
    if (lastMonthRevenue === 0)
      return { trend: 'neutral', label: `${formatCurrency(thisMonthRevenue)} collected this month` };
    const pct = Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);
    if (pct > 0) return { trend: 'up', label: `+${pct}% vs last month` };
    if (pct < 0) return { trend: 'down', label: `${pct}% vs last month` };
    return { trend: 'neutral', label: '0% change vs last month' };
  }, [thisMonthRevenue, lastMonthRevenue]);

  return (
    <>
      <section className={cn(INTERNAL_SURFACE, 'divide-y divide-slate-100/90')}>
        <div className="flex flex-col gap-5 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Dashboard</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{clinic.clinicName} operations</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              <span className="font-medium text-slate-800">{todayLabel}.</span> Keep queues moving and act on alerts quickly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NavLink
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:brightness-95"
              to="/app/appointments"
            >
              View appointments <ArrowRight className="size-3.5" />
            </NavLink>
            <NavLink
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50"
              to="/app/patients"
            >
              Patients
            </NavLink>
          </div>
        </div>
        <div className={cn(INTERNAL_SURFACE_FOOTER, 'px-6 py-2.5')}>
          <span className="text-xs font-medium text-slate-500">Live snapshot · refresh on navigation</span>
        </div>
      </section>

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <KpiCard
          hint="Includes portal and internal schedules"
          icon={CalendarCheck2}
          insight={appointmentInsight}
          label="Today's appointments"
          value={String(todaysAppointments.length)}
        />
        <KpiCard
          hint="Scheduled, confirmed, or in progress"
          icon={Stethoscope}
          insight={consultationInsight}
          label="Pending consultations"
          value={String(pendingConsultations)}
        />
        <KpiCard
          hint="Unified patient records"
          icon={Users}
          insight={patientInsight}
          label="Registered patients"
          value={String(patients.length)}
        />
        <KpiCard
          hint="Paid invoices only"
          icon={Coins}
          insight={revenueInsight}
          label="Collected revenue"
          value={formatCurrency(revenue)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className={cn(INTERNAL_SURFACE, 'flex flex-col')}>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100/90 px-6 py-4">
            <div>
              <p className="text-sm font-bold text-slate-900">Today&apos;s queue</p>
              <p className="text-[12px] text-slate-500">
                {todaysAppointments.length} scheduled visit{todaysAppointments.length !== 1 ? 's' : ''}
              </p>
            </div>
            <NavLink
              className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)] hover:underline"
              to="/app/appointments"
            >
              See all <ArrowRight className="size-3" />
            </NavLink>
          </div>

          <div className="flex flex-1 flex-col p-4">
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Loading...</div>
            ) : todaysAppointments.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <CalendarCheck2 className="size-8 text-slate-200" strokeWidth={1.5} />
                <p className="text-sm text-slate-400">No appointments scheduled for today</p>
              </div>
            ) : (
              <div className="grid h-full grid-cols-3 gap-3">
                {todaysAppointments.slice(0, 3).map((appointment) => {
                  const patient = appointment.patientId ? patientMap.get(appointment.patientId) : null;
                  const service = serviceMap.get(appointment.serviceId);
                  const timeLabel = new Date(appointment.scheduledAt).toLocaleTimeString('en-PH', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  });
                  const initials = patient
                    ? `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`
                    : 'DC';
                  const sexLabel = patient?.sex
                    ? patient.sex.charAt(0).toUpperCase() + patient.sex.slice(1)
                    : null;
                  const statusToneMap = {
                    scheduled: {
                      label: 'Scheduled',
                      icon: CalendarCheck2,
                      className: 'bg-sky-50 text-sky-700 ring-sky-100',
                    },
                    confirmed: {
                      label: 'Confirmed',
                      icon: CheckCircle2,
                      className: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
                    },
                    in_progress: {
                      label: 'In progress',
                      icon: Stethoscope,
                      className: 'bg-violet-50 text-violet-700 ring-violet-100',
                    },
                    completed: {
                      label: 'Completed',
                      icon: CheckCircle2,
                      className: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
                    },
                    cancelled: {
                      label: 'Cancelled',
                      icon: AlertTriangle,
                      className: 'bg-rose-50 text-rose-700 ring-rose-100',
                    },
                    no_show: {
                      label: 'No show',
                      icon: AlertTriangle,
                      className: 'bg-amber-50 text-amber-700 ring-amber-100',
                    },
                  } as const;
                  const statusTone =
                    statusToneMap[appointment.status as keyof typeof statusToneMap] ??
                    ({
                      label: appointment.status.replace(/_/g, ' '),
                      icon: Minus,
                      className: 'bg-slate-100 text-slate-600 ring-slate-200',
                    } as const);
                  const StatusIcon = statusTone.icon;
                  const metaChips = [
                    sexLabel ? { label: sexLabel, icon: UserRound } : null,
                    patient?.bloodType ? { label: patient.bloodType, icon: Droplet } : null,
                    !patient ? { label: 'Doctors Only', icon: Users } : null,
                  ].filter((item): item is { label: string; icon: typeof UserRound } => Boolean(item));

                  return (
                    <div
                      key={appointment.id}
                      className="flex h-full flex-col gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100"
                    >
                      {/* Avatar + name + pills */}
                      <div className="flex items-stretch gap-3 border-b border-slate-200/70 pb-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] text-base font-bold text-[var(--color-primary)] ring-1 ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]">
                          {initials || '?'}
                        </div>
                        <div className="min-w-0 flex-1 py-0.5">
                          <p className="truncate text-base font-semibold leading-tight text-slate-900">
                            {patient
                              ? `${patient.firstName} ${patient.lastName}`
                              : 'Doctors Collaboration'}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {metaChips.map((chip) => (
                              <span
                                key={chip.label}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200/80"
                              >
                                <chip.icon className="size-3 shrink-0" />
                                {chip.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Service badge */}
                      <div className="rounded-lg bg-slate-100/90 px-3 py-2.5 ring-1 ring-slate-200/80">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Service</p>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-tight text-slate-800">
                          {service?.name ?? appointment.reason}
                        </p>
                      </div>

                      <div className="mt-auto flex items-end justify-between gap-2">
                        <div className="flex flex-col gap-1.5">
                          <span
                            className={cn(
                              'inline-flex w-fit items-center text-[11px] font-semibold tracking-wide',
                              statusTone.className.replace(/bg-[^ ]+\s?|ring-[^ ]+\s?/g, ''),
                            )}
                          >
                            <StatusIcon className="mr-1 size-3.5 shrink-0" strokeWidth={2.2} />
                            {statusTone.label}
                          </span>
                          <p className="text-lg font-semibold tabular-nums text-slate-700">{timeLabel}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          {appointment.visitType === 'teleconsultation' &&
                          ['scheduled', 'confirmed', 'in_progress'].includes(appointment.status) ? (
                            <NavLink
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)]"
                              to={`/app/teleconsult/${appointment.id}`}
                            >
                              <span>Join Call</span>
                              <ArrowUpRight className="size-3.5 text-white" />
                            </NavLink>
                          ) : null}
                          <NavLink
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-slate-900 hover:underline"
                            to="/app/appointments"
                          >
                            <span>Details</span>
                            <ArrowRight className="size-3 text-[var(--color-primary)]" />
                          </NavLink>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className={INTERNAL_SURFACE}>
            <div className={cn(
              'flex items-center gap-3 px-5 py-4',
              !isLoading && lowStockItems.length > 0 && 'border-b border-slate-100/90',
            )}>
              <div className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl ring-1',
                isLoading || lowStockItems.length > 0
                  ? 'bg-rose-50 text-rose-600 ring-rose-100/80'
                  : 'bg-emerald-50 text-emerald-600 ring-emerald-100/80',
              )}>
                {!isLoading && lowStockItems.length === 0
                  ? <CheckCircle2 className="size-4" strokeWidth={2} />
                  : <AlertTriangle className="size-4" strokeWidth={2} />
                }
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Inventory alerts</p>
                <p className="text-[12px] text-slate-500">
                  {isLoading
                    ? 'Loading stock levels...'
                    : lowStockItems.length === 0
                      ? 'All stock levels are healthy'
                      : `${lowStockItems.length} item${lowStockItems.length !== 1 ? 's' : ''} below reorder level`
                  }
                </p>
              </div>
            </div>
            {(isLoading || lowStockItems.length > 0) && (
              <ul className="divide-y divide-slate-100">
                {isLoading ? (
                  <li className="px-5 py-5 text-center text-sm text-slate-400">Loading...</li>
                ) : (
                  lowStockItems.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <div className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{item.unit} · reorder at {item.reorderLevel}</p>
                        </div>
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-800 ring-1 ring-rose-100">
                          {item.stockOnHand} left
                        </span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          <div className={INTERNAL_SURFACE}>
            <div className="px-5 pt-4 pb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Quick actions</p>
            </div>
            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              {([
                { label: 'Appointments', desc: 'Schedule a visit', to: '/app/appointments', icon: CalendarCheck2, chip: 'bg-slate-100 text-slate-600 ring-slate-200/80' },
                { label: 'Patients', desc: 'Browse records', to: '/app/patients', icon: Users, chip: 'bg-slate-100 text-slate-600 ring-slate-200/80' },
                { label: 'Laboratory', desc: 'Manage requests', to: '/app/laboratory', icon: FlaskConical, chip: 'bg-slate-100 text-slate-600 ring-slate-200/80' },
                { label: 'Inventory', desc: 'Track stock', to: '/app/inventory', icon: PackageSearch, chip: 'bg-slate-100 text-slate-600 ring-slate-200/80' },
              ] as const).map((action) => (
                <NavLink
                  key={action.to}
                  className="group flex flex-col gap-3 rounded-xl bg-slate-50 p-4 transition-colors hover:bg-slate-100/80"
                  to={action.to}
                >
                  <div className={cn('flex size-9 items-center justify-center rounded-lg ring-1', action.chip)}>
                    <action.icon className="size-4" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-950">{action.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{action.desc}</p>
                  </div>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

type DashboardTab = 'overview' | 'analytics';

const DASHBOARD_TABS: { id: DashboardTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
];

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  return (
    <InternalPage>
      <div className={cn(INTERNAL_SURFACE, 'p-2 sm:p-2.5')}>
        <div
          aria-label="Dashboard sections"
          className="flex flex-wrap gap-1 border-b border-slate-100/90 px-1 pb-px"
          role="tablist"
        >
          {DASHBOARD_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                aria-selected={isActive}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-3 text-[11px] font-semibold uppercase tracking-wide transition',
                  isActive
                    ? 'bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] text-[var(--color-primary)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--color-primary)_25%,white)]'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                )}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                <Icon className="size-3.5 shrink-0 opacity-90" strokeWidth={2} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' && <DashboardOverviewContent />}
      {activeTab === 'analytics' && <AnalyticsContent />}
    </InternalPage>
  );
}
