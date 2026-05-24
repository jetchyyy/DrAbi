// ---------------------------------------------------------------------------
// LIS API service — data access for test parameters, results, accession, audit
// ---------------------------------------------------------------------------

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type {
  CreateAccessionInput,
  CreateLabReagentLinkInput,
  CreateLabTestParameterInput,
  LabAccessionRecord,
  LabAuditEntry,
  LabReagentLink,
  LabResultEntry,
  LabTestParameter,
  LabTestPanel,
  SaveLabResultEntryInput,
  AbnormalFlag,
} from './lis-types';

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

// ---------------------------------------------------------------------------
// Test Parameters
// ---------------------------------------------------------------------------

export async function listTestParameters(medicalServiceId: string): Promise<LabTestParameter[]> {
  if (!isSupabaseConfigured) return [];
  const client = requireClient();
  const { data, error } = await (client as any)
    .from('lab_test_parameters')
    .select('*')
    .eq('medical_service_id', medicalServiceId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map(mapParameter);
}

export async function createTestParameter(input: CreateLabTestParameterInput): Promise<LabTestParameter> {
  const client = requireClient();
  const { data, error } = await (client as any)
    .from('lab_test_parameters')
    .insert({
      medical_service_id: input.medicalServiceId,
      parameter_name: input.parameterName.trim(),
      unit: input.unit.trim(),
      data_type: input.dataType,
      sort_order: input.sortOrder,
      reference_range_male_low: input.referenceRangeMaleLow ?? null,
      reference_range_male_high: input.referenceRangeMaleHigh ?? null,
      reference_range_female_low: input.referenceRangeFemaleLow ?? null,
      reference_range_female_high: input.referenceRangeFemaleHigh ?? null,
      reference_range_child_low: input.referenceRangeChildLow ?? null,
      reference_range_child_high: input.referenceRangeChildHigh ?? null,
      reference_range_general_low: input.referenceRangeGeneralLow ?? null,
      reference_range_general_high: input.referenceRangeGeneralHigh ?? null,
      select_options: JSON.stringify(input.selectOptions ?? []),
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapParameter(data);
}

export async function updateTestParameter(id: string, input: Partial<CreateLabTestParameterInput>): Promise<LabTestParameter> {
  const client = requireClient();
  const payload: Record<string, unknown> = {};
  if (input.parameterName !== undefined) payload.parameter_name = input.parameterName.trim();
  if (input.unit !== undefined) payload.unit = input.unit.trim();
  if (input.dataType !== undefined) payload.data_type = input.dataType;
  if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;
  if (input.referenceRangeMaleLow !== undefined) payload.reference_range_male_low = input.referenceRangeMaleLow;
  if (input.referenceRangeMaleHigh !== undefined) payload.reference_range_male_high = input.referenceRangeMaleHigh;
  if (input.referenceRangeFemaleLow !== undefined) payload.reference_range_female_low = input.referenceRangeFemaleLow;
  if (input.referenceRangeFemaleHigh !== undefined) payload.reference_range_female_high = input.referenceRangeFemaleHigh;
  if (input.referenceRangeChildLow !== undefined) payload.reference_range_child_low = input.referenceRangeChildLow;
  if (input.referenceRangeChildHigh !== undefined) payload.reference_range_child_high = input.referenceRangeChildHigh;
  if (input.referenceRangeGeneralLow !== undefined) payload.reference_range_general_low = input.referenceRangeGeneralLow;
  if (input.referenceRangeGeneralHigh !== undefined) payload.reference_range_general_high = input.referenceRangeGeneralHigh;
  if (input.selectOptions !== undefined) payload.select_options = JSON.stringify(input.selectOptions);

  const { data, error } = await (client as any)
    .from('lab_test_parameters')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapParameter(data);
}

export async function deleteTestParameter(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await (client as any).from('lab_test_parameters').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

function mapParameter(row: any): LabTestParameter {
  return {
    id: row.id,
    medicalServiceId: row.medical_service_id,
    parameterName: row.parameter_name,
    unit: row.unit ?? '',
    dataType: row.data_type ?? 'numeric',
    sortOrder: row.sort_order ?? 0,
    referenceRangeMaleLow: row.reference_range_male_low != null ? Number(row.reference_range_male_low) : null,
    referenceRangeMaleHigh: row.reference_range_male_high != null ? Number(row.reference_range_male_high) : null,
    referenceRangeFemaleLow: row.reference_range_female_low != null ? Number(row.reference_range_female_low) : null,
    referenceRangeFemaleHigh: row.reference_range_female_high != null ? Number(row.reference_range_female_high) : null,
    referenceRangeChildLow: row.reference_range_child_low != null ? Number(row.reference_range_child_low) : null,
    referenceRangeChildHigh: row.reference_range_child_high != null ? Number(row.reference_range_child_high) : null,
    referenceRangeGeneralLow: row.reference_range_general_low != null ? Number(row.reference_range_general_low) : null,
    referenceRangeGeneralHigh: row.reference_range_general_high != null ? Number(row.reference_range_general_high) : null,
    selectOptions: Array.isArray(row.select_options) ? row.select_options : [],
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Test Panels
// ---------------------------------------------------------------------------

export async function listTestPanels(): Promise<LabTestPanel[]> {
  if (!isSupabaseConfigured) return [];
  const client = requireClient();
  const { data, error } = await (client as any)
    .from('lab_test_panels')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    medicalServiceIds: Array.isArray(row.medical_service_ids) ? row.medical_service_ids : [],
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createTestPanel(name: string, description: string, serviceIds: string[]): Promise<LabTestPanel> {
  const client = requireClient();
  const { data, error } = await (client as any)
    .from('lab_test_panels')
    .insert({ name: name.trim(), description: description.trim(), medical_service_ids: serviceIds })
    .select('*')
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name, description: data.description ?? '', medicalServiceIds: data.medical_service_ids ?? [], isActive: true, createdAt: data.created_at, updatedAt: data.updated_at };
}

export async function updateTestPanel(id: string, name: string, description: string, serviceIds: string[]): Promise<void> {
  const client = requireClient();
  const { error } = await (client as any)
    .from('lab_test_panels')
    .update({ name: name.trim(), description: description.trim(), medical_service_ids: serviceIds })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTestPanel(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await (client as any).from('lab_test_panels').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Result Entries
// ---------------------------------------------------------------------------

export async function listResultEntries(serviceRequestId: string): Promise<LabResultEntry[]> {
  if (!isSupabaseConfigured) return [];
  const client = requireClient();
  const { data, error } = await (client as any)
    .from('lab_result_entries')
    .select('*')
    .eq('service_request_id', serviceRequestId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const entries = (data ?? []) as any[];
  if (entries.length === 0) return [];

  // Hydrate parameter info
  const paramIds = [...new Set(entries.map((e: any) => e.parameter_id))];
  const { data: params } = await (client as any)
    .from('lab_test_parameters')
    .select('id, parameter_name, unit, data_type, reference_range_general_low, reference_range_general_high')
    .in('id', paramIds);

  const paramMap = new Map((params ?? []).map((p: any) => [p.id, p]));

  return entries.map((row: any) => {
    const param = paramMap.get(row.parameter_id) as any;
    return {
      id: row.id,
      serviceRequestId: row.service_request_id,
      parameterId: row.parameter_id,
      parameterName: param?.parameter_name ?? '',
      unit: param?.unit ?? '',
      dataType: param?.data_type ?? 'numeric',
      valueNumeric: row.value_numeric != null ? Number(row.value_numeric) : null,
      valueText: row.value_text,
      abnormalFlag: row.abnormal_flag ?? 'normal',
      referenceRangeLow: param?.reference_range_general_low != null ? Number(param.reference_range_general_low) : null,
      referenceRangeHigh: param?.reference_range_general_high != null ? Number(param.reference_range_general_high) : null,
      enteredBy: row.entered_by,
      enteredAt: row.entered_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export async function saveResultEntry(input: SaveLabResultEntryInput): Promise<LabResultEntry> {
  const client = requireClient();
  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id ?? '';

  // Auto-determine abnormal flag if numeric value and not explicitly set
  let flag: AbnormalFlag = input.abnormalFlag ?? 'normal';
  if (input.valueNumeric != null && !input.abnormalFlag) {
    const { data: param } = await (client as any)
      .from('lab_test_parameters')
      .select('reference_range_general_low, reference_range_general_high')
      .eq('id', input.parameterId)
      .single();
    if (param) {
      const low = param.reference_range_general_low != null ? Number(param.reference_range_general_low) : null;
      const high = param.reference_range_general_high != null ? Number(param.reference_range_general_high) : null;
      flag = computeAbnormalFlag(input.valueNumeric, low, high);
    }
  }

  // Upsert: if result already exists for this request+parameter, update it
  const { data: existing } = await (client as any)
    .from('lab_result_entries')
    .select('id')
    .eq('service_request_id', input.serviceRequestId)
    .eq('parameter_id', input.parameterId)
    .maybeSingle();

  let result: any;
  if (existing) {
    const { data, error } = await (client as any)
      .from('lab_result_entries')
      .update({
        value_numeric: input.valueNumeric ?? null,
        value_text: input.valueText ?? null,
        abnormal_flag: flag,
        entered_by: userId,
        entered_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    result = data;
  } else {
    const { data, error } = await (client as any)
      .from('lab_result_entries')
      .insert({
        service_request_id: input.serviceRequestId,
        parameter_id: input.parameterId,
        value_numeric: input.valueNumeric ?? null,
        value_text: input.valueText ?? null,
        abnormal_flag: flag,
        entered_by: userId,
        entered_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) throw error;
    result = data;
  }

  return {
    id: result.id,
    serviceRequestId: result.service_request_id,
    parameterId: result.parameter_id,
    valueNumeric: result.value_numeric != null ? Number(result.value_numeric) : null,
    valueText: result.value_text,
    abnormalFlag: result.abnormal_flag ?? 'normal',
    referenceRangeLow: null,
    referenceRangeHigh: null,
    enteredBy: result.entered_by,
    enteredAt: result.entered_at,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export function computeAbnormalFlag(value: number, low: number | null, high: number | null): AbnormalFlag {
  if (low == null && high == null) return 'normal';
  if (low != null && value < low) {
    return value < low * 0.5 ? 'critical' : 'low';
  }
  if (high != null && value > high) {
    return value > high * 1.5 ? 'critical' : 'high';
  }
  return 'normal';
}

// ---------------------------------------------------------------------------
// Accession
// ---------------------------------------------------------------------------

export async function getAccession(serviceRequestId: string): Promise<LabAccessionRecord | null> {
  if (!isSupabaseConfigured) return null;
  const client = requireClient();
  const { data, error } = await (client as any)
    .from('lab_accession_log')
    .select('*')
    .eq('service_request_id', serviceRequestId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapAccession(data);
}

export async function createAccession(input: CreateAccessionInput): Promise<LabAccessionRecord> {
  const client = requireClient();
  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id ?? '';

  // Generate accession number
  const { data: accNum, error: accErr } = await (client as any).rpc('generate_lab_accession_number');
  if (accErr) throw accErr;

  const { data, error } = await (client as any)
    .from('lab_accession_log')
    .insert({
      service_request_id: input.serviceRequestId,
      accession_number: accNum,
      specimen_type: input.specimenType.trim(),
      specimen_condition: input.specimenCondition ?? 'adequate',
      specimen_received_at: new Date().toISOString(),
      accessioned_by: userId,
      notes: input.notes ?? '',
    })
    .select('*')
    .single();
  if (error) throw error;

  // Also update service_requests with the accession number
  await (client as any)
    .from('service_requests')
    .update({ accession_number: accNum } as never)
    .eq('id', input.serviceRequestId);

  return mapAccession(data);
}

function mapAccession(row: any): LabAccessionRecord {
  return {
    id: row.id,
    serviceRequestId: row.service_request_id,
    accessionNumber: row.accession_number,
    specimenType: row.specimen_type ?? '',
    specimenCollectedAt: row.specimen_collected_at,
    specimenReceivedAt: row.specimen_received_at,
    specimenCondition: row.specimen_condition ?? 'adequate',
    collectedBy: row.collected_by,
    accessionedBy: row.accessioned_by,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export async function listAuditLog(serviceRequestId: string): Promise<LabAuditEntry[]> {
  if (!isSupabaseConfigured) return [];
  const client = requireClient();
  const { data, error } = await (client as any)
    .from('lab_audit_log')
    .select('*')
    .eq('service_request_id', serviceRequestId)
    .order('performed_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((row: any) => ({
    id: row.id,
    serviceRequestId: row.service_request_id,
    action: row.action,
    oldValue: row.old_value,
    newValue: row.new_value,
    performedBy: row.performed_by,
    performedAt: row.performed_at,
  }));
}

export async function insertAuditEntry(serviceRequestId: string, action: string, oldValue?: string, newValue?: string): Promise<void> {
  const client = requireClient();
  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id ?? '';

  await (client as any).from('lab_audit_log').insert({
    service_request_id: serviceRequestId,
    action,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    performed_by: userId,
    performed_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Reagent Links
// ---------------------------------------------------------------------------

export async function listReagentLinks(medicalServiceId: string): Promise<LabReagentLink[]> {
  if (!isSupabaseConfigured) return [];
  const client = requireClient();
  const { data, error } = await (client as any)
    .from('lab_reagent_links')
    .select('*')
    .eq('medical_service_id', medicalServiceId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const links = (data ?? []) as any[];
  if (links.length === 0) return [];

  const itemIds = [...new Set(links.map((l: any) => l.inventory_item_id))];
  const { data: items } = await client.from('inventory_items').select('id, name, unit').in('id', itemIds);
  const itemMap = new Map((items ?? []).map((i: any) => [i.id, i]));

  return links.map((row: any) => {
    const item = itemMap.get(row.inventory_item_id) as any;
    return {
      id: row.id,
      medicalServiceId: row.medical_service_id,
      inventoryItemId: row.inventory_item_id,
      inventoryItemName: item?.name ?? '',
      inventoryItemUnit: item?.unit ?? '',
      quantityPerTest: Number(row.quantity_per_test),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export async function createReagentLink(input: CreateLabReagentLinkInput): Promise<LabReagentLink> {
  const client = requireClient();
  const { data, error } = await (client as any)
    .from('lab_reagent_links')
    .insert({
      medical_service_id: input.medicalServiceId,
      inventory_item_id: input.inventoryItemId,
      quantity_per_test: input.quantityPerTest,
    })
    .select('*')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    medicalServiceId: data.medical_service_id,
    inventoryItemId: data.inventory_item_id,
    quantityPerTest: Number(data.quantity_per_test),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteReagentLink(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await (client as any).from('lab_reagent_links').delete().eq('id', id);
  if (error) throw error;
}
