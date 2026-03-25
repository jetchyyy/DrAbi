import { Outlet, useLocation } from 'react-router-dom';

import { odcAccessConfig } from '../config/odc-access';
import { useSystemControl } from '../features/shared/system-control-context';
import { SystemDisabledPage } from '../features/shared/system-disabled-page';

export function SystemAvailabilityGate() {
  const location = useLocation();
  const { clinicReady, systemEnabled, systemMessage } = useSystemControl();

  if (!clinicReady) {
    return <div className="p-8 text-sm text-slate-500">Loading system configuration...</div>;
  }

  if (!systemEnabled && location.pathname !== odcAccessConfig.route) {
    return <SystemDisabledPage message={systemMessage} />;
  }

  return <Outlet />;
}
