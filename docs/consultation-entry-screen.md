# Multi-Step Consultation Entry Screen

## Overview

A dedicated, focused consultation entry experience has been created as a dedicated screen accessible at `/app/consultation/:patientId`. This replaces the inline SOAP form in the patient detail page.

## Key Features

### 1. **Six-Step Guided Workflow**

The consultation is broken into clear, logical steps to guide doctors through comprehensive clinical documentation:

- **Step 1: Appointment & Consultation Info**
  - Select pending appointment
  - Consultation type (Initial, Follow-up, etc.)
  - Date and time
  - Provider name

- **Step 2: Patient History** _(Required: at least presentIllnessHistory)_
  - Present illness history
  - Review of symptoms
  - Known allergies

- **Step 3: Clinical Findings** _(Required: at least one of vitals, medications, or lab results)_
  - Vital signs (BP, HR, RR, Temp, etc.)
  - Current medications
  - Lab results

- **Step 4: Diagnoses** _(Required: at least one diagnosis type)_
  - Primary diagnosis
  - Differential diagnoses

- **Step 5: Clinical Assessment**
  - SOAP notes structure:
    - Subjective (S): Patient-reported symptoms
    - Objective (O): Measurable findings
    - Assessment (A): Clinical impression
    - Plan (P): Treatment plan

- **Step 6: Treatment & Summary** _(Required: clinicalSummary)_
  - Clinical summary
  - Treatment plan
  - Consultation outcome

### 2. **Patient Information Header**

Displays key patient demographics at the top:

- Full name
- Contact information
- Date of birth
- Current status badge

### 3. **Progress Indicator**

Visual progress bar showing:

- Completed steps (green)
- Current step (blue)
- Remaining steps (gray)
- Current step number and title

### 4. **Smart Navigation**

- **Previous/Next buttons** to move between steps
- Auto-validation triggers when moving to next step
- Final step shows "Save Consultation" button (green)
- Previous button disabled on first step

### 5. **Automatic Data Persistence**

All submitted consultation data is:

- Recorded to patient medical record (medical_services_transactions table)
- Linked to the appointment (marks as completed)
- Saved as medical history entry
- Auditable with actor/provider tracking

## Technical Implementation

### New Component

**File:** `src/features/consultation/consultation-entry-page.tsx`

- Standalone React component with multi-step form logic
- Uses React Hook Form for validation and state management
- Zod schemas for type-safe validation

### Integration Points

1. **Route:** `/app/consultation/:patientId`
   - Updated in `src/routes/router.tsx`

2. **Entry Points:**
   - "Start Consultation" button on patient header (patient detail page)
   - "Start Consultation" link on patient list rows
   - QR code post-scan redirect (from patient QR lookup)

3. **Service Layer Integration:**
   - Uses existing `consultationService.submitConsultation()` for persistence
   - Automatically creates appointment linkage, transaction records, and medical history entries

### Type Updates

**File:** `src/types/domain.ts`

- Made optional fields truly optional in Consultation interface
- Reflects actual validation requirements

**File:** `src/features/consultation/services/consultation-service.ts`

- Updated `normalizePayload()` to handle optional fields safely
- No breaking changes to existing validation logic

## Entry Points

### 1. Patient Detail Page

- Header button: "Start Consultation"
- Links to `/app/consultation/:patientId`

### 2. Patient List

- Each row has "Start Consultation" action link
- Quick access to consultation entry

### 3. QR Code Scanner

- Patient QR scan redirects to `/app/consultation/:patientId`
- Streamlined workflow for clinic floor use

## Validation Requirements

The form enforces the six-step consultation model:

| Step | Field(s)                                                                          | Requirement           |
| ---- | --------------------------------------------------------------------------------- | --------------------- |
| 1    | appointmentId, consultationType, consultationDate, consultationTime, providerName | All required          |
| 2    | presentIllnessHistory                                                             | Required              |
| 3    | vitals OR medications OR labResults                                               | At least one required |
| 4    | diagnosis OR differentialDiagnosis                                                | At least one required |
| 5    | subjective, objective, assessment, plan                                           | Optional              |
| 6    | clinicalSummary                                                                   | Required              |

## User Experience Flow

1. Doctor clicks "Start Consultation" on patient record or QR scan result
2. Consultation entry screen loads with patient info at top
3. Doctor fills Step 1 (appointment context)
4. Clicks "Next" → validates and proceeds to Step 2
5. Continues through steps 2-5, entering clinical data
6. Final step (6) shows all required fields must be completed
7. Error messages appear if required fields are empty
8. Click "Save Consultation" to submit
9. System records data and returns to patient chart

## Data Flow

```
Consultation Entry Form
    ↓
consultationService.submitConsultation()
    ↓
├─ createConsultationLiveOrDemo() → consultations table
├─ appointmentService.markAppointmentCompletedWithConsultation() → updates appointments
├─ transactionService.createConsultationTransaction() → medical_services_transactions
└─ insert into patient_medical_history_entries for audit trail
    ↓
Success → Navigate back to patient chart
```

## Files Modified

- `src/features/consultation/consultation-entry-page.tsx` (NEW)
- `src/routes/router.tsx` (updated route mapping)
- `src/types/domain.ts` (type refinements)
- `src/features/consultation/services/consultation-service.ts` (optional field handling)

## Testing Checklist

- [ ] Create new appointment in appointments list
- [ ] Navigate to patient chart
- [ ] Click "Start Consultation" button
- [ ] Verify consultation entry screen loads with patient info
- [ ] Progress bar shows 6 steps
- [ ] Fill Step 1 and click Next
- [ ] Verify previous button works
- [ ] Complete all steps with valid data
- [ ] Click "Save Consultation"
- [ ] Verify success toast and redirect to patient chart
- [ ] Check appointment is marked "completed" in list
- [ ] Verify medical history entry created in Supabase

## Future Enhancements

- Auto-save draft feature using localStorage
- Template-based consultations for common scenarios
- Offline mode support
- Mobile-optimized step navigation
- Prescription entry post-consultation
- Direct integration with lab order submission
