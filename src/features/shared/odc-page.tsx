import { zodResolver } from '@hookform/resolvers/zod';
import {
  FileKey2,
  KeyRound,
  Lock,
  Power,
  PowerOff,
  ShieldAlert,
  ShieldCheck,
  ShieldEllipsis,
  Terminal,
  Unlock,
} from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { odcAccessConfig } from '../../config/odc-access';
import { defaultClinicSettings } from '../../config/clinic';
import { moduleDefinitions } from '../../config/modules';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { useSystemControl } from './system-control-context';

const recoverySchema = z.object({
  recoveryPassword: z.string().min(1, 'Recovery password is required.'),
});

const controlSchema = z.object({
  systemEnabled: z.boolean(),
  systemMessage: z.string().min(10),
  enabledModules: z.object({
    dashboard: z.boolean(),
    patient_management: z.boolean(),
    booking_appointments: z.boolean(),
    billing: z.boolean(),
    pos: z.boolean(),
    inventory: z.boolean(),
    laboratory: z.boolean(),
    teleconsult: z.boolean(),
  }),
});

type RecoveryValues = z.infer<typeof recoverySchema>;
type ControlValues = z.infer<typeof controlSchema>;

async function extractAccessKeyFromFile(file: File) {
  const content = (await file.text()).trim();
  if (!content) throw new Error('The selected file is empty.');
  try {
    const parsed = JSON.parse(content) as { accessKey?: string; odcAccessKey?: string };
    const jsonKey = parsed.accessKey ?? parsed.odcAccessKey;
    if (typeof jsonKey === 'string' && jsonKey.trim()) return jsonKey.trim();
  } catch { /* plain text key also supported */ }
  return content;
}

