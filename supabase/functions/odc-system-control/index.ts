import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { data: currentSettings, error: settingsError } = await admin
      .from('clinic_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      return Response.json({ error: settingsError.message }, { status: 500, headers: corsHeaders });
    }

    if (!currentSettings?.id) {
      return Response.json({ error: 'Clinic settings record not found.' }, { status: 404, headers: corsHeaders });
    }

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
      return Response.json({ valid: true }, { headers: corsHeaders });
    }

    if (body.mode !== 'update') {
      return Response.json({ error: 'Unsupported mode.' }, { status: 400, headers: corsHeaders });
    }

    if (typeof body.systemEnabled !== 'boolean' || typeof body.systemMessage !== 'string' || !body.systemMessage.trim()) {
      return Response.json({ error: 'Invalid system control payload.' }, { status: 400, headers: corsHeaders });
    }

    const { data: updatedSettings, error: updateError } = await admin
      .from('clinic_settings')
      .update({
        system_enabled: body.systemEnabled,
        system_message: body.systemMessage.trim(),
      })
      .eq('id', currentSettings.id)
      .select('*')
      .single();

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500, headers: corsHeaders });
    }

    return Response.json({ clinicSettings: updatedSettings }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unexpected ODC system control error.' },
      { status: 500, headers: corsHeaders },
    );
  }
});
