/**
 * HMO Management — Supabase Service Layer
 *
 * CRUD operations for all HMO tables. Follows the same pattern as
 * supabase-clinic.ts: live Supabase when configured, otherwise throws.
 */
import { supabase } from "../../../lib/supabase";
import type {
  HmoProvider,
  PatientHmoAccount,
  HmoAuthorization,
  HmoClaim,
  HmoClaimItem,
  HmoPayment,
  HmoApprovalStatus,
  HmoClaimStatus,
} from "../../../types/domain";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function mapApprovalStatus(v: string | null | undefined): HmoApprovalStatus {
  switch (v) {
    case "pending":
    case "approved":
    case "denied":
    case "expired":
      return v;
    default:
      return "pending";
  }
}

function mapClaimStatus(v: string | null | undefined): HmoClaimStatus {
  switch (v) {
    case "draft":
    case "pending_submission":
    case "submitted":
    case "processing":
    case "paid":
    case "denied":
    case "partial_payment":
    case "overdue":
      return v;
    default:
      return "draft";
  }
}

// ---------------------------------------------------------------------------
// HMO Providers
// ---------------------------------------------------------------------------

export async function listHmoProviders(): Promise<HmoProvider[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("hmo_providers")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(
    (r: any): HmoProvider => ({
      id: r.id,
      name: r.name ?? "",
      code: r.code ?? "",
      contactPerson: r.contact_person ?? "",
      contactEmail: r.contact_email ?? "",
      contactNumber: r.contact_number ?? "",
      address: r.address ?? "",
      submissionCycle: r.submission_cycle ?? "monthly",
      paymentTermsDays: Number(r.payment_terms_days ?? 30),
      status: r.status ?? "active",
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? r.created_at,
    }),
  );
}