export function OdcPage() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { unlocked, unlock, lock, setSystemState, systemEnabled, systemMessage, enabledModules, updating } = useSystemControl();
  const [unlockingFile, setUnlockingFile] = useState(false);
  const [unlockingPassword, setUnlockingPassword] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');

  const recoveryForm = useForm<RecoveryValues>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { recoveryPassword: '' },
  });

  const controlForm = useForm<ControlValues>({
    resolver: zodResolver(controlSchema),
    values: { systemEnabled, systemMessage, enabledModules },
  });

  const enabledSelection = useWatch({ control: controlForm.control, name: 'systemEnabled' });

  if (!unlocked) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0a1628] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 39px, #fff 39px, #fff 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #fff 39px, #fff 40px)',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-120px', right: '-80px', width: '500px', height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(234,88,12,0.18) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '-100px', left: '-60px', width: '400px', height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600" />

        <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-4 py-16">
          <div className="flex items-center gap-3 mb-10 animate-fade-in">
            <div className="p-3 bg-orange-600/20 border border-orange-500/30">
              <ShieldEllipsis className="size-7 text-orange-400" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.35em] text-orange-400">Odyssey Diagnostic Clinic</p>
              <p className="text-sm font-extrabold text-white tracking-wide">ODC Superadmin Console</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-8 bg-white/5 border border-white/10 px-4 py-2 animate-fade-in">
            <Lock className="size-3.5 text-slate-400" />
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Console Locked</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white text-center tracking-tight leading-tight mb-3 animate-fade-up">
            Emergency Access Panel
          </h1>
          <p className="text-sm text-slate-400 text-center max-w-md leading-relaxed mb-12 animate-fade-up delay-100">
            This console is restricted to authorized administrators only. Authenticate using your ODC config key file or recovery password to proceed.
          </p>

          <div className="grid w-full max-w-3xl gap-4 lg:grid-cols-2 animate-fade-up delay-200">
            <div className="bg-white/5 border border-white/10 overflow-hidden hover:bg-white/[0.07] transition-colors">
              <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2.5">
                <div className="p-2 bg-orange-600/20 border border-orange-500/30">
                  <FileKey2 className="size-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-400">Primary Method</p>
                  <p className="text-sm font-extrabold text-white">Unlock with Config Key File</p>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs text-slate-400 leading-relaxed mb-5">
                  Load the ODC config key file issued to your administrators to access the emergency control console.
                </p>
                <form
                  className="space-y-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const fileInput = event.currentTarget.elements.namedItem('odcKeyFile') as HTMLInputElement | null;
                    const file = fileInput?.files?.[0];
                    if (!file) { toast.error('Select your ODC key file first.'); return; }
                    setUnlockingFile(true);
                    try {
                      const accessKey = await extractAccessKeyFromFile(file);
                      const isValid = await unlock({ accessKey });
                      if (!isValid) { toast.error('The selected ODC key file is invalid.'); return; }
                      toast.success('Superadmin console unlocked.');
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Unable to read the ODC key file.');
                    } finally { setUnlockingFile(false); }
                  }}
                >
                  <label className="flex cursor-pointer items-center gap-3 border border-dashed border-white/20 bg-white/5 px-4 py-4 text-sm text-slate-300 hover:bg-white/10 transition-colors">
                    <FileKey2 className="size-4 text-orange-400 shrink-0" />
                    <span className="truncate text-xs">{selectedFileName || 'Choose .json, .key, or .txt file'}</span>
                    <input
                      accept={odcAccessConfig.acceptedFileExtensions}
                      className="hidden"
                      name="odcKeyFile"
                      type="file"
                      onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name ?? '')}
                    />
                  </label>
                  <p className="text-[11px] text-slate-500">Supported: raw text key, or JSON with `accessKey` field.</p>
                  <Button
                    className="w-full rounded-none bg-orange-600 hover:bg-orange-700 font-extrabold uppercase tracking-widest text-sm py-5 flex items-center justify-center gap-2 transition-colors"
                    disabled={unlockingFile}
                    type="submit"
                  >
                    <Unlock className="size-4" />
                    {unlockingFile ? 'Validating...' : 'Unlock with Key File'}
                  </Button>
                </form>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 overflow-hidden hover:bg-white/[0.07] transition-colors">
              <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2.5">
                <div className="p-2 bg-slate-500/20 border border-slate-400/20">
                  <KeyRound className="size-4 text-slate-300" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Emergency Recovery</p>
                  <p className="text-sm font-extrabold text-white">Unlock with Recovery Password</p>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs text-slate-400 leading-relaxed mb-5">
                  Use the recovery password stored in your database if the key file is unavailable.
                </p>
                <form
                  className="space-y-4"
                  onSubmit={recoveryForm.handleSubmit(async (values) => {
                    setUnlockingPassword(true);
                    try {
                      const isValid = await unlock({ recoveryPassword: values.recoveryPassword });
                      if (!isValid) { toast.error('The recovery password is invalid.'); return; }
                      toast.success('Superadmin console unlocked.');
                      recoveryForm.reset();
                    } finally { setUnlockingPassword(false); }
                  })}
                >
                  <FormField label="Recovery password">
                    <Input
                      className="bg-white/5 border-white/20 text-white placeholder:text-slate-500 focus:border-orange-500"
                      type="password"
                      placeholder="Enter recovery password"
                      {...recoveryForm.register('recoveryPassword')}
                    />
                  </FormField>
                  <Button
                    className="w-full rounded-none bg-white/10 border border-white/20 text-white hover:bg-white/20 font-extrabold uppercase tracking-widest text-sm py-5 flex items-center justify-center gap-2 transition-colors"
                    disabled={unlockingPassword}
                    type="submit"
                  >
                    <KeyRound className="size-4" />
                    {unlockingPassword ? 'Validating...' : 'Unlock with Password'}
                  </Button>
                </form>
              </div>
            </div>
          </div>

          <p className="mt-10 text-[11px] text-slate-600 text-center uppercase tracking-widest">
            Unauthorized access attempts are logged · {clinic.clinicName}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="bg-[#0a1628] border border-slate-700 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600" />
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-600/20 border border-orange-500/30 shrink-0">
                <Terminal className="size-5 text-orange-400" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-orange-400">ODC Superadmin Console · /odc</p>
                <h1 className="text-xl font-extrabold text-white tracking-tight mt-0.5">{clinic.clinicName}</h1>
                <p className="text-xs text-slate-400 mt-0.5">Full emergency control for availability, recovery messaging, service continuity, and licensed modules.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">Console Unlocked</span>
              </div>
              <button
                onClick={() => lock()}
                className="flex items-center gap-2 px-4 py-2 border border-white/20 text-slate-300 hover:bg-white/10 text-xs font-extrabold uppercase tracking-widest transition-colors"
              >
                <Lock className="size-3.5" />
                Lock Console
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className={`px-6 py-4 border-b border-slate-100 flex items-center gap-3 ${systemEnabled ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              {systemEnabled
                ? <ShieldCheck className="size-5 text-emerald-600" />
                : <ShieldAlert className="size-5 text-rose-600" />}
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Live Status</p>
                <p className="text-sm font-extrabold text-slate-950">System Status</p>
              </div>
              <span className={`ml-auto text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 ${systemEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {systemEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${systemEnabled ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse shrink-0`} />
                <p className="text-3xl font-extrabold text-slate-950">{systemEnabled ? 'Online' : 'Offline'}</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                When disabled, every route except <code className="bg-slate-100 px-1 text-[11px]">/odc</code> is blocked and users see the system maintenance message.
              </p>
              <div className="bg-slate-50 border border-slate-200 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Current Maintenance Message</p>
                <p className="text-sm text-slate-700 leading-relaxed italic">{systemMessage}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <div className="p-2 bg-[#0a1628] text-orange-400 shrink-0">
                <ShieldEllipsis className="size-4" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Superadmin</p>
                <p className="text-sm font-extrabold text-slate-950">Emergency Controls</p>
              </div>
            </div>
            <form
              className="px-6 py-6 space-y-5"
              onSubmit={controlForm.handleSubmit(async (values) => {
                await setSystemState(values);
                toast.success('Superadmin controls updated.');
              })}
            >
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">System Toggle</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => controlForm.setValue('systemEnabled', true)}
                    className={`flex items-center gap-2.5 px-4 py-3.5 border text-sm font-extrabold uppercase tracking-wide transition-colors ${enabledSelection ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700'}`}
                  >
                    <Power className="size-4 shrink-0" />
                    Enable System
                  </button>
                  <button
                    type="button"
                    onClick={() => controlForm.setValue('systemEnabled', false)}
                    className={`flex items-center gap-2.5 px-4 py-3.5 border text-sm font-extrabold uppercase tracking-wide transition-colors ${!enabledSelection ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700'}`}
                  >
                    <PowerOff className="size-4 shrink-0" />
                    Disable System
                  </button>
                </div>
              </div>

              <FormField label="System-wide maintenance message">
                <Textarea
                  className="min-h-[100px] resize-none"
                  placeholder="Enter the message users will see during downtime..."
                  {...controlForm.register('systemMessage')}
                />
              </FormField>

              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">Licensed Modules</p>
                  <p className="text-xs leading-relaxed text-slate-500">
                    Turn modules on or off based on the client subscription. Disabled modules are hidden and blocked from direct access.
                  </p>
                </div>
                <div className="grid gap-3">
                  {moduleDefinitions.map((moduleDefinition) => {
                    const fieldName = `enabledModules.${moduleDefinition.key}` as const;
                    const enabled = controlForm.watch(fieldName);

                    return (
                      <button
                        key={moduleDefinition.key}
                        type="button"
                        onClick={() => controlForm.setValue(fieldName, !enabled)}
                        className={`flex items-start justify-between gap-4 border px-4 py-4 text-left transition-colors ${
                          enabled
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-extrabold text-slate-950">{moduleDefinition.label}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">{moduleDefinition.description}</p>
                        </div>
                        <span
                          className={`shrink-0 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${
                            enabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                className="w-full rounded-none bg-[#0a1628] hover:bg-[#172937] text-white font-extrabold uppercase tracking-widest text-sm py-5 flex items-center justify-center gap-2 transition-colors"
                disabled={updating}
                type="submit"
              >
                <Terminal className="size-4" />
                {updating ? 'Applying Changes...' : 'Apply Superadmin Control'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
