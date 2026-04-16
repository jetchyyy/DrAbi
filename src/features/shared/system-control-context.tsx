import { useMutation } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { queryClient } from '../../app/query-client';
import { defaultEnabledModules } from '../../config/modules';
import { odcAccessConfig } from '../../config/odc-access';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { queryKeys } from '../../lib/query-keys';
import { updateSystemControlLiveOrDemo, verifyOdcCredentialLiveOrDemo, type OdcCredentialInput } from '../../lib/supabase-clinic';

interface SystemControlContextValue {
  unlocked: boolean;
  clinicReady: boolean;
  systemEnabled: boolean;
  systemMessage: string;
  enabledModules: typeof defaultEnabledModules;
  unlock: (credential: OdcCredentialInput) => Promise<boolean>;
  lock: () => void;
  setSystemState: (input: { systemEnabled: boolean; systemMessage: string; enabledModules: typeof defaultEnabledModules }) => Promise<void>;
  updating: boolean;
}

const SystemControlContext = createContext<SystemControlContextValue | undefined>(undefined);

function getStoredCredential() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(odcAccessConfig.sessionAccessKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as OdcCredentialInput;
  } catch {
    return { accessKey: raw };
  }
}

function persistCredential(credential: OdcCredentialInput | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (credential) {
    window.sessionStorage.setItem(odcAccessConfig.sessionAccessKey, JSON.stringify(credential));
    return;
  }

  window.sessionStorage.removeItem(odcAccessConfig.sessionAccessKey);
}

export function SystemControlProvider({ children }: PropsWithChildren) {
  const { data: clinicSettings, isLoading } = useClinicSettingsData();
  const [credential, setCredential] = useState<OdcCredentialInput | null>(getStoredCredential);
  const mutation = useMutation({
    mutationFn: updateSystemControlLiveOrDemo,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clinicSettings });
    },
  });

  const value = useMemo<SystemControlContextValue>(() => ({
    unlocked: Boolean(credential?.accessKey || credential?.recoveryPassword),
    clinicReady: !isLoading,
    systemEnabled: clinicSettings?.systemEnabled ?? true,
    systemMessage:
      clinicSettings?.systemMessage ?? 'Contact your System Administrator to continue using the System',
    enabledModules: clinicSettings?.enabledModules ?? defaultEnabledModules,
    async unlock(nextCredential) {
      const isValid = await verifyOdcCredentialLiveOrDemo(nextCredential);
      if (isValid) {
        persistCredential(nextCredential);
        setCredential(nextCredential);
      }
      return isValid;
    },
    lock() {
      persistCredential(null);
      setCredential(null);
    },
    async setSystemState(input) {
      if (!credential) {
        throw new Error('ODC credential is required.');
      }

      await mutation.mutateAsync({
        ...credential,
        systemEnabled: input.systemEnabled,
        systemMessage: input.systemMessage,
        enabledModules: input.enabledModules,
      });
    },
    updating: mutation.isPending,
  }), [clinicSettings?.enabledModules, clinicSettings?.systemEnabled, clinicSettings?.systemMessage, credential, isLoading, mutation]);

  return <SystemControlContext.Provider value={value}>{children}</SystemControlContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSystemControl() {
  const context = useContext(SystemControlContext);
  if (!context) {
    throw new Error('useSystemControl must be used within SystemControlProvider');
  }
  return context;
}
