import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  Clock,
  Coins,
  FlaskConical,
  PackageSearch,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';

import { defaultClinicSettings } from '../../config/clinic';
import { useClinicSettingsData, useServicesCatalog } from '../../hooks/use-clinic-data';
import { getDatabase } from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  listInventoryItemsLiveOrDemo,
  listInvoicesLiveOrDemo,
  listPatientsLiveOrDemo,
} from '../../lib/supabase-clinic';
import { formatCurrency, formatDateTimeLabel } from '../../lib/utils';
import { useAppointments } from '../appointments/hooks/use-appointments';
import { labRequestService } from '../lab-requests/api/lab-request-service';

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

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  color: 'orange' | 'slate' | 'emerald' | 'sky' | 'violet' | 'rose';
}) {
  const palette = {
    orange: {
      surface: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      icon: 'bg-white/20 text-white',
      label: 'text-orange-100',
      value: 'text-white',
      hint: 'text-orange-100/90',
    },
    slate: {
      surface: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
      icon: 'bg-white/15 text-white',
      label: 'text-slate-200',
      value: 'text-white',
      hint: 'text-slate-200/85',
    },
    emerald: {
      surface: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      icon: 'bg-white/20 text-white',
      label: 'text-emerald-100',
      value: 'text-white',
      hint: 'text-emerald-100/90',
    },
    sky: {
      surface: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      icon: 'bg-white/20 text-white',
      label: 'text-sky-100',
      value: 'text-white',
      hint: 'text-sky-100/90',
    },
    violet: {
      surface: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      icon: 'bg-white/20 text-white',
      label: 'text-violet-100',
      value: 'text-white',
      hint: 'text-violet-100/90',
    },
    rose: {
      surface: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
      icon: 'bg-white/20 text-white',
      label: 'text-rose-100',
      value: 'text-white',
      hint: 'text-rose-100/90',
    },
  };

  const p = palette[color];

  return (
    <div className="relative overflow-hidden rounded-2xl p-5 shadow-sm" style={{ background: p.surface }}>
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className={`text-[11px] font-extrabold uppercase tracking-[0.16em] ${p.label}`}>{label}</p>
          <p className={`mt-2 text-3xl font-extrabold tracking-tight ${p.value}`}>{value}</p>
          <p className={`mt-1.5 text-xs ${p.hint}`}>{hint}</p>
        </div>
        <div className={`shrink-0 rounded-xl p-2.5 ${p.icon}`}>
          <Icon className="size-4.5" />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace('_', ' ');

  if (normalized.includes('confirm') || normalized === 'completed') {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
        {normalized}
      </span>
    );
  }

  if (normalized.includes('cancel') || normalized.includes('no show')) {
    return (
      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-rose-700">
        {normalized}
      </span>
    );
  }

  return (
    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
      {normalized}
    </span>
  );
}

