import { LockKeyhole } from 'lucide-react';

import { moduleDefinitionMap } from '../../config/modules';
import type { ModuleKey } from '../../types/domain';

interface ModuleUnavailablePageProps {
  moduleKey: ModuleKey;
}

export function ModuleUnavailablePage({ moduleKey }: ModuleUnavailablePageProps) {
  const moduleDefinition = moduleDefinitionMap[moduleKey];

  return (
    <div className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-amber-50 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-3 text-amber-700">
            <LockKeyhole className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-700">Feature Unavailable</p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">{moduleDefinition.label} is not included in this plan</h1>
          </div>
        </div>
      </div>
      <div className="px-6 py-6">
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          This feature is currently disabled for this client account. Contact your clinic administrator if you need access to this module.
        </p>
      </div>
    </div>
  );
}
