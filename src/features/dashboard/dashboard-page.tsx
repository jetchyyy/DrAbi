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
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';

import { defaultClinicSettings } from '../../config/clinic';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { getDashboardSnapshot, getDatabase } from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';
import { formatCurrency, formatDateTimeLabel } from '../../lib/utils';

// Stat card with colored gradient background
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
    orange: { bg: 'bg-orange-600', text: 'text-white', sub: 'text-orange-100', icon: 'bg-white/20 text-white', val: 'text-white' },
    slate:  { bg: 'bg-slate-800',  text: 'text-white', sub: 'text-slate-300',  icon: 'bg-white/10 text-slate-200', val: 'text-white' },
    emerald:{ bg: 'bg-emerald-600',text: 'text-white', sub: 'text-emerald-100',icon: 'bg-white/20 text-white', val: 'text-white' },
    sky:    { bg: 'bg-sky-600',    text: 'text-white', sub: 'text-sky-100',    icon: 'bg-white/20 text-white', val: 'text-white' },
    violet: { bg: 'bg-violet-700', text: 'text-white', sub: 'text-violet-200', icon: 'bg-white/20 text-white', val: 'text-white' },
    rose:   { bg: 'bg-rose-600',   text: 'text-white', sub: 'text-rose-100',   icon: 'bg-white/20 text-white', val: 'text-white' },
  };
  const p = palette[color];

  return (
    <div className={`${p.bg} p-6 shadow-md relative overflow-hidden`}>
      {/* Decorative circle */}
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/5" />
      <div className="absolute -right-2 -bottom-4 w-16 h-16 rounded-full bg-white/5" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-extrabold uppercase tracking-widest ${p.sub}`}>{label}</p>
          <p className={`mt-3 text-4xl font-extrabold tracking-tight ${p.val}`}>{value}</p>
          <p className={`mt-1.5 text-[11px] font-semibold ${p.sub}`}>{hint}</p>
        </div>
        <div className={`p-3 ${p.icon} shrink-0`}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

// Status pill
function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace('_', ' ');
  if (normalized.includes('confirm') || normalized === 'complete')
    return <span className="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{normalized}</span>;
  if (normalized.includes('cancel'))
    return <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{normalized}</span>;
  return <span className="bg-orange-100 text-orange-700 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">{normalized}</span>;
}

export function DashboardPage() {
  const { data: snapshot } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => getDashboardSnapshot(),
  });
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();

  const database = getDatabase();
  const todaysAppointments = database.appointments.slice(0, 5);
  const lowStockItems = database.inventoryItems.filter((item) => item.stockOnHand <= item.reorderLevel);

  return (
    <div className="space-y-6">

      {/* ── Welcome Banner ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Dashboard</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-950 tracking-tight">Good morning, {clinic.clinicName} 👋</h1>
          <p className="mt-1 text-sm text-slate-500">Here's what's happening at your clinic today.</p>
        </div>
        <NavLink
          to="/app/appointments"
          className="flex items-center gap-2 bg-orange-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-widest text-white hover:bg-orange-700 transition-colors shrink-0"
        >
          View Appointments <ArrowRight className="size-3.5" />
        </NavLink>
      </div>

      {/* ── KPI Grid ───────────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Today's Appointments"
          value={String(snapshot?.appointmentsToday ?? 0)}
          hint="Includes portal & internal scheduling"
          icon={CalendarCheck2}
          color="orange"
        />
        <KpiCard
          label="Registered Patients"
          value={String(snapshot?.patientCount ?? 0)}
          hint="Active unified patient records"
          icon={Users}
          color="slate"
        />
        <KpiCard
          label="Collected Revenue"
          value={formatCurrency(snapshot?.revenue ?? 0)}
          hint="Cashier summary for today"
          icon={Coins}
          color="emerald"
        />
        <KpiCard
          label="Pending Consultations"
          value={String(snapshot?.pendingConsultations ?? 0)}
          hint="Queue waiting for physician"
          icon={Stethoscope}
          color="sky"
        />
        <KpiCard
          label="Lab Workload"
          value={String(snapshot?.labWorkload ?? 0)}
          hint="Orders not yet released"
          icon={FlaskConical}
          color="violet"
        />
        <KpiCard
          label="Inventory Alerts"
          value={String(snapshot?.lowStock ?? 0)}
          hint="Items at or below reorder level"
          icon={PackageSearch}
          color="rose"
        />
      </section>

      {/* ── Main content row ───────────────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">

        {/* Appointment board */}
        <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-orange-600 text-white">
                <CalendarCheck2 className="size-4" />
              </div>
              <div>
                <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Appointment Board</p>
                <p className="text-[11px] text-slate-400 font-medium">Today's scheduled visits</p>
              </div>
            </div>
            <NavLink
              to="/app/appointments"
              className="text-[11px] font-extrabold uppercase tracking-widest text-orange-600 hover:underline flex items-center gap-1"
            >
              See all <ArrowRight className="size-3" />
            </NavLink>
          </div>

          <div className="divide-y divide-slate-100">
            {todaysAppointments.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">No appointments scheduled today.</div>
            ) : (
              todaysAppointments.map((appointment) => {
                const patient = database.patients.find((item) => item.id === appointment.patientId);
                const service = database.services.find((item) => item.id === appointment.serviceId);
                return (
                  <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0 text-orange-700 text-xs font-extrabold">
                        {patient?.firstName?.[0]}{patient?.lastName?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-950 leading-tight">{patient?.firstName} {patient?.lastName}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{service?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-slate-950 flex items-center gap-1 justify-end">
                          <Clock className="size-3 text-slate-400" />
                          {formatDateTimeLabel(appointment.scheduledAt)}
                        </p>
                      </div>
                      <StatusPill status={appointment.status} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Low stock watchlist */}
          <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
              <div className="p-2 bg-rose-600 text-white">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Inventory Alerts</p>
                <p className="text-[11px] text-slate-400 font-medium">{lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below reorder level</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {lowStockItems.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">All inventory levels are healthy.</div>
              ) : (
                lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-bold text-sm text-slate-950">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.unit} · reorder at {item.reorderLevel}</p>
                    </div>
                    <span className="bg-rose-100 text-rose-700 text-xs font-extrabold px-2.5 py-1 uppercase tracking-wider shrink-0 whitespace-nowrap">
                      {item.stockOnHand} left
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
              <div className="p-2 bg-slate-800 text-white">
                <TrendingUp className="size-4" />
              </div>
              <p className="font-extrabold text-sm uppercase tracking-wide text-slate-950">Quick Actions</p>
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
                  className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <action.icon className={`size-4 shrink-0 ${action.color}`} />
                    <p className="font-semibold text-sm text-slate-800 group-hover:text-slate-950">{action.label}</p>
                  </div>
                  <ArrowRight className="size-3.5 text-slate-300 group-hover:text-orange-600 transition-colors" />
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
