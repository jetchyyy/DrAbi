import { NavLink, Outlet } from 'react-router-dom';

import { settingsNavigation } from '../../config/navigation';
import { cn } from '../../lib/utils';

export function SettingsLayout() {
  return (
    <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-[28px] border border-white/60 bg-white/85 p-4 shadow-sm">
        <h2 className="px-3 pb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Settings
        </h2>
        <nav className="space-y-1">
          {settingsNavigation.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) =>
                cn(
                  'block rounded-2xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100',
                  isActive && 'bg-slate-950 text-white',
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

