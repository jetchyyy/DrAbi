import { NavLink, Outlet } from 'react-router-dom';

import { settingsNavigation } from '../../config/navigation';
import { cn } from '../../lib/utils';

export function SettingsLayout() {
  return (
    <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="px-3 pb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Settings
        </h2>
        <nav className="space-y-1">
          {settingsNavigation.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) =>
                cn(
                  'block rounded-sm px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50',
                  isActive && 'bg-orange-50 font-medium text-orange-700',
                )
              }
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <Outlet />
    </div>
  );
}

