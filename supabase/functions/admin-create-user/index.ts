import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PASSWORD_RULES_MESSAGE =
  'Password must be at least 6 characters and include uppercase, lowercase, and a number.';
const ALLOWED_ROLES = new Set([
  'owner_admin',
  'doctor',
  'specialist',
  'nurse_staff',
  'front_desk_cashier',
  'lab_staff',
  'inventory_staff',
]);
const ALLOWED_PRC_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_PRC_FILE_BYTES = 5 * 1024 * 1024;
const STAFF_DOCUMENT_BUCKET = 'staff-documents';

interface PrcIdFileInput {
  name: string;
  type: string;
  dataUrl: string;
}

interface CreateUserPayload {
  firstName?: string;
  lastName?: string;
  contactNumber?: string;
  email?: string;
  password?: string;
  role?: string;
  prcLicenseNumber?: string;
  prcLicenseExpiry?: string;
  birNumber?: string;
  ptrNumber?: string;
  prcIdFile?: PrcIdFileInput;
  consultationFee?: number;
  followUpFee?: number;
}

function isStrongPassword(value: string) {
  return value.length >= 6 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

function getFileExtension(file: PrcIdFileInput) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'pdf';
  if (lowerName.endsWith('.png')) return 'png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'jpg';
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  return 'jpg';
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid PRC ID upload format.');
  }

  const [, mimeType, base64] = match;
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return { mimeType, bytes };
}

async function ensureRequesterIsOwnerAdmin(request: Request, supabaseUrl: string, anonKey: string) {
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    throw new Error('Missing authorization header.');
  }

  const requester = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authorization },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await requester.auth.getUser();

  if (userError || !user) {
    throw new Error('Unable to verify the requesting user.');
  }

  const { data: profile, error: profileError } = await requester
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (profile.role !== 'owner_admin') {
    throw new Error('Only owner/admin accounts can create staff users.');
  }

  return user.id;
}

