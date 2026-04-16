import { CalendarDays, ClipboardList, FlaskConical, TestTube2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { WorkflowTab } from './components/workflow-tab';
import { ScheduleTab } from './components/schedule-tab';
import { RequestsTab } from './components/requests-tab';
import { CatalogTab } from './components/catalog-tab';
import { ReportTab } from './components/report-tab';

type TabId = 'workflow' | 'schedule' | 'requests' | 'catalog' | 'report';

const TABS: { id: TabId; label: string; icon: typeof FlaskConical }[] = [
  { id: 'workflow', label: 'Workflow', icon: FlaskConical },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'requests', label: 'Requests', icon: ClipboardList },
  { id: 'catalog', label: 'Catalog', icon: TestTube2 },
  { id: 'report', label: 'Report', icon: ClipboardList },
];

export function LaboratoryPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'patient';
  const [activeTab, setActiveTab] = useState<TabId>('workflow');

  const visibleTabs = useMemo(() => {
    if (role === 'front_desk_cashier') {
      return TABS.filter((tab) => tab.id === 'schedule' || tab.id === 'requests');
    }

    return TABS;
  }, [role]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id ?? 'workflow');
    }
  }, [activeTab, visibleTabs]);

  return (
    <div className="space-y-0">
      <div className="flex border-b border-slate-200 bg-white -mx-6 px-6 mb-6">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'flex items-center gap-2 px-5 py-4 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'workflow' && <WorkflowTab />}
      {activeTab === 'schedule' && <ScheduleTab />}
      {activeTab === 'requests' && <RequestsTab />}
      {activeTab === 'catalog' && <CatalogTab />}
      {activeTab === 'report' && <ReportTab />}
    </div>
  );
}
