import {
  CalendarCheck2,
  Coins,
  FlaskConical,
  PackageSearch,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardTitle } from '../../components/ui/card';
import { StatCard } from '../../components/ui/stat-card';
import { getDashboardSnapshot, getDatabase } from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';
import { formatCurrency, formatDateTimeLabel } from '../../lib/utils';

export function DashboardPage() {
  const { data: snapshot } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => getDashboardSnapshot(),
  });

  const database = getDatabase();
  const todaysAppointments = database.appointments.slice(0, 4);
  const lowStockItems = database.inventoryItems.filter((item) => item.stockOnHand <= item.reorderLevel);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Today's Appointments"
          value={String(snapshot?.appointmentsToday ?? 0)}
          hint="Includes portal and internal scheduling"
          icon={CalendarCheck2}
        />
        <StatCard
          label="Registered Patients"
          value={String(snapshot?.patientCount ?? 0)}
          hint="Unified patient records"
          icon={Users}
        />
        <StatCard
          label="Collected Revenue"
          value={formatCurrency(snapshot?.revenue ?? 0)}
          hint="Cashier summary for the day"
          icon={Coins}
        />
        <StatCard
          label="Pending Consultations"
          value={String(snapshot?.pendingConsultations ?? 0)}
          hint="Queue waiting for physician workflow"
          icon={Stethoscope}
        />
        <StatCard
          label="Lab Workload"
          value={String(snapshot?.labWorkload ?? 0)}
          hint="Orders not yet released"
          icon={FlaskConical}
        />
        <StatCard
          label="Inventory Alerts"
          value={String(snapshot?.lowStock ?? 0)}
          hint="Items at or below reorder level"
          icon={PackageSearch}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardTitle>Appointment board</CardTitle>
          <div className="mt-5 space-y-4">
            {todaysAppointments.map((appointment) => {
              const patient = database.patients.find((item) => item.id === appointment.patientId);
              const service = database.services.find((item) => item.id === appointment.serviceId);
              return (
                <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4">
                  <div>
                    <p className="font-medium text-slate-950">{patient?.firstName} {patient?.lastName}</p>
                    <p className="text-sm text-slate-500">{service?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-950">{formatDateTimeLabel(appointment.scheduledAt)}</p>
                    <p className="text-sm capitalize text-slate-500">{appointment.status.replace('_', ' ')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardTitle>Inventory watchlist</CardTitle>
          <div className="mt-5 space-y-3">
            {lowStockItems.map((item) => (
              <div key={item.id} className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-medium text-slate-950">{item.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.stockOnHand} {item.unit} remaining, reorder level {item.reorderLevel}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