function validatePayload(body: CreateUserPayload) {
  const firstName = body.firstName?.trim() ?? '';
  const lastName = body.lastName?.trim() ?? '';
  const contactNumber = body.contactNumber?.trim() ?? '';
  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password?.trim() ?? '';
  const role = body.role?.trim() ?? '';

  if (!firstName || !lastName || !contactNumber || !email || !password || !role) {
    throw new Error('First name, last name, contact number, email, password, and role are required.');
  }

  if (!ALLOWED_ROLES.has(role)) {
    throw new Error('Unsupported role.');
  }

  if (!isStrongPassword(password)) {
    throw new Error(PASSWORD_RULES_MESSAGE);
  }

  if (role === 'doctor' || role === 'specialist') {
    if (!body.prcLicenseNumber?.trim() || !body.prcLicenseExpiry?.trim() || !body.birNumber?.trim() || !body.ptrNumber?.trim() || !body.prcIdFile) {
      throw new Error('Doctor and specialist accounts require PRC license number, PRC license expiry, BIR number, PTR number, and PRC ID upload.');
    }
  }

  return {
    firstName,
    lastName,
    contactNumber,
    email,
    password,
    role,
    prcLicenseNumber: body.prcLicenseNumber?.trim() ?? '',
    prcLicenseExpiry: body.prcLicenseExpiry?.trim() ?? '',
    birNumber: body.birNumber?.trim() ?? '',
    ptrNumber: body.ptrNumber?.trim() ?? '',
    prcIdFile: body.prcIdFile ?? null,
    consultationFee: typeof body.consultationFee === 'number' ? body.consultationFee : 0,
    followUpFee: typeof body.followUpFee === 'number' ? body.followUpFee : 0,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('admin-create-user invoked', {
      method: request.method,
      hasAuthorizationHeader: Boolean(request.headers.get('Authorization')),
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return Response.json(
        { error: 'Missing required Edge Function environment variables.' },
        { status: 500, headers: corsHeaders },
      );
    }

    await ensureRequesterIsOwnerAdmin(request, supabaseUrl, anonKey);

    const payload = validatePayload((await request.json().catch(() => ({}))) as CreateUserPayload);
    const admin = createClient(supabaseUrl, serviceRoleKey);

    let uploadedPrcIdPath: string | null = null;
    if ((payload.role === 'doctor' || payload.role === 'specialist') && payload.prcIdFile) {
      const { mimeType, bytes } = decodeDataUrl(payload.prcIdFile.dataUrl);

      if (!ALLOWED_PRC_MIME_TYPES.has(mimeType) || !ALLOWED_PRC_MIME_TYPES.has(payload.prcIdFile.type)) {
        throw new Error('PRC ID upload must be a PNG, JPG, or PDF file.');
      }

      if (bytes.byteLength > MAX_PRC_FILE_BYTES) {
        throw new Error('PRC ID upload must be 5MB or smaller.');
      }

      const { data: buckets, error: bucketsError } = await admin.storage.listBuckets();
      if (bucketsError) {
        throw new Error(bucketsError.message);
      }

      if (!buckets.some((bucket) => bucket.name === STAFF_DOCUMENT_BUCKET || bucket.id === STAFF_DOCUMENT_BUCKET)) {
        const { error: createBucketError } = await admin.storage.createBucket(STAFF_DOCUMENT_BUCKET, {
          public: false,
          fileSizeLimit: `${MAX_PRC_FILE_BYTES}`,
          allowedMimeTypes: [...ALLOWED_PRC_MIME_TYPES],
        });
        if (createBucketError && !createBucketError.message.toLowerCase().includes('already exists')) {
          throw new Error(createBucketError.message);
        }
      }

      uploadedPrcIdPath = `pending/${crypto.randomUUID()}-${sanitizeFileName(payload.prcIdFile.name) || `prc-id.${getFileExtension(payload.prcIdFile)}`}`;
      const { error: uploadError } = await admin.storage
        .from(STAFF_DOCUMENT_BUCKET)
        .upload(uploadedPrcIdPath, bytes, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }
    }

    let createdUserId: string | null = null;
    let storedPrcIdPath = uploadedPrcIdPath;

    try {
      const fullName = `${payload.firstName} ${payload.lastName}`.trim();
      const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: {
          role: payload.role,
          full_name: fullName,
          phone: payload.contactNumber,
          first_name: payload.firstName,
          last_name: payload.lastName,
        },
      });

      if (createUserError || !createdUser.user) {
        throw new Error(createUserError?.message ?? 'Unable to create auth user.');
      }

      createdUserId = createdUser.user.id;

      const { error: profileError } = await admin.from('profiles').upsert(
        {
          id: createdUser.user.id,
          email: payload.email,
          full_name: fullName,
          phone: payload.contactNumber,
          role: payload.role,
          title: null,
          is_active: true,
        },
        { onConflict: 'id' },
      );

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (payload.role === 'doctor' || payload.role === 'specialist') {
        const finalPrcIdPath = uploadedPrcIdPath
          ? `doctors/${createdUser.user.id}/prc-id.${getFileExtension(payload.prcIdFile!)}`
          : null;

        if (uploadedPrcIdPath && finalPrcIdPath) {
          const { error: moveError } = await admin.storage.from(STAFF_DOCUMENT_BUCKET).move(uploadedPrcIdPath, finalPrcIdPath);
          if (moveError) {
            throw new Error(moveError.message);
          }
          storedPrcIdPath = finalPrcIdPath;
        }

        const { error: doctorError } = await admin.from('doctors').upsert(
          {
            profile_id: createdUser.user.id,
            license_number: payload.prcLicenseNumber,
            license_expiry: payload.prcLicenseExpiry,
            bir_number: payload.birNumber,
            ptr_number: payload.ptrNumber,
            prc_id_path: finalPrcIdPath,
            consultation_fee: payload.consultationFee,
            follow_up_fee: payload.followUpFee,
          },
          { onConflict: 'profile_id' },
        );

        if (doctorError) {
          throw new Error(doctorError.message);
        }
      }

      return Response.json(
        {
          user: {
            id: createdUser.user.id,
            email: payload.email,
            fullName,
            role: payload.role,
            phone: payload.contactNumber,
          },
        },
        { headers: corsHeaders },
      );
    } catch (error) {
      if (createdUserId) {
        await admin.auth.admin.deleteUser(createdUserId);
      }

      if (storedPrcIdPath) {
        await admin.storage.from(STAFF_DOCUMENT_BUCKET).remove([storedPrcIdPath]);
      }

      throw error;
    }
  } catch (error) {
    console.error('admin-create-user failed', error instanceof Error ? error.message : error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unexpected staff provisioning error.' },
      { status: 500, headers: corsHeaders },
    );
  }
});
