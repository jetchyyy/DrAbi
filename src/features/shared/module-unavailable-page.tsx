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
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{background:'color-mix(in srgb, var(--color-primary) 14%, white)'}}>
            <LockKeyhole className="size-5" style={{color:'var(--color-primary)'}} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Feature Unavailable</p>
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
