import { CalendarDays, ClipboardList, FlaskConical, TestTube2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { InternalPage } from '../../components/ui/internal-page';
import { INTERNAL_SURFACE } from '../../lib/internal-ui';
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
    <InternalPage>
      <div className={cn(INTERNAL_SURFACE, 'p-2 sm:p-2.5')}>
        <div
          aria-label="Laboratory sections"
          className="flex flex-wrap gap-1 border-b border-slate-100/90 px-1 pb-px"
          role="tablist"
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-3 text-[11px] font-semibold uppercase tracking-wide transition',
                  isActive
                    ? 'bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="size-3.5 shrink-0 opacity-90" strokeWidth={2} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'workflow' && <WorkflowTab />}
      {activeTab === 'schedule' && <ScheduleTab />}
      {activeTab === 'requests' && <RequestsTab />}
      {activeTab === 'catalog' && <CatalogTab />}
      {activeTab === 'report' && <ReportTab />}
    </InternalPage>
  );
}
