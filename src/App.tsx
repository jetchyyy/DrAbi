import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';

import { SplashScreen } from './components/layout/splash-screen';
import { defaultClinicSettings } from './config/clinic';
import { router } from './routes/router';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSplash(false);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  if (showSplash) {
    return <SplashScreen clinicName={defaultClinicSettings.clinicName} />;
  }

  return <RouterProvider router={router} />;
}

export default App;

