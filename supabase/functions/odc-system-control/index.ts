import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const defaultEnabledModules = {
  dashboard: true,
  patient_management: true,
  booking_appointments: true,
  billing: true,
  pos: true,
  inventory: true,
  laboratory: true,
  teleconsult: true,
};

const defaultClinicSettingsInsert = {
  clinic_name: 'Odyssey Family Clinic',
  legal_name: 'Odyssey Family Clinic OPC',
  short_code: 'ODYSSEY',
  address: '125 Rizal Avenue, Makati City, Metro Manila',
  contact_number: '+63 917 555 0134',
  email: 'hello@odysseyclinic.test',
  website: 'https://odysseyclinic.test',
  primary_color: '#155eef',
  accent_color: '#0f766e',
  booking_lead_days: 30,
  booking_cancellation_hours: 12,
  appointment_slot_minutes: 30,
  operating_hours: [
    { day: 'Monday', open: '08:00', close: '18:00', enabled: true },
    { day: 'Tuesday', open: '08:00', close: '18:00', enabled: true },
    { day: 'Wednesday', open: '08:00', close: '18:00', enabled: true },
    { day: 'Thursday', open: '08:00', close: '18:00', enabled: true },
    { day: 'Friday', open: '08:00', close: '18:00', enabled: true },
    { day: 'Saturday', open: '08:00', close: '13:00', enabled: true },
    { day: 'Sunday', open: '00:00', close: '00:00', enabled: false },
  ],
  system_enabled: true,
  system_message: 'Contact your System Administrator to continue using the System',
  enabled_modules: defaultEnabledModules,
};

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return toHex(digest);
}

function normalizeEnabledModules(value: unknown) {
  const raw = value && typeof value === 'object'
    ? value as Partial<Record<keyof typeof defaultEnabledModules, unknown>>
    : {};

  return {
    dashboard: raw.dashboard === false ? false : true,
    patient_management: raw.patient_management === false ? false : true,
    booking_appointments: raw.booking_appointments === false ? false : true,
    billing: raw.billing === false ? false : true,
    pos: raw.pos === false ? false : true,
    inventory: raw.inventory === false ? false : true,
    laboratory: raw.laboratory === false ? false : true,
    teleconsult: raw.teleconsult === false ? false : true,
  };
}

async function getOrCreateClinicSettings(admin: ReturnType<typeof createClient>) {
  const { data: currentSettings, error: settingsError } = await admin
    .from('clinic_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  if (currentSettings?.id) {
    if (!currentSettings.enabled_modules) {
      const { data: patchedSettings, error: patchError } = await admin
        .from('clinic_settings')
        .update({ enabled_modules: defaultEnabledModules })
        .eq('id', currentSettings.id)
        .select('*')
        .single();

      if (patchError) {
        throw new Error(patchError.message);
      }

      return patchedSettings;
    }

    return currentSettings;
  }

  const { data: createdSettings, error: createError } = await admin
    .from('clinic_settings')
    .insert(defaultClinicSettingsInsert)
    .select('*')
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return createdSettings;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const odcAccessKey = Deno.env.get('ODC_ACCESS_KEY');

    if (!supabaseUrl || !serviceRoleKey || !odcAccessKey) {
      return Response.json(
        { error: 'Missing required Edge Function environment variables.' },
        { status: 500, headers: corsHeaders },
      );
    }

    const body = await request.json().catch(() => ({}));
    const accessKey = typeof body.accessKey === 'string' ? body.accessKey.trim() : '';
    const recoveryPassword = typeof body.recoveryPassword === 'string' ? body.recoveryPassword.trim() : '';

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const currentSettings = await getOrCreateClinicSettings(admin);

    const accessKeyValid = Boolean(accessKey) && accessKey === odcAccessKey;
    const recoveryPasswordValid = Boolean(recoveryPassword) && Boolean(currentSettings.odc_recovery_password_hash)
      && (await sha256(recoveryPassword)) === currentSettings.odc_recovery_password_hash;

    if (!accessKeyValid && !recoveryPasswordValid) {
      return Response.json(
        { valid: false, error: 'Invalid ODC credential.' },
        { status: 401, headers: corsHeaders },
      );
    }

    if (body.mode === 'verify') {
      return Response.json(
        {
          valid: true,
          clinicSettings: {
            ...currentSettings,
            enabled_modules: normalizeEnabledModules(currentSettings.enabled_modules),
          },
        },
        { headers: corsHeaders },
      );
    }

    if (body.mode !== 'update') {
      return Response.json({ error: 'Unsupported mode.' }, { status: 400, headers: corsHeaders });
    }

    if (typeof body.systemEnabled !== 'boolean' || typeof body.systemMessage !== 'string' || !body.systemMessage.trim()) {
      return Response.json({ error: 'Invalid system control payload.' }, { status: 400, headers: corsHeaders });
    }

    const enabledModules = normalizeEnabledModules(body.enabledModules);

    const { data: updatedSettings, error: updateError } = await admin
      .from('clinic_settings')
      .update({
        system_enabled: body.systemEnabled,
        system_message: body.systemMessage.trim(),
        enabled_modules: enabledModules,
      })
      .eq('id', currentSettings.id)
      .select('*')
      .single();

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500, headers: corsHeaders });
    }

    return Response.json(
      {
        clinicSettings: {
          ...updatedSettings,
          enabled_modules: normalizeEnabledModules(updatedSettings.enabled_modules),
        },
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unexpected ODC system control error.' },
      { status: 500, headers: corsHeaders },
    );
  }
});
