import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Globe,
  Mail,
  MapPin,
  Palette,
  Phone,
  X,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { useController, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { queryKeys } from '../../lib/query-keys';
import {
  getClinicSettingsLiveOrDemo,
  updateClinicSettingsLiveOrDemo,
} from '../../lib/supabase-clinic';
import type { ClinicSettings } from '../../types/domain';

// ── Schema ────────────────────────────────────────────────────────────────────

const clinicSchema = z.object({
  clinicName:    z.string().min(2, 'Clinic name must be at least 2 characters'),
  legalName:     z.string().min(2, 'Legal name must be at least 2 characters'),
  shortCode:     z.string().min(2, 'Short code must be at least 2 characters'),
  address:       z.string().min(4, 'Address is required'),
  contactNumber: z.string().min(5, 'Contact number is required'),
  email:         z.email('Enter a valid email address'),
  website:       z.url('Enter a valid URL (include https://)'),
  primaryColor:  z.string().min(4),
  accentColor:   z.string().min(4),
});

type ClinicFormValues = z.infer<typeof clinicSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<keyof ClinicFormValues, string> = {
  clinicName:    'Clinic Name',
  legalName:     'Legal Name',
  shortCode:     'Short Code',
  address:       'Address',
  contactNumber: 'Contact Number',
  email:         'Email',
  website:       'Website',
  primaryColor:  'Primary Color',
  accentColor:   'Accent Color',
};

function detectChanges(
  saved: Partial<ClinicSettings>,
  next: ClinicFormValues,
): Array<{ field: keyof ClinicFormValues; label: string; from: string; to: string }> {
  const keys = Object.keys(FIELD_LABELS) as Array<keyof ClinicFormValues>;
  return keys.flatMap((key) => {
    const from = String(saved[key as keyof ClinicSettings] ?? '');
    const to   = String(next[key]);
    return from !== to ? [{ field: key, label: FIELD_LABELS[key], from, to }] : [];
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Color picker: the native <input type="color"> sits invisibly on top of the
 * swatch so clicking the swatch opens the browser color dialog directly.
 * The hex text field keeps the value in sync for manual entry.
 */
function ColorPicker({
  label,
  name,
  control,
}: {
  label: string;
  name: 'primaryColor' | 'accentColor';
  control: ReturnType<typeof useForm<ClinicFormValues>>['control'];
}) {
  const { field } = useController({ name, control });

  return (
    <FormField label={label}>
      <div className="flex items-center gap-2">
        {/* Swatch — clicking it opens the native color picker */}
        <div
          className="relative size-8 shrink-0 cursor-pointer border border-slate-200 shadow-sm"
          style={{ background: field.value }}
          title="Click to pick a color"
        >
          <input
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            ref={field.ref}
            aria-label={`${label} color picker`}
          />
        </div>
        {/* Hex text input — stays in sync */}
        <Input
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          className="font-mono text-sm"
          placeholder="#ea580c"
        />
      </div>
    </FormField>
  );
}

// ── Confirmation Modal ────────────────────────────────────────────────────────

type Change = { field: keyof ClinicFormValues; label: string; from: string; to: string };

function ConfirmationModal({
  changes,
  onConfirm,
  onCancel,
  saving,
}: {
  changes: Change[];
  onConfirm: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const colorFields = new Set<string>(['primaryColor', 'accentColor']);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
    >
      <div
        className="w-full max-w-lg overflow-hidden border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 bg-orange-600 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-white/25 bg-white/10 p-2 text-white">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">
                Review Changes
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                Confirm Clinic Settings Update
              </p>
            </div>
          </div>
          <button
            aria-label="Cancel"
            className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={onCancel}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-slate-500">
            The following{' '}
            <span className="font-bold text-slate-800">{changes.length}</span>{' '}
            {changes.length === 1 ? 'field' : 'fields'} will be updated system-wide:
          </p>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200">
            {changes.map(({ field, label, from, to }) => (
              <div key={field} className="px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  {colorFields.has(field) && <Palette className="size-3" />}
                  {label}
                </p>
                <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  {/* From */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {colorFields.has(field) && (
                      <div className="size-4 shrink-0 border border-slate-200" style={{ background: from }} />
                    )}
                    <span className="text-xs text-rose-600 line-through truncate font-medium">
                      {from || '(empty)'}
                    </span>
                  </div>
                  <span className="text-slate-400 text-xs font-bold">→</span>
                  {/* To */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {colorFields.has(field) && (
                      <div className="size-4 shrink-0 border border-slate-200" style={{ background: to }} />
                    )}
                    <span className="text-xs text-emerald-700 font-semibold truncate">
                      {to || '(empty)'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400">
            These changes will apply immediately across the entire system — sidebar, portal, print documents, and receipts.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              className="rounded-none font-bold"
              disabled={saving}
              onClick={onCancel}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              className="rounded-none bg-orange-600 hover:bg-orange-700 font-extrabold"
              disabled={saving}
              onClick={onConfirm}
              type="button"
            >
              {saving ? 'Saving…' : 'Confirm & Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Status Modal ──────────────────────────────────────────────────────────────

function StatusModal({
  changes,
  onClose,
}: {
  changes: Change[];
  onClose: () => void;
}) {
  const colorFields = new Set<string>(['primaryColor', 'accentColor']);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-md overflow-hidden border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 bg-emerald-600 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-white/25 bg-white/10 p-2 text-white">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-100">
                Save Successful
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                Clinic Settings Updated
              </p>
            </div>
          </div>
          <button
            aria-label="Close"
            className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{changes.length}</span>{' '}
            {changes.length === 1 ? 'setting was' : 'settings were'} saved and are now live across the system.
          </p>

          <div className="divide-y divide-slate-100 border border-slate-100 bg-slate-50">
            {changes.map(({ field, label, to }) => (
              <div key={field} className="flex items-center gap-3 px-4 py-2.5">
                <Check className="size-3.5 shrink-0 text-emerald-500" />
                <span className="text-xs font-semibold text-slate-500 w-28 shrink-0">{label}</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  {colorFields.has(field) && (
                    <div className="size-3.5 shrink-0 border border-slate-200" style={{ background: to }} />
                  )}
                  <span className="text-xs font-bold text-slate-800 truncate">{to}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              className="rounded-none bg-emerald-600 hover:bg-emerald-700 font-bold"
              onClick={onClose}
              type="button"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SettingsClinicPage() {
  const queryClient = useQueryClient();

  const { data: clinic } = useQuery({
    queryKey: queryKeys.clinicSettings,
    queryFn: getClinicSettingsLiveOrDemo,
  });

  const mutation = useMutation({
    mutationFn: (values: ClinicFormValues) => updateClinicSettingsLiveOrDemo(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clinicSettings });
    },
  });

  const form = useForm<ClinicFormValues>({
    resolver: zodResolver(clinicSchema),
    values: {
      clinicName:    clinic?.clinicName    ?? '',
      legalName:     clinic?.legalName     ?? '',
      shortCode:     clinic?.shortCode     ?? '',
      address:       clinic?.address       ?? '',
      contactNumber: clinic?.contactNumber ?? '',
      email:         clinic?.email         ?? '',
      website:       clinic?.website       ?? '',
      primaryColor:  clinic?.primaryColor  ?? '#ea580c',
      accentColor:   clinic?.accentColor   ?? '#0f766e',
    },
  });

  const watched = useWatch({ control: form.control });

  // Modal state
  const [pendingValues,  setPendingValues]  = useState<ClinicFormValues | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Change[]>([]);
  const [savedChanges,   setSavedChanges]   = useState<Change[]>([]);
  const [showStatus,     setShowStatus]     = useState(false);

  // Preview values
  const previewName      = watched.clinicName    || 'Clinic Name';
  const previewShortCode = watched.shortCode     || 'CODE';
  const previewAddress   = watched.address       || '123 Healthcare Ave';
  const previewPhone     = watched.contactNumber || '+63 XXX XXX XXXX';
  const previewEmail     = watched.email         || 'hello@clinic.test';
  const previewWebsite   = (watched.website || 'https://clinic.test').replace(/^https?:\/\//, '');
  const previewPrimary   = watched.primaryColor  || '#ea580c';
  const previewAccent    = watched.accentColor   || '#0f766e';

  // Step 1: intercept submit → show confirmation
  const onSubmit = form.handleSubmit((values) => {
    const changes = detectChanges(clinic ?? {}, values);
    if (changes.length === 0) return; // nothing changed
    setPendingValues(values);
    setPendingChanges(changes);
  });

  // Step 2: user confirms → actually save
  const handleConfirm = useCallback(async () => {
    if (!pendingValues) return;
    await mutation.mutateAsync(pendingValues);
    setSavedChanges(pendingChanges);
    setPendingValues(null);
    setPendingChanges([]);
    setShowStatus(true);
  }, [mutation, pendingChanges, pendingValues]);

  const handleCancelConfirm = useCallback(() => {
    setPendingValues(null);
    setPendingChanges([]);
  }, []);

  const handleCloseStatus = useCallback(() => {
    setShowStatus(false);
    setSavedChanges([]);
  }, []);

  return (
    <div className="space-y-4 max-w-3xl">

      {/* ── Confirmation Modal ─────────────────────────────── */}
      {pendingValues && pendingChanges.length > 0 && (
        <ConfirmationModal
          changes={pendingChanges}
          onCancel={handleCancelConfirm}
          onConfirm={() => void handleConfirm()}
          saving={mutation.isPending}
        />
      )}

      {/* ── Status Modal ───────────────────────────────────── */}
      {showStatus && savedChanges.length > 0 && (
        <StatusModal
          changes={savedChanges}
          onClose={handleCloseStatus}
        />
      )}

      {/* ── Page header ────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 shadow-sm px-6 py-5 flex items-center gap-3">
        <div className="p-2.5 bg-orange-600 text-white shrink-0">
          <Building2 className="size-5" />
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Settings</p>
          <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">Clinic Profile &amp; Branding</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Changes apply system-wide — sidebar, portals, print documents, and receipts.
          </p>
        </div>
      </div>

      {/* ── Live Branding Preview ──────────────────────────── */}
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Live Preview</p>
          <p className="text-xs text-slate-500 mt-0.5">Updates as you type — click "Save" to persist changes.</p>
        </div>
        <div className="px-6 py-5">
          <div className="flex gap-4 flex-wrap">

            {/* Mini sidebar mockup */}
            <div className="w-52 border border-slate-200 shadow-sm overflow-hidden shrink-0">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="p-1.5 text-white shrink-0" style={{ background: previewPrimary }}>
                  <Building2 className="size-3.5" />
                </div>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-widest" style={{ color: previewPrimary }}>
                    {previewShortCode}
                  </p>
                  <p className="text-[11px] font-extrabold text-slate-950 leading-tight truncate max-w-[9rem]">
                    {previewName}
                  </p>
                </div>
              </div>
              <div className="px-3 py-2 space-y-0.5">
                {['Dashboard', 'Patients', 'Appointments', 'Billing'].map((item, i) => (
                  <div
                    key={item}
                    className="px-2 py-1.5 text-[10px] font-semibold border-l-2"
                    style={i === 0
                      ? { borderColor: previewPrimary, color: previewPrimary, background: `${previewPrimary}18` }
                      : { borderColor: 'transparent', color: '#64748b' }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Contact card preview */}
            <div className="flex-1 min-w-[200px] border border-slate-100 bg-slate-50 p-4 space-y-2">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                Contact preview (footer &amp; chatbot)
              </p>
              <p className="font-extrabold text-slate-950 text-sm">{previewName}</p>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-start gap-1.5">
                  <MapPin className="size-3 shrink-0 mt-0.5" style={{ color: previewPrimary }} />
                  <span>{previewAddress}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="size-3 shrink-0" style={{ color: previewPrimary }} />
                  <span>{previewPhone}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="size-3 shrink-0" style={{ color: previewPrimary }} />
                  <span>{previewEmail}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="size-3 shrink-0" style={{ color: previewPrimary }} />
                  <span>{previewWebsite}</span>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <div className="flex items-center gap-1.5">
                  <div className="size-4 border border-slate-200" style={{ background: previewPrimary }} />
                  <span className="text-[10px] font-mono text-slate-500">{previewPrimary}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-4 border border-slate-200" style={{ background: previewAccent }} />
                  <span className="text-[10px] font-mono text-slate-500">{previewAccent}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form ───────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <form className="divide-y divide-slate-100" onSubmit={onSubmit}>

          {/* Identity */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Identity</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Clinic name" error={form.formState.errors.clinicName?.message}>
                <Input {...form.register('clinicName')} placeholder="e.g. Odyssey Family Clinic" />
              </FormField>
              <FormField label="Legal name" error={form.formState.errors.legalName?.message}>
                <Input {...form.register('legalName')} placeholder="e.g. Odyssey Family Clinic OPC" />
              </FormField>
            </div>
            <FormField label="Short code" hint="Displayed in the sidebar header and used in document reference codes.">
              <Input {...form.register('shortCode')} className="uppercase" placeholder="e.g. ODYSSEY" />
            </FormField>
          </div>

          {/* Contact */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Contact Information</p>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Contact number" error={form.formState.errors.contactNumber?.message}>
                <Input {...form.register('contactNumber')} placeholder="+63 917 555 0134" />
              </FormField>
              <FormField label="Email" error={form.formState.errors.email?.message}>
                <Input {...form.register('email')} type="email" placeholder="hello@clinic.test" />
              </FormField>
              <FormField label="Website" error={form.formState.errors.website?.message}>
                <Input {...form.register('website')} placeholder="https://clinic.test" />
              </FormField>
            </div>
            <FormField label="Address" error={form.formState.errors.address?.message}>
              <Textarea {...form.register('address')} placeholder="123 Healthcare Ave, Makati City" />
            </FormField>
          </div>

          {/* Branding */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Branding Colors</p>
            <p className="text-xs text-slate-400">
              After saving, these colors update sidebar accents, CTA buttons, and links across all pages instantly.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <ColorPicker
                label="Primary color"
                name="primaryColor"
                control={form.control}
              />
              <ColorPicker
                label="Accent color"
                name="accentColor"
                control={form.control}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-slate-50 flex flex-wrap gap-3">
            <Button
              className="rounded-none bg-orange-600 hover:bg-orange-700 font-extrabold uppercase tracking-widest text-sm"
              disabled={mutation.isPending}
              type="submit"
            >
              {mutation.isPending ? 'Saving…' : 'Save Clinic Settings'}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
