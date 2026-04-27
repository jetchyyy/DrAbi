import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { SplashScreen } from './components/layout/splash-screen';
import { defaultClinicSettings } from './config/clinic';
import { useClinicBranding } from './hooks/use-clinic-branding';
import { queryKeys } from './lib/query-keys';
import { getClinicSettingsLiveOrDemo } from './lib/supabase-clinic';
import { router } from './routes/router';

const SPLASH_MIN_MS = 1800;

/**
 * Mounts the branding hook so CSS variables and Tailwind orange overrides
 * are kept in sync globally after the splash screen dismisses.
 */
function BrandingProvider({ children }: { children: React.ReactNode }) {
  useClinicBranding();
  return <>{children}</>;
}

/**
 * Handles the splash screen lifecycle:
 *  1. Immediately shows the splash (zero delay — never blocks on network).
 *  2. Prefetches clinic settings IN PARALLEL with the timer so React Query
 *     caches the result. By the time the splash ends, data is already warm.
 *  3. Keeps the splash up until BOTH conditions are met:
 *       a. At least SPLASH_MIN_MS has elapsed.
 *       b. The clinic settings fetch has settled (success OR error).
 *     This eliminates the post-splash loading flash: when the app mounts,
 *     the clinic data is already in the React Query cache.
 *  4. Falls back gracefully to defaultClinicSettings if the fetch fails,
 *     so the splash always shows something meaningful.
 */
export default function App() {
  const [timerDone, setTimerDone] = useState(false);

  // Prefetch clinic settings while the splash is showing.
  // staleTime keeps this cached for 5 min so subsequent renders are instant.
  const { data: clinic, isLoading } = useQuery({
    queryKey: queryKeys.clinicSettings,
    queryFn: getClinicSettingsLiveOrDemo,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setTimerDone(true), SPLASH_MIN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Show splash until the timer has elapsed AND the fetch has settled.
  const showSplash = !timerDone || isLoading;

  const clinicName    = clinic?.clinicName    ?? defaultClinicSettings.clinicName;
  const primaryColor  = clinic?.primaryColor  ?? defaultClinicSettings.primaryColor;

  if (showSplash) {
    return (
      <SplashScreen
        clinicName={clinicName}
        primaryColor={primaryColor}
      />
    );
  }

  return (
    <BrandingProvider>
      <RouterProvider router={router} />
    </BrandingProvider>
  );
}
