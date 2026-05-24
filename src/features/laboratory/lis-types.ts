// ---------------------------------------------------------------------------
// LIS (Laboratory Information System) domain types
// ---------------------------------------------------------------------------

export type LabParameterDataType = 'numeric' | 'text' | 'select';
export type AbnormalFlag = 'low' | 'normal' | 'high' | 'critical';
export type SpecimenCondition = 'adequate' | 'insufficient' | 'hemolyzed' | 'lipemic' | 'clotted' | 'other';

export interface LabTestParameter {
  id: string;
  medicalServiceId: string;
  parameterName: string;
  unit: string;
  dataType: LabParameterDataType;
  sortOrder: number;
  referenceRangeMaleLow: number | null;
  referenceRangeMaleHigh: number | null;
  referenceRangeFemaleLow: number | null;
  referenceRangeFemaleHigh: number | null;
  referenceRangeChildLow: number | null;
  referenceRangeChildHigh: number | null;
  referenceRangeGeneralLow: number | null;
  referenceRangeGeneralHigh: number | null;
  selectOptions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LabTestPanel {
  id: string;
  name: string;
  description: string;
  medicalServiceIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LabResultEntry {
  id: string;
  serviceRequestId: string;
  parameterId: string;
  parameterName?: string;
  unit?: string;
  dataType?: LabParameterDataType;
  valueNumeric: number | null;
  valueText: string | null;
  abnormalFlag: AbnormalFlag;
  referenceRangeLow: number | null;
  referenceRangeHigh: number | null;
  enteredBy: string;
  enteredByName?: string | null;
  enteredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabAccessionRecord {
  id: string;
  serviceRequestId: string;
  accessionNumber: string;
  specimenType: string;
  specimenCollectedAt: string | null;
  specimenReceivedAt: string | null;
  specimenCondition: string;
  collectedBy: string | null;
  collectedByName?: string | null;
  accessionedBy: string | null;
  accessionedByName?: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabAuditEntry {
  id: string;
  serviceRequestId: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  performedBy: string;
  performedByName?: string | null;
  performedAt: string;
}

export interface LabReagentLink {
  id: string;
  medicalServiceId: string;
  inventoryItemId: string;
  inventoryItemName?: string;
  inventoryItemUnit?: string;
  quantityPerTest: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLabTestParameterInput {
  medicalServiceId: string;
  parameterName: string;
  unit: string;
  dataType: LabParameterDataType;
  sortOrder: number;
  referenceRangeMaleLow?: number | null;
  referenceRangeMaleHigh?: number | null;
  referenceRangeFemaleLow?: number | null;
  referenceRangeFemaleHigh?: number | null;
  referenceRangeChildLow?: number | null;
  referenceRangeChildHigh?: number | null;
  referenceRangeGeneralLow?: number | null;
  referenceRangeGeneralHigh?: number | null;
  selectOptions?: string[];
}

export interface SaveLabResultEntryInput {
  serviceRequestId: string;
  parameterId: string;
  valueNumeric?: number | null;
  valueText?: string | null;
  abnormalFlag?: AbnormalFlag;
}

export interface CreateAccessionInput {
  serviceRequestId: string;
  specimenType: string;
  specimenCondition?: string;
  notes?: string;
}

export interface CreateLabReagentLinkInput {
  medicalServiceId: string;
  inventoryItemId: string;
  quantityPerTest: number;
}