export async function createHmoProvider(
  input: Omit<HmoProvider, "id" | "createdAt" | "updatedAt">,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("hmo_providers")
    .insert({
      name: input.name,
      code: input.code,
      contact_person: input.contactPerson,
      contact_email: input.contactEmail,
      contact_number: input.contactNumber,
      address: input.address,
      submission_cycle: input.submissionCycle,
      payment_terms_days: input.paymentTermsDays,
      status: input.status,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateHmoProvider(
  id: string,
  input: Partial<Omit<HmoProvider, "id" | "createdAt" | "updatedAt">>,
) {
  const client = requireSupabase();
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.code !== undefined) payload.code = input.code;
  if (input.contactPerson !== undefined)
    payload.contact_person = input.contactPerson;
  if (input.contactEmail !== undefined)
    payload.contact_email = input.contactEmail;
  if (input.contactNumber !== undefined)
    payload.contact_number = input.contactNumber;
  if (input.address !== undefined) payload.address = input.address;
  if (input.submissionCycle !== undefined)
    payload.submission_cycle = input.submissionCycle;
  if (input.paymentTermsDays !== undefined)
    payload.payment_terms_days = input.paymentTermsDays;
  if (input.status !== undefined) payload.status = input.status;
  payload.updated_at = new Date().toISOString();

  const { error } = await client
    .from("hmo_providers")
    .update(payload as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteHmoProvider(id: string) {
  const client = requireSupabase();
  const { error } = await client.from("hmo_providers").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Patient HMO Accounts
// ---------------------------------------------------------------------------

export async function listPatientHmoAccounts(): Promise<PatientHmoAccount[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("patient_hmo_accounts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(
    (r: any): PatientHmoAccount => ({
      id: r.id,
      patientId: r.patient_id,
      hmoProviderId: r.hmo_provider_id,
      cardNumber: r.card_number ?? "",
      memberType: r.member_type ?? "principal",
      principalName: r.principal_name ?? "",
      expirationDate: r.expiration_date ?? "",
      coverageLimit: Number(r.coverage_limit ?? 0),
      remainingBalance: Number(r.remaining_balance ?? 0),
      isActive: r.is_active ?? true,
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? r.created_at,
    }),
  );
}

export async function createPatientHmoAccount(
  input: Omit<PatientHmoAccount, "id" | "createdAt" | "updatedAt">,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("patient_hmo_accounts")
    .insert({
      patient_id: input.patientId,
      hmo_provider_id: input.hmoProviderId,
      card_number: input.cardNumber,
      member_type: input.memberType,
      principal_name: input.principalName,
      expiration_date: input.expirationDate || null,
      coverage_limit: input.coverageLimit,
      remaining_balance: input.remainingBalance,
      is_active: input.isActive,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePatientHmoAccount(
  id: string,
  input: Partial<Omit<PatientHmoAccount, "id" | "createdAt" | "updatedAt">>,
) {
  const client = requireSupabase();
  const payload: Record<string, unknown> = {};
  if (input.hmoProviderId !== undefined)
    payload.hmo_provider_id = input.hmoProviderId;
  if (input.cardNumber !== undefined) payload.card_number = input.cardNumber;
  if (input.memberType !== undefined) payload.member_type = input.memberType;
  if (input.principalName !== undefined)
    payload.principal_name = input.principalName;
  if (input.expirationDate !== undefined)
    payload.expiration_date = input.expirationDate || null;
  if (input.coverageLimit !== undefined)
    payload.coverage_limit = input.coverageLimit;
  if (input.remainingBalance !== undefined)
    payload.remaining_balance = input.remainingBalance;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  payload.updated_at = new Date().toISOString();

  const { error } = await client
    .from("patient_hmo_accounts")
    .update(payload as never)
    .eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// HMO Authorizations
// ---------------------------------------------------------------------------

export async function listHmoAuthorizations(): Promise<HmoAuthorization[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("hmo_authorizations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(
    (r: any): HmoAuthorization => ({
      id: r.id,
      patientId: r.patient_id,
      appointmentId: r.appointment_id,
      hmoProviderId: r.hmo_provider_id,
      authorizationCode: r.authorization_code ?? "",
      coverageAmount: Number(r.coverage_amount ?? 0),
      approvalStatus: mapApprovalStatus(r.approval_status),
      approvedBy: r.approved_by ?? "",
      approvalDate: r.approval_date,
      notes: r.notes ?? "",
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? r.created_at,
    }),
  );
}

export async function createHmoAuthorization(
  input: Omit<HmoAuthorization, "id" | "createdAt" | "updatedAt">,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("hmo_authorizations")
    .insert({
      patient_id: input.patientId,
      appointment_id: input.appointmentId || null,
      hmo_provider_id: input.hmoProviderId,
      authorization_code: input.authorizationCode,
      coverage_amount: input.coverageAmount,
      approval_status: input.approvalStatus,
      approved_by: input.approvedBy || null,
      approval_date: input.approvalDate || null,
      notes: input.notes,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateHmoAuthorization(
  id: string,
  input: Partial<Omit<HmoAuthorization, "id" | "createdAt" | "updatedAt">>,
) {
  const client = requireSupabase();
  const payload: Record<string, unknown> = {};
  if (input.approvalStatus !== undefined)
    payload.approval_status = input.approvalStatus;
  if (input.approvedBy !== undefined) payload.approved_by = input.approvedBy;
  if (input.approvalDate !== undefined)
    payload.approval_date = input.approvalDate;
  if (input.coverageAmount !== undefined)
    payload.coverage_amount = input.coverageAmount;
  if (input.authorizationCode !== undefined)
    payload.authorization_code = input.authorizationCode;
  if (input.notes !== undefined) payload.notes = input.notes;
  payload.updated_at = new Date().toISOString();

  const { error } = await client
    .from("hmo_authorizations")
    .update(payload as never)
    .eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// HMO Claims
// ---------------------------------------------------------------------------

export async function listHmoClaims(): Promise<HmoClaim[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("hmo_claims")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(
    (r: any): HmoClaim => ({
      id: r.id,
      authorizationId: r.authorization_id,
      invoiceNumber: r.invoice_number ?? "",
      totalAmount: Number(r.total_amount ?? 0),
      coveredAmount: Number(r.covered_amount ?? 0),
      patientExcess: Number(r.patient_excess ?? 0),
      claimStatus: mapClaimStatus(r.claim_status),
      submissionDate: r.submission_date,
      paymentDueDate: r.payment_due_date,
      paidDate: r.paid_date,
      remarks: r.remarks ?? "",
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? r.created_at,
    }),
  );
}

export async function createHmoClaim(
  input: Omit<HmoClaim, "id" | "createdAt" | "updatedAt">,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("hmo_claims")
    .insert({
      authorization_id: input.authorizationId || null,
      invoice_number: input.invoiceNumber,
      total_amount: input.totalAmount,
      covered_amount: input.coveredAmount,
      patient_excess: input.patientExcess,
      claim_status: input.claimStatus,
      submission_date: input.submissionDate || null,
      payment_due_date: input.paymentDueDate || null,
      paid_date: input.paidDate || null,
      remarks: input.remarks,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateHmoClaim(
  id: string,
  input: Partial<Omit<HmoClaim, "id" | "createdAt" | "updatedAt">>,
) {
  const client = requireSupabase();
  const payload: Record<string, unknown> = {};
  if (input.claimStatus !== undefined) payload.claim_status = input.claimStatus;
  if (input.totalAmount !== undefined) payload.total_amount = input.totalAmount;
  if (input.coveredAmount !== undefined)
    payload.covered_amount = input.coveredAmount;
  if (input.patientExcess !== undefined)
    payload.patient_excess = input.patientExcess;
  if (input.submissionDate !== undefined)
    payload.submission_date = input.submissionDate;
  if (input.paymentDueDate !== undefined)
    payload.payment_due_date = input.paymentDueDate;
  if (input.paidDate !== undefined) payload.paid_date = input.paidDate;
  if (input.remarks !== undefined) payload.remarks = input.remarks;
  if (input.invoiceNumber !== undefined)
    payload.invoice_number = input.invoiceNumber;
  payload.updated_at = new Date().toISOString();

  const { error } = await client
    .from("hmo_claims")
    .update(payload as never)
    .eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// HMO Claim Items
// ---------------------------------------------------------------------------

export async function listHmoClaimItems(
  claimId: string,
): Promise<HmoClaimItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("hmo_claim_items")
    .select("*")
    .eq("claim_id", claimId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map(
    (r: any): HmoClaimItem => ({
      id: r.id,
      claimId: r.claim_id,
      serviceName: r.service_name,
      doctorId: r.doctor_id,
      quantity: Number(r.quantity ?? 1),
      amount: Number(r.amount ?? 0),
      remarks: r.remarks ?? "",
      createdAt: r.created_at,
      updatedAt: r.created_at,
    }),
  );
}

export async function createHmoClaimItem(
  input: Omit<HmoClaimItem, "id" | "createdAt" | "updatedAt">,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("hmo_claim_items")
    .insert({
      claim_id: input.claimId,
      service_name: input.serviceName,
      doctor_id: input.doctorId || null,
      quantity: input.quantity,
      amount: input.amount,
      remarks: input.remarks,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteHmoClaimItem(id: string) {
  const client = requireSupabase();
  const { error } = await client.from("hmo_claim_items").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// HMO Payments
// ---------------------------------------------------------------------------

export async function listHmoPayments(): Promise<HmoPayment[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("hmo_payments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(
    (r: any): HmoPayment => ({
      id: r.id,
      claimId: r.claim_id,
      paymentReference: r.payment_reference ?? "",
      amountPaid: Number(r.amount_paid ?? 0),
      paymentDate: r.payment_date,
      paymentMethod: r.payment_method ?? "bank_transfer",
      remarks: r.remarks ?? "",
      createdAt: r.created_at,
      updatedAt: r.created_at,
    }),
  );
}

export async function listHmoPaymentsByClaim(
  claimId: string,
): Promise<HmoPayment[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("hmo_payments")
    .select("*")
    .eq("claim_id", claimId)
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(
    (r: any): HmoPayment => ({
      id: r.id,
      claimId: r.claim_id,
      paymentReference: r.payment_reference ?? "",
      amountPaid: Number(r.amount_paid ?? 0),
      paymentDate: r.payment_date,
      paymentMethod: r.payment_method ?? "bank_transfer",
      remarks: r.remarks ?? "",
      createdAt: r.created_at,
      updatedAt: r.created_at,
    }),
  );
}

export async function createHmoPayment(
  input: Omit<HmoPayment, "id" | "createdAt" | "updatedAt">,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("hmo_payments")
    .insert({
      claim_id: input.claimId,
      payment_reference: input.paymentReference,
      amount_paid: input.amountPaid,
      payment_date: input.paymentDate,
      payment_method: input.paymentMethod,
      remarks: input.remarks,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// File uploads
// ---------------------------------------------------------------------------

export async function uploadHmoDocument(
  bucket: string,
  filePath: string,
  file: File,
) {
  const client = requireSupabase();
  const { error } = await client.storage.from(bucket).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = client.storage.from(bucket).getPublicUrl(filePath);
  return publicUrl;
}

export async function listHmoDocuments(bucket: string, folder: string) {
  const client = requireSupabase();
  const { data, error } = await client.storage.from(bucket).list(folder);
  if (error) throw error;
  return data ?? [];
}
