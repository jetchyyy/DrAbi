import { LockKeyhole, ShieldAlert, Wrench } from 'lucide-react';

import { defaultClinicSettings } from '../../config/clinic';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { Card, CardTitle } from '../../components/ui/card';

interface SystemDisabledPageProps {
  message: string;
}

export function SystemDisabledPage({ message }: SystemDisabledPageProps) {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const isMaintenance = clinic.systemStatusType === 'maintenance';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#08142c_0%,#10295e_45%,#eef5ff_45%,#f7f3e9_100%)] px-4 py-10">
      <Card className="max-w-2xl p-10 text-center">
        <div className={`mx-auto flex size-16 items-center justify-center rounded-full ${isMaintenance ? 'bg-orange-100 text-orange-600' : 'bg-rose-100 text-rose-600'}`}>
          {isMaintenance ? <Wrench className="size-7" /> : <ShieldAlert className="size-7" />}
        </div>
        <p className="mt-5 text-sm uppercase tracking-[0.2em] text-slate-400">
          {isMaintenance ? 'Scheduled Maintenance' : 'Access Restricted'}
        </p>
        <CardTitle className="mt-3 text-4xl">{clinic.clinicName} System</CardTitle>
        <p className="mt-5 text-base text-slate-600 font-medium text-balance">
          {isMaintenance ? 'The system is currently undergoing maintenance.' : 'This system has been disabled by the administrator.'}
        </p>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">{message}</p>
      </Card>
    </div>
  );
}
