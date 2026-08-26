import { zodResolver } from '@hookform/resolvers/zod';
import {
  Building2,
  Check,
  FileKey2,
  KeyRound,
  Lock,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldEllipsis,
  Terminal,
  Unlock,
  Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useAuth } from '../auth/auth-context';
import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { odcAccessConfig } from '../../config/odc-access';
import { queryClient } from '../../app/query-client';
import { queryKeys } from '../../lib/query-keys';
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
  systemStatusType: z.enum(['maintenance', 'restricted']),
  enabledModules: z.object({
    dashboard: z.boolean(),
    patient_management: z.boolean(),
    booking_appointments: z.boolean(),
    billing: z.boolean(),
    pos: z.boolean(),
    inventory: z.boolean(),
    laboratory: z.boolean(),
    teleconsult: z.boolean(),
    hmo: z.boolean(),
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
  const { profile } = useAuth();
  const isUserSuperadmin = profile?.isSuperadmin === true;

  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { unlocked, unlock, lock, setSystemState, systemEnabled, systemMessage, systemStatusType, enabledModules, updating } = useSystemControl();
  const [unlockingFile, setUnlockingFile] = useState(false);
  const [unlockingPassword, setUnlockingPassword] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');

  const recoveryForm = useForm<RecoveryValues>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { recoveryPassword: '' },
  });

  const controlForm = useForm<ControlValues>({
    resolver: zodResolver(controlSchema),
    values: { 
      systemEnabled, 
      systemMessage, 
      systemStatusType: systemStatusType as 'maintenance' | 'restricted', 
      enabledModules 
    },
  });

  const enabledSelection = useWatch({ control: controlForm.control, name: 'systemEnabled' });

  // Tab State
  const [activeTab, setActiveTab] = useState<'controls' | 'branding' | 'admins'>('controls');
  const [adminProfiles, setAdminProfiles] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Admin Account Creation States
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'owner_admin' | 'doctor' | 'nurse_staff' | 'front_desk_cashier' | 'lab_staff' | 'inventory_staff'>('owner_admin');
  const [newAdminIsSuper, setNewAdminIsSuper] = useState(false);

  // Onboarding Form States
  const [onboardName, setOnboardName] = useState('');
  const [onboardLegal, setOnboardLegal] = useState('');
  const [onboardShortCode, setOnboardShortCode] = useState('');
  const [onboardDomain, setOnboardDomain] = useState('');
  const [onboardPrimaryColor, setOnboardPrimaryColor] = useState('#155eef');
  const [onboardAccentColor, setOnboardAccentColor] = useState('#0f766e');
  const [onboardLogoUrl, setOnboardLogoUrl] = useState('');
  const [onboardAddress, setOnboardAddress] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('');
  const [onboardEmail, setOnboardEmail] = useState('');
  const [onboardWebsite, setOnboardWebsite] = useState('');
  const [onboarding, setOnboarding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function loadAdminProfiles() {
    const { supabase } = await import('../../lib/supabase');
    if (!supabase) return;
    setLoadingAdmins(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'patient')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAdminProfiles(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAdmins(false);
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminEmail.trim() || !newAdminPassword.trim()) {
      toast.error('Name, email, and password are required');
      return;
    }
    setCreatingAdmin(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase environment variables are missing.');
      }

      // Create a temporary client that does not persist session so it doesn't log out the current superadmin
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        }
      });

      // Sign up the new user
      const { data, error: signUpError } = await tempClient.auth.signUp({
        email: newAdminEmail.trim(),
        password: newAdminPassword,
        options: {
          data: {
            role: newAdminRole,
            full_name: newAdminName.trim(),
            phone: newAdminPhone.trim(),
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('Failed to create account.');

      // 2. If superadmin checkbox is checked, update is_superadmin in profiles
      if (newAdminIsSuper) {
        const { supabase } = await import('../../lib/supabase');
        if (!supabase) throw new Error('Supabase client is not initialized.');
        
        // Wait a tiny bit for the database trigger to finish creating the profile row
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        const { error } = await (supabase.from('profiles') as any)
          .update({ is_superadmin: true })
          .eq('id', data.user.id);
        if (error) throw error;
      }

      toast.success('Admin account created successfully.');
      
      // Reset form
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminPhone('');
      setNewAdminRole('owner_admin');
      setNewAdminIsSuper(false);

      // Refresh list
      loadAdminProfiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create admin account');
    } finally {
      setCreatingAdmin(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      if (!supabase) throw new Error('Supabase client is not initialized.');
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `logos/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('clinic-logos')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('clinic-logos')
        .getPublicUrl(filePath);
        
      setOnboardLogoUrl(publicUrl);
      toast.success('Logo uploaded successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
    }
  }


  // Sync clinic settings data with form states
  useEffect(() => {
    if (clinic) {
      setOnboardName(clinic.clinicName || '');
      setOnboardLegal(clinic.legalName || '');
      setOnboardShortCode(clinic.shortCode || '');
      setOnboardDomain(clinic.domain || '');
      setOnboardPrimaryColor(clinic.primaryColor || '#155eef');
      setOnboardAccentColor(clinic.accentColor || '#0f766e');
      setOnboardLogoUrl(clinic.logoUrl || '');
      setOnboardAddress(clinic.address || '');
      setOnboardPhone(clinic.contactNumber || '');
      setOnboardEmail(clinic.email || '');
      setOnboardWebsite(clinic.website || '');
    }
  }, [clinic]);

  useEffect(() => {
    if (unlocked && activeTab === 'admins') {
      loadAdminProfiles();
    }
  }, [unlocked, activeTab]);

  async function handleUpdateBranding(e: React.FormEvent) {
    e.preventDefault();
    if (!onboardName.trim()) {
      toast.error('Clinic name is required');
      return;
    }
    if (!onboardShortCode.trim()) {
      toast.error('Short code is required');
      return;
    }
    setOnboarding(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      if (!supabase) {
        throw new Error('Supabase client is not initialized.');
      }
      
      // 1. Update clinic_settings row
      const { error: settingsError } = await (supabase.from('clinic_settings') as any)
        .update({
          clinic_name: onboardName.trim(),
          legal_name: onboardLegal.trim() || onboardName.trim(),
          short_code: onboardShortCode.trim().toUpperCase(),
          domain: onboardDomain.trim() || null,
          logo_url: onboardLogoUrl.trim() || null,
          primary_color: onboardPrimaryColor,
          accent_color: onboardAccentColor,
          address: onboardAddress.trim(),
          contact_number: onboardPhone.trim(),
          email: onboardEmail.trim(),
          website: onboardWebsite.trim(),
        })
        .eq('id', clinic.id);
        
      if (settingsError) throw settingsError;
      
      // 2. Update clinics row if clinicId is present
      if (clinic.clinicId) {
        await (supabase.from('clinics') as any)
          .update({ name: onboardName.trim() })
          .eq('id', clinic.clinicId);
      }
      
      toast.success('Branding and settings updated successfully.');
      
      // Invalidate queries
      void queryClient.invalidateQueries({ queryKey: queryKeys.clinicSettings });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setOnboarding(false);
    }
  }

  if (!unlocked && !isUserSuperadmin) {
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

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('controls')}
            className={`border-b-2 px-6 py-4 text-xs font-extrabold uppercase tracking-wider transition-colors ${
              activeTab === 'controls' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Emergency Controls
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`border-b-2 px-6 py-4 text-xs font-extrabold uppercase tracking-wider transition-colors ${
              activeTab === 'branding' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            White Label Branding
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admins')}
            className={`border-b-2 px-6 py-4 text-xs font-extrabold uppercase tracking-wider transition-colors ${
              activeTab === 'admins' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            System Admins
          </button>
        </div>

        {activeTab === 'controls' ? (
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

                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Display Mode</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => controlForm.setValue('systemStatusType', 'maintenance')}
                      className={`flex items-center gap-2.5 px-4 py-3.5 border text-sm font-extrabold uppercase tracking-wide transition-colors ${controlForm.watch('systemStatusType') === 'maintenance' ? 'bg-orange-600 border-orange-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700'}`}
                    >
                      <Wrench className="size-4 shrink-0" />
                      Maintenance Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => controlForm.setValue('systemStatusType', 'restricted')}
                      className={`flex items-center gap-2.5 px-4 py-3.5 border text-sm font-extrabold uppercase tracking-wide transition-colors ${controlForm.watch('systemStatusType') === 'restricted' ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700'}`}
                    >
                      <ShieldAlert className="size-4 shrink-0" />
                      Restricted Access
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500 italic">
                    {controlForm.watch('systemStatusType') === 'maintenance' 
                      ? 'Shows "Scheduled Maintenance" with a wrench icon.' 
                      : 'Shows "Access Restricted" with a warning icon.'}
                  </p>
                </div>

                <FormField label="System-wide message">
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
        ) : activeTab === 'branding' ? (
          <div className="max-w-4xl mx-auto py-6">
            {/* Branding Settings Form */}
            <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <div className="p-2 bg-[#0a1628] text-orange-400 shrink-0">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">System White Labeling</p>
                  <p className="text-sm font-extrabold text-slate-950">Manage Clinic Branding & Identity Settings</p>
                </div>
              </div>
              <form onSubmit={handleUpdateBranding} className="px-6 py-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Clinic Name *">
                    <Input
                      value={onboardName}
                      onChange={(e) => setOnboardName(e.target.value)}
                      placeholder="e.g. Odyssey Family Clinic"
                    />
                  </FormField>
                  <FormField label="Legal Name">
                    <Input
                      value={onboardLegal}
                      onChange={(e) => setOnboardLegal(e.target.value)}
                      placeholder="e.g. Odyssey Family Clinic OPC"
                    />
                  </FormField>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Short Code *" hint="Uppercase initials used for invoice codes (max 8 characters)">
                    <Input
                      value={onboardShortCode}
                      onChange={(e) => setOnboardShortCode(e.target.value.toUpperCase())}
                      placeholder="e.g. ODYSSEY"
                      maxLength={8}
                    />
                  </FormField>
                  <FormField label="Custom Domain" hint="Domain name pointing to this clinic instance">
                    <Input
                      value={onboardDomain}
                      onChange={(e) => setOnboardDomain(e.target.value.toLowerCase())}
                      placeholder="e.g. clinic.yourplatform.com"
                    />
                  </FormField>
                </div>
                <FormField label="Clinic Logo" hint="Select an image file (PNG, JPG, or SVG) to upload as the clinic's logo.">
                  <div className="flex items-center gap-4 border border-slate-200 p-3 bg-slate-50">
                    {onboardLogoUrl ? (
                      <div className="relative size-16 bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0">
                        <img src={onboardLogoUrl} className="max-h-full max-w-full object-contain" alt="uploaded logo" />
                        <button
                          type="button"
                          onClick={() => setOnboardLogoUrl('')}
                          className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full size-4 flex items-center justify-center text-[9px] hover:bg-rose-700"
                          title="Remove logo"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="size-16 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs font-semibold shrink-0 bg-white">
                        No Logo
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <input
                        type="file"
                        id="onboardLogoFileInput"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="onboardLogoFileInput"
                        className={`inline-flex items-center justify-center px-4 py-2 border border-slate-300 bg-white text-xs font-extrabold uppercase tracking-wider text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        {uploadingLogo ? 'Uploading...' : 'Choose File / Upload'}
                      </label>
                      {onboardLogoUrl && (
                        <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{onboardLogoUrl}</p>
                      )}
                    </div>
                  </div>
                </FormField>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Primary Branding Color">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={onboardPrimaryColor}
                        onChange={(e) => setOnboardPrimaryColor(e.target.value)}
                        className="size-8 cursor-pointer border border-slate-200"
                      />
                      <Input
                        value={onboardPrimaryColor}
                        onChange={(e) => setOnboardPrimaryColor(e.target.value)}
                        className="font-mono text-sm uppercase"
                      />
                    </div>
                  </FormField>
                  <FormField label="Accent Branding Color">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={onboardAccentColor}
                        onChange={(e) => setOnboardAccentColor(e.target.value)}
                        className="size-8 cursor-pointer border border-slate-200"
                      />
                      <Input
                        value={onboardAccentColor}
                        onChange={(e) => setOnboardAccentColor(e.target.value)}
                        className="font-mono text-sm uppercase"
                      />
                    </div>
                  </FormField>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Optional Contact Info</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField label="Phone">
                      <Input value={onboardPhone} onChange={(e) => setOnboardPhone(e.target.value)} placeholder="+63 917 123 4567" />
                    </FormField>
                    <FormField label="Email">
                      <Input value={onboardEmail} onChange={(e) => setOnboardEmail(e.target.value)} type="email" placeholder="contact@clinic.com" />
                    </FormField>
                    <FormField label="Website">
                      <Input value={onboardWebsite} onChange={(e) => setOnboardWebsite(e.target.value)} placeholder="https://clinic.com" />
                    </FormField>
                  </div>
                  <div className="mt-4">
                    <FormField label="Address">
                      <Textarea value={onboardAddress} onChange={(e) => setOnboardAddress(e.target.value)} placeholder="Enter clinic physical address" />
                    </FormField>
                  </div>
                </div>

                <Button
                  className="w-full rounded-none bg-orange-600 hover:bg-orange-700 text-white font-extrabold uppercase tracking-widest text-sm py-5 flex items-center justify-center gap-2 transition-colors"
                  disabled={onboarding}
                  type="submit"
                >
                  <Check className="size-4" />
                  {onboarding ? 'Saving Changes...' : 'Save Branding Settings'}
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] py-6">
            {/* Create Admin Form */}
            <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <div className="p-2 bg-[#0a1628] text-orange-400 shrink-0">
                  <Plus className="size-4" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Security & Roles</p>
                  <p className="text-sm font-extrabold text-slate-950">Create Admin Account</p>
                </div>
              </div>
              <form onSubmit={handleCreateAdmin} className="px-6 py-6 space-y-4">
                <FormField label="Full Name *">
                  <Input
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="e.g. John Doe"
                    required
                  />
                </FormField>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Email Address *">
                    <Input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="e.g. admin@clinic.com"
                      required
                    />
                  </FormField>
                  <FormField label="Password *">
                    <Input
                      type="password"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                    />
                  </FormField>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Contact Number">
                    <Input
                      value={newAdminPhone}
                      onChange={(e) => setNewAdminPhone(e.target.value)}
                      placeholder="e.g. +63 917 555 0123"
                    />
                  </FormField>
                  <FormField label="System Role *">
                    <select
                      value={newAdminRole}
                      onChange={(e) => setNewAdminRole(e.target.value as any)}
                      className="w-full border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
                    >
                      <option value="owner_admin">Owner Admin</option>
                      <option value="doctor">Doctor</option>
                      <option value="nurse_staff">Nurse Staff</option>
                      <option value="front_desk_cashier">Front Desk Cashier</option>
                      <option value="lab_staff">Lab Staff</option>
                      <option value="inventory_staff">Inventory Staff</option>
                    </select>
                  </FormField>
                </div>
                
                <div className="border-t border-slate-100 pt-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAdminIsSuper}
                      onChange={(e) => setNewAdminIsSuper(e.target.checked)}
                      className="mt-1 size-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Grant System Superadmin Access</span>
                      <span className="text-[10px] text-slate-500 block">Allows this user to access this `/odc` superadmin console and change branding/white-label settings.</span>
                    </div>
                  </label>
                </div>

                <Button
                  className="w-full rounded-none bg-orange-600 hover:bg-orange-700 text-white font-extrabold uppercase tracking-widest text-sm py-5 flex items-center justify-center gap-2 transition-colors mt-2"
                  disabled={creatingAdmin}
                  type="submit"
                >
                  <Plus className="size-4" />
                  {creatingAdmin ? 'Creating Account...' : 'Create Admin Account'}
                </Button>
              </form>
            </div>

            {/* List of Existing Admins */}
            <div className="bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#0a1628] text-orange-400 shrink-0">
                    <Building2 className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Registry</p>
                    <p className="text-sm font-extrabold text-slate-950">System Administrators</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={loadAdminProfiles}
                  disabled={loadingAdmins}
                  className="p-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  title="Refresh list"
                >
                  <RefreshCw className={`size-4 ${loadingAdmins ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[600px]">
                {loadingAdmins && adminProfiles.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-slate-500">Loading administrator accounts...</div>
                ) : adminProfiles.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-slate-500">No administrator accounts found.</div>
                ) : (
                  adminProfiles.map((item) => (
                    <div key={item.id} className="p-5 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-slate-900">{item.full_name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{item.email}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-orange-100 text-orange-800 rounded">
                            {item.role}
                          </span>
                          {item.is_superadmin && (
                            <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 rounded">
                              Superadmin
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                        <span>ID: {item.id}</span>
                        {item.phone && <span>Phone: {item.phone}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