export function DashboardPage() {
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
  const { data: labWorkload = 0, isLoading: isLabLoading } = useQuery({
    queryKey: queryKeys.labQueue(clinic.id),
    enabled: Boolean(clinic.id),
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return getDatabase().labOrders.filter((order) => order.status !== 'released').length;
      }

      const requests = await labRequestService.listClinicQueue(clinic.id);
      return requests.filter((request) => request.status !== 'completed' && request.status !== 'cancelled').length;
    },
  });

  const isLoading =
    isAppointmentsLoading ||
    isPatientsLoading ||
    isInvoicesLoading ||
    isInventoryLoading ||
    isLabLoading;

  const todayKey = getLocalDateKey(new Date());
  const todaysAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => getLocalDateKey(appointment.scheduledAt) === todayKey)
        .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
        .slice(0, 6),
    [appointments, todayKey],
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Dashboard</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">
            {clinic.clinicName} Operations Overview
          </h1>
          <p className="mt-1 text-sm text-slate-500">Today: {todayLabel}. Keep queues moving and act on alerts quickly.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NavLink
            to="/app/appointments"
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest text-white transition hover:bg-orange-700"
          >
            View Appointments <ArrowRight className="size-3.5" />
          </NavLink>
          <NavLink
            to="/app/patients"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest text-slate-700 transition hover:bg-slate-50"
          >
            Open Patients
          </NavLink>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Today's Appointments"
          value={String(todaysAppointments.length)}
          hint="Includes portal and internal schedules"
          icon={CalendarCheck2}
          color="orange"
        />
        <KpiCard
          label="Registered Patients"
          value={String(patients.length)}
          hint="Unified patient records"
          icon={Users}
          color="slate"
        />
        <KpiCard
          label="Collected Revenue"
          value={formatCurrency(revenue)}
          hint="Paid invoices only"
          icon={Coins}
          color="emerald"
        />
        <KpiCard
          label="Pending Consultations"
          value={String(pendingConsultations)}
          hint="Scheduled, confirmed, or in progress"
          icon={Stethoscope}
          color="sky"
        />
        <KpiCard
          label="Lab Workload"
          value={String(labWorkload)}
          hint="Requests not yet completed"
          icon={FlaskConical}
          color="violet"
        />
        <KpiCard
          label="Inventory Alerts"
          value={String(lowStockItems.length)}
          hint="Items at or below reorder level"
          icon={PackageSearch}
          color="rose"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-orange-600 p-2 text-white">
                <CalendarCheck2 className="size-4" />
              </div>
              <div>
                <p className="text-sm font-extrabold uppercase tracking-wide text-slate-950">Today's Queue</p>
                <p className="text-[11px] font-medium text-slate-400">
                  {todaysAppointments.length} scheduled visit{todaysAppointments.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <NavLink
              to="/app/appointments"
              className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-widest text-orange-600 hover:underline"
            >
              See all <ArrowRight className="size-3" />
            </NavLink>
          </div>

          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">Loading dashboard data...</div>
            ) : todaysAppointments.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">No appointments scheduled for today.</div>
            ) : (
              todaysAppointments.map((appointment) => {
                const patient = patientMap.get(appointment.patientId);
                const service = serviceMap.get(appointment.serviceId);
                return (
                  <div
                    key={appointment.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-orange-100 bg-orange-50 text-xs font-extrabold text-orange-700">
                        {patient?.firstName?.[0]}
                        {patient?.lastName?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-tight text-slate-950">
                          {patient?.firstName ?? 'Unknown'} {patient?.lastName ?? 'Patient'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{service?.name ?? appointment.reason}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="hidden text-xs font-bold text-slate-900 sm:flex sm:items-center sm:gap-1">
                        <Clock className="size-3 text-slate-400" />
                        {formatDateTimeLabel(appointment.scheduledAt)}
                      </p>
                      <StatusPill status={appointment.status} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
              <div className="rounded-lg bg-rose-600 p-2 text-white">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <p className="text-sm font-extrabold uppercase tracking-wide text-slate-950">Inventory Alerts</p>
                <p className="text-[11px] font-medium text-slate-400">
                  {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below reorder level
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">Loading inventory alerts...</div>
              ) : lowStockItems.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">All inventory levels are healthy.</div>
              ) : (
                lowStockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-950">{item.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.unit} · reorder at {item.reorderLevel}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-rose-100 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-rose-700">
                      {item.stockOnHand} left
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
              <div className="rounded-lg bg-slate-800 p-2 text-white">
                <TrendingUp className="size-4" />
              </div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-slate-950">Quick Actions</p>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { label: 'New Appointment', to: '/app/appointments', icon: CalendarCheck2, color: 'text-orange-600' },
                { label: 'View Patients', to: '/app/patients', icon: Users, color: 'text-slate-700' },
                { label: 'Lab Orders', to: '/app/laboratory', icon: FlaskConical, color: 'text-violet-600' },
                { label: 'Inventory', to: '/app/inventory', icon: PackageSearch, color: 'text-rose-600' },
              ].map((action) => (
                <NavLink
                  key={action.to}
                  to={action.to}
                  className="group flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <action.icon className={`size-4 shrink-0 ${action.color}`} />
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-950">{action.label}</p>
                  </div>
                  <ArrowRight className="size-3.5 text-slate-300 transition-colors group-hover:text-orange-600" />
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
