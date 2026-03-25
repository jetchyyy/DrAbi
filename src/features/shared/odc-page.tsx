import { zodResolver } from '@hookform/resolvers/zod';
import { FileKey2, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { odcAccessConfig } from '../../config/odc-access';
import { defaultClinicSettings } from '../../config/clinic';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { useSystemControl } from './system-control-context';

const recoverySchema = z.object({
  recoveryPassword: z.string().min(1, 'Recovery password is required.'),
});

const controlSchema = z.object({
  systemEnabled: z.boolean(),
  systemMessage: z.string().min(10),
});

type RecoveryValues = z.infer<typeof recoverySchema>;
type ControlValues = z.infer<typeof controlSchema>;

async function extractAccessKeyFromFile(file: File) {
  const content = (await file.text()).trim();
  if (!content) {
    throw new Error('The selected file is empty.');
  }

  try {
    const parsed = JSON.parse(content) as { accessKey?: string; odcAccessKey?: string };
    const jsonKey = parsed.accessKey ?? parsed.odcAccessKey;
    if (typeof jsonKey === 'string' && jsonKey.trim()) {
      return jsonKey.trim();
    }
  } catch {
    // A plain text key file is also supported.
  }

  return content;
}

export function OdcPage() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { unlocked, unlock, lock, setSystemState, systemEnabled, systemMessage, updating } = useSystemControl();
  const [unlockingFile, setUnlockingFile] = useState(false);
  const [unlockingPassword, setUnlockingPassword] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const recoveryForm = useForm<RecoveryValues>({
    resolver: zodResolver(recoverySchema),
    defaultValues: {
      recoveryPassword: '',
    },
  });
  const controlForm = useForm<ControlValues>({
    resolver: zodResolver(controlSchema),
    values: {
      systemEnabled,
      systemMessage,
    },
  });

  const enabledSelection = useWatch({ control: controlForm.control, name: 'systemEnabled' });

  if (!unlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#08142c_0%,#10295e_50%,#eef5ff_50%,#f8f3ea_100%)] px-4 py-8">
        <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-2">
          <Card className="p-8">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">ODC Superadmin</p>
            <CardTitle className="mt-3 text-3xl">Unlock with config key file</CardTitle>
            <p className="mt-3 text-sm text-slate-500">
              Load the ODC config key file issued to your administrators to access the emergency control console.
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const fileInput = event.currentTarget.elements.namedItem('odcKeyFile') as HTMLInputElement | null;
                const file = fileInput?.files?.[0];
                if (!file) {
                  toast.error('Select your ODC key file first.');
                  return;
                }

                setUnlockingFile(true);
                try {
                  const accessKey = await extractAccessKeyFromFile(file);
                  const isValid = await unlock({ accessKey });
                  if (!isValid) {
                    toast.error('The selected ODC key file is invalid.');
                    return;
                  }

                  toast.success('Superadmin console unlocked.');
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Unable to read the ODC key file.');
                } finally {
                  setUnlockingFile(false);
                }
              }}
            >
              <FormField label="ODC config key file">
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <FileKey2 className="size-4 text-slate-400" />
                  <span className="truncate">{selectedFileName || 'Choose .json, .key, or .txt file'}</span>
                  <input
                    accept={odcAccessConfig.acceptedFileExtensions}
                    className="hidden"
                    name="odcKeyFile"
                    type="file"
                    onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name ?? '')}
                  />
                </label>
              </FormField>
              <p className="text-xs text-slate-400">
                Supported formats: raw text key, or JSON containing `accessKey`.
              </p>
              <Button className="w-full" disabled={unlockingFile} type="submit">
                {unlockingFile ? 'Validating key file...' : 'Unlock with key file'}
              </Button>
            </form>
          </Card>

          <Card className="p-8">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Emergency Recovery</p>
            <CardTitle className="mt-3 text-3xl">Unlock with recovery password</CardTitle>
            <p className="mt-3 text-sm text-slate-500">
              Use the recovery password stored in your database if the key file is unavailable.
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={recoveryForm.handleSubmit(async (values) => {
                setUnlockingPassword(true);
                try {
                  const isValid = await unlock({ recoveryPassword: values.recoveryPassword });
                  if (!isValid) {
                    toast.error('The recovery password is invalid.');
                    return;
                  }

                  toast.success('Superadmin console unlocked.');
                  recoveryForm.reset();
                } finally {
                  setUnlockingPassword(false);
                }
              })}
            >
              <FormField label="Recovery password">
                <Input type="password" placeholder="Enter recovery password" {...recoveryForm.register('recoveryPassword')} />
              </FormField>

              <Button className="w-full" disabled={unlockingPassword} type="submit">
                <KeyRound className="size-4" />
                {unlockingPassword ? 'Validating password...' : 'Unlock with password'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f9ff_0%,#f8f3ea_100%)] px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="bg-slate-950 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">/odc Superadmin Console</p>
              <CardTitle className="mt-3 text-4xl text-white">{clinic.clinicName}</CardTitle>
              <p className="mt-3 text-sm text-slate-300">
                Full emergency control for availability, recovery messaging, and service continuity.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => lock()}>
              Lock Console
            </Button>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <div className="flex items-center gap-3">
              {systemEnabled ? <ShieldCheck className="size-5 text-emerald-600" /> : <ShieldAlert className="size-5 text-rose-600" />}
              <CardTitle>System status</CardTitle>
            </div>
            <p className="mt-5 text-3xl font-semibold text-slate-950">{systemEnabled ? 'Enabled' : 'Disabled'}</p>
            <p className="mt-3 text-sm text-slate-500">
              When disabled, every route except `/odc` is blocked and users see the system administrator recovery message.
            </p>
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Current maintenance message</p>
              <p className="mt-2 text-sm text-slate-700">{systemMessage}</p>
            </div>
          </Card>

          <Card>
            <CardTitle>Emergency controls</CardTitle>
            <form
              className="mt-5 space-y-4"
              onSubmit={controlForm.handleSubmit(async (values) => {
                await setSystemState(values);
                toast.success(values.systemEnabled ? 'System has been re-enabled.' : 'System has been disabled.');
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  type="button"
                  variant={enabledSelection ? 'primary' : 'secondary'}
                  onClick={() => controlForm.setValue('systemEnabled', true)}
                >
                  Enable whole system
                </Button>
                <Button
                  type="button"
                  variant={!enabledSelection ? 'danger' : 'secondary'}
                  onClick={() => controlForm.setValue('systemEnabled', false)}
                >
                  Disable whole system
                </Button>
              </div>
              <FormField label="System-wide message">
                <Textarea {...controlForm.register('systemMessage')} />
              </FormField>
              <Button className="w-full" disabled={updating} type="submit">
                {updating ? 'Applying...' : 'Apply superadmin control'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

