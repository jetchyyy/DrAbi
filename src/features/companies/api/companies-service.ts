/**
 * Companies — Supabase Service Layer
 */
import { supabase } from "../../../lib/supabase";
import type { Company } from "../../../types/domain";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function listCompanies(): Promise<Company[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("companies")
    .select("*")
    .order("company_name");
  if (error) throw error;
  return (data ?? []).map(
    (r: any): Company => ({
      id: r.id,
      companyCode: r.company_code ?? "",
      companyName: r.company_name ?? "",
      contactPerson: r.contact_person ?? "",
      contactEmail: r.contact_email ?? "",
      contactPhone: r.contact_phone ?? "",
      address: r.address ?? "",
      billingCycle: r.billing_cycle ?? "monthly",
      paymentTerms: r.payment_terms ?? "Net 30",
      isActive: r.is_active ?? true,
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? r.created_at,
    }),
  );
}

export async function createCompany(
  input: Omit<Company, "id" | "createdAt" | "updatedAt">,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("companies")
    .insert({
      company_code: input.companyCode,
      company_name: input.companyName,
      contact_person: input.contactPerson,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      address: input.address,
      billing_cycle: input.billingCycle,
      payment_terms: input.paymentTerms,
      is_active: input.isActive,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCompany(
  id: string,
  input: Partial<Omit<Company, "id" | "createdAt" | "updatedAt">>,
) {
  const client = requireSupabase();
  const payload: Record<string, unknown> = {};

  if (input.companyCode !== undefined) payload.company_code = input.companyCode;
  if (input.companyName !== undefined) payload.company_name = input.companyName;
  if (input.contactPerson !== undefined)
    payload.contact_person = input.contactPerson;
  if (input.contactEmail !== undefined)
    payload.contact_email = input.contactEmail;
  if (input.contactPhone !== undefined)
    payload.contact_phone = input.contactPhone;
  if (input.address !== undefined) payload.address = input.address;
  if (input.billingCycle !== undefined)
    payload.billing_cycle = input.billingCycle;
  if (input.paymentTerms !== undefined)
    payload.payment_terms = input.paymentTerms;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  payload.updated_at = new Date().toISOString();

  const { error } = await client
    .from("companies")
    .update(payload as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCompany(id: string) {
  const client = requireSupabase();
  const { error } = await client.from("companies").delete().eq("id", id);
  if (error) throw error;
}
