import { useEffect, useMemo, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { SplashScreen } from './components/layout/splash-screen';
import { defaultClinicSettings } from './config/clinic';
import { useClinicBranding } from './hooks/use-clinic-branding';
import { queryKeys } from './lib/query-keys';
import { getClinicSettingsLiveOrDemo } from './lib/supabase-clinic';
import type { ClinicSettings } from './types/domain';
import { router } from './routes/router';

// ── Tiny clinic snapshot cache ────────────────────────────────────────────────
// After the first successful Supabase fetch we persist the result to
// localStorage under this key.  On every subsequent page load we read it
// back immediately as initialData so the splash screen never shows stale
// defaults — the correct clinic name and brand color appear at frame 0.

const SNAPSHOT_KEY = 'odc-clinic-snapshot';

function readSnapshot(): ClinicSettings | undefined {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as ClinicSettings) : undefined;
  } catch {
    return undefined;
  }
}

function writeSnapshot(settings: ClinicSettings) {
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(settings));
  } catch { /* quota exceeded — ignore */ }
}

// ── Branding provider ─────────────────────────────────────────────────────────

function BrandingProvider({ children }: { children: React.ReactNode }) {
  useClinicBranding();
  return <>{children}</>;
}

// ── App ───────────────────────────────────────────────────────────────────────

const SPLASH_MIN_MS = 1800;

export default function App() {
  const [timerDone, setTimerDone] = useState(false);

  // Read snapshot exactly once at mount (before any render).
  // On the very first load this is undefined; from the second load onward
  // it contains the last known clinic settings → zero flash.
  const cached = useMemo(() => readSnapshot(), []);

  const { data: clinic, isLoading } = useQuery({
    queryKey: queryKeys.clinicSettings,
    queryFn: async () => {
      const result = await getClinicSettingsLiveOrDemo();
      writeSnapshot(result); // keep snapshot fresh for next load
      return result;
    },
    // Seed the cache with the snapshot so React Query treats this as
    // "data already available" and skips the loading state entirely.
    initialData: cached,
    // Mark snapshot as immediately stale so a fresh fetch always runs
    // in the background, but the UI never blocks waiting for it.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setTimerDone(true), SPLASH_MIN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Keep the splash up until:
  //   a) The minimum display time has elapsed, AND
  //   b) If there was NO snapshot (first-ever load), the fetch must also settle —
  //      this prevents a momentary "wrong name" flash on first launch.
  //
  // If there IS a snapshot (all subsequent loads), isLoading is immediately
  // false (thanks to initialData), so only condition (a) matters and the
  // splash ends exactly at SPLASH_MIN_MS with the correct data.
  const showSplash = !timerDone || (!cached && isLoading);

  const clinicName   = clinic?.clinicName   ?? defaultClinicSettings.clinicName;
  const primaryColor = clinic?.primaryColor ?? defaultClinicSettings.primaryColor;

  if (showSplash) {
    return <SplashScreen clinicName={clinicName} primaryColor={primaryColor} />;
  }

  return (
    <BrandingProvider>
      <RouterProvider router={router} />
    </BrandingProvider>
  );
}
