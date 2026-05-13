import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ClaimPayload {
  uniqueLoginId?: string;
  email?: string;
  password?: string;
  phone?: string;
  address?: string;
  allergies?: string;
  medicalHistory?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

function isStrongPassword(value: string) {
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value)
  );
}

function normalizePayload(raw: ClaimPayload) {
  const uniqueLoginId = (raw.uniqueLoginId ?? "").trim().toUpperCase();
  const email = (raw.email ?? "").trim().toLowerCase();
  const password = (raw.password ?? "").trim();

  if (!uniqueLoginId) {
    throw new Error("Unique ID is required.");
  }

  if (!email || !email.includes("@")) {
    throw new Error("A valid email address is required.");
  }

  if (!isStrongPassword(password)) {
    throw new Error(
      "Password must be at least 8 characters with uppercase, lowercase, and a number.",
    );
  }

  return {
    uniqueLoginId,
    email,
    password,
    phone: (raw.phone ?? "").trim(),
    address: (raw.address ?? "").trim(),
    allergies: (raw.allergies ?? "").trim(),
    medicalHistory: (raw.medicalHistory ?? "").trim(),
    emergencyContactName: (raw.emergencyContactName ?? "").trim(),
    emergencyContactPhone: (raw.emergencyContactPhone ?? "").trim(),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405, headers: corsHeaders },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { error: "Missing required Edge Function environment variables." },
        { status: 500, headers: corsHeaders },
      );
    }

    const payload = normalizePayload(
      (await request.json().catch(() => ({}))) as ClaimPayload,
    );
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: patient, error: patientError } = await admin
      .from("patients")
      .select(
        "id, user_id, first_name, last_name, sex, birth_date, mobile_number, address, allergies, medical_history, emergency_contact_name, emergency_contact_phone",
      )
      .eq("unique_login_id", payload.uniqueLoginId)
      .eq("intake_source", "staff_walk_in")
      .is("deleted_at", null)
      .maybeSingle();

    if (patientError) {
      throw new Error(patientError.message);
    }

    if (!patient) {
      throw new Error("Unique ID was not found. Please check and try again.");
    }

    if (patient.user_id) {
      throw new Error(
        "This Unique ID already has an account. Please sign in using your email and password.",
      );
    }

    const fullName = `${patient.first_name} ${patient.last_name}`.trim();
    const metadata = {
      role: "patient",
      full_name: fullName,
      first_name: patient.first_name,
      last_name: patient.last_name,
      phone: payload.phone || patient.mobile_number || "",
      birth_date: patient.birth_date,
      sex: patient.sex ?? "other",
      address: payload.address || patient.address || "",
      allergies: payload.allergies || patient.allergies || "",
      medical_history: payload.medicalHistory || patient.medical_history || "",
      emergency_contact_name:
        payload.emergencyContactName ||
        patient.emergency_contact_name ||
        fullName,
      emergency_contact_phone:
        payload.emergencyContactPhone ||
        patient.emergency_contact_phone ||
        payload.phone ||
        patient.mobile_number ||
        "",
      walk_in_unique_login_id: payload.uniqueLoginId,
    };

    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: metadata,
      });

    if (createUserError || !createdUser.user) {
      throw new Error(createUserError?.message ?? "Unable to create account.");
    }

    const userId = createdUser.user.id;

    try {
      const { data: linkedPatient, error: linkedPatientError } = await admin
        .from("patients")
        .select("id, user_id")
        .eq("id", patient.id)
        .maybeSingle();

      if (linkedPatientError) {
        throw new Error(linkedPatientError.message);
      }

      if (!linkedPatient || linkedPatient.user_id !== userId) {
        const { error: fallbackLinkError } = await admin
          .from("patients")
          .update({
            user_id: userId,
            email: payload.email,
            mobile_number: payload.phone || patient.mobile_number || null,
            address: payload.address || patient.address || null,
            allergies: payload.allergies || patient.allergies || "",
            medical_history:
              payload.medicalHistory || patient.medical_history || "",
            emergency_contact_name:
              payload.emergencyContactName ||
              patient.emergency_contact_name ||
              fullName,
            emergency_contact_phone:
              payload.emergencyContactPhone ||
              patient.emergency_contact_phone ||
              payload.phone ||
              patient.mobile_number ||
              null,
            walk_in_account_claimed_at: new Date().toISOString(),
          } as never)
          .eq("id", patient.id)
          .is("user_id", null);

        if (fallbackLinkError) {
          throw new Error(fallbackLinkError.message);
        }
      }

      const { error: profileError } = await admin.from("profiles").upsert(
        {
          id: userId,
          email: payload.email,
          full_name: fullName,
          role: "patient",
          phone: payload.phone || patient.mobile_number || null,
          first_name: patient.first_name,
          last_name: patient.last_name,
          is_active: true,
        },
        { onConflict: "id" },
      );

      if (profileError) {
        throw new Error(profileError.message);
      }

      return Response.json(
        {
          success: true,
          user: {
            id: userId,
            email: payload.email,
            fullName,
          },
        },
        { headers: corsHeaders },
      );
    } catch (error) {
      await admin.auth.admin.deleteUser(userId);
      throw error;
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to claim walk-in account.",
      },
      { status: 500, headers: corsHeaders },
    );
  }
});
