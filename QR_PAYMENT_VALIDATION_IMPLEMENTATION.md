# QR Validation Logic & Session-Specific Payment Verification

## Implementation Complete ✅

This document describes the implementation of the appointment-specific QR validation system that prevents "stale" successful payments from previous dates from allowing unauthorized access.

---

## Overview

The system now ensures that **payment verification is tied strictly to the current appointment**, preventing bypass of payment gates using old invoices.

### Key Principle
> By including the specific `appointment_id` in the invoice query, the system ignores the "Paid" status of the patient's previous visits.

---

## Implementation Details

### 1. Database Schema
- **Table**: `invoices`
- **Column**: `appointment_id` (nullable, but now consistently populated)
- **Index**: `idx_invoices_appointment_id` (already exists)
- Future: Consider adding `NOT NULL` constraint for stronger guarantee

### 2. Invoice Generation Service
**File**: `src/lib/supabase-clinic.ts`

The `createInvoiceLiveOrDemo()` and `markBookingPaidAndCreateInvoiceLiveOrDemo()` functions now ensure every invoice includes:
- `patient_id`: Links invoice to patient
- `appointment_id`: Links invoice to specific appointment session
- `payment_status`: 'paid' or 'unpaid'

Example:
```typescript
const invoicePayload = {
  patient_id: booking.patient_id,
  appointment_id: appointmentId,  // ← Explicitly set
  invoice_number: `INV-${Date.now()}`,
  payment_status: 'paid',
  subtotal: booking.fee_amount,
  total: booking.fee_amount,
};
```

### 3. Invoice Creation & Billing Form
**File**: `src/features/billing/api/billing-mutations.ts`
**File**: `src/features/billing/billing-page.tsx`

#### Changes:
1. **Form Schema Updated** (`src/features/billing/types/forms.ts`):
   ```typescript
   export const billingSchema = z.object({
     patientId: z.string().min(1, 'Patient is required.'),
     bookingId: z.string().optional(),
     appointmentId: z.string().optional(),  // ← NEW
     items: z.array(invoiceItemSchema).min(1, ...),
   });
   ```

2. **Mutations Updated**:
   - `useCreateInvoice()`: Prioritizes explicit `appointmentId` from form
   - `useUpdateInvoice()`: Same logic as create
   - Priority: `values.appointmentId ?? taggedBooking?.appointmentId ?? null`

3. **Billing Form UI Enhanced**:
   - Added appointment selector field
   - Fetches appointments for selected patient
   - Filters out cancelled/completed/no_show appointments
   - Shows appointment date/time and status
   - Staff can now link invoices to specific appointments

### 4. QR Scan & Verification Logic
**File**: `src/features/consultation/services/consultation-access-service.ts`

#### Workflow:

**Step 1: Extract IDs**
```typescript
const appointments = await listAppointmentsByPatientIdLiveOrDemo(patientId);
const currentAppointment = getTodaysSoonestAppointment(appointments);
```

**Step 2: Strict Query (The Anti-Bypass Filter)**
```typescript
const latestInvoice = await getLatestInvoiceByPatientIdLiveOrDemo(
  patientId,
  currentAppointment?.id  // ← Appointment-specific filter
);

// Actual SQL equivalent:
// SELECT * FROM invoices 
// WHERE patient_id = ? AND appointment_id = ? 
// ORDER BY created_at DESC LIMIT 1
```

**Step 3: Conditional Gates**

| Condition | Message | Action |
|-----------|---------|--------|
| No invoice found | "No invoice generated for this session. A new invoice must be created and paid before consultation can proceed." | Block access |
| Invoice unpaid | "Payment Required for today's session. Invoice INV-XXXX is unpaid." | Block access |
| Invoice paid | "Payment validated. Appointment is ready for SOAP documentation." | Proceed |

**Step 4: Status Synchronization (On Success)**
```typescript
// Updates appointment status and notes
await updateAppointmentStatusAndNotesLiveOrDemo({
  appointmentId: linkedAppointment.id,
  status: 'confirmed',  // Transition from scheduled
  notes: composeAppointmentNotes(notes, intakeNotes),
});

// Initiates SOAP documentation interface for generalist
```

### 5. QR Lookup Integration
**File**: `src/features/patients/patient-qr-lookup-page.tsx`

The patient QR scanning page calls:
```typescript
const access = await validatePatientConsultationAccess(patient.id);

if (!access.allowed) {
  // Display error: "No invoice for session" or "Payment Required"
  return;
}

// Navigate to consultation with appointment context
navigate(`/app/consultation/${patient.id}?appointmentId=${access.appointmentId}`);
```

---

## Security Properties

### ✅ Appointment-Specific Gating
- Payment verification requires BOTH patient_id AND appointment_id match
- Query excludes all historical invoices from other sessions

### ✅ Session Isolation
- Today's appointment is never authorized by yesterday's paid invoice
- Each consultation session requires its own linked invoice

### ✅ Clear Error States
- Staff sees exactly what's wrong:
  - "No invoice" → Must create and collect payment
  - "Unpaid" → Payment gate blocking access
  - "Ready" → Appointment confirmed, proceed with SOAP

### ✅ Cascade Updates
- Payment validation triggers appointment status change
- Intake notes automatically composed with appointment notes
- SOAP interface initializes automatically

### ✅ Backward Compatibility
- System works with existing bookings
- Creates appointments if needed (from `markBookingPaidAndCreateInvoiceLiveOrDemo`)
- Handles NULL appointment_id gracefully with fallback logic

---

## Workflow Examples

### Example 1: New Patient, Same Day
```
1. Patient arrives, QR scanned
2. System checks: appointment_id for today's appointment → no invoice found
3. Staff creates invoice, links to today's appointment, collects payment
4. Payment marks invoice as 'paid' and appointment as 'confirmed'
5. Next QR scan: finds paid invoice for today → access granted
6. Appointment notes updated with SOAP template
```

### Example 2: Returning Patient
```
1. Patient returns: Had paid consultation last week
2. Staff schedules new appointment for today
3. Patient QR scanned
4. System queries: patient_id + today's appointment_id
5. System ignores last week's paid invoice (different appointment_id)
6. Returns "No invoice generated for this session"
7. Staff must create NEW invoice for today's appointment
8. Ensures payment collection for today's session
```

### Example 3: Payment Processing
```
1. Booking receipt scanned: `markBookingPaidAndCreateInvoiceLiveOrDemo()`
2. Creates appointment if missing
3. Creates invoice linked to that appointment_id
4. Marks booking as paid
5. Next QR scan: finds paid invoice with correct appointment → access granted
```

---

## Testing Checklist

- [ ] Create invoice with appointment selected → Verify appointment_id in database
- [ ] Create invoice without appointment → Verify NULL handling and warning
- [ ] Scan QR for patient with no today appointment → "No invoice for this session"
- [ ] Scan QR for patient with unpaid invoice for today → "Payment Required"
- [ ] Scan QR for patient with paid invoice for today → Access granted
- [ ] Scan QR for patient with paid invoice from yesterday → "No invoice for this session"
- [ ] Verify appointment status changes to 'confirmed' after payment
- [ ] Verify SOAP interface initializes with appointment context
- [ ] Test with multiple same-day appointments → Selects soonest
- [ ] Test booking receipt scan flow → Creates appointment + invoice

---

## Migration Notes

### Recommended (Optional)
Add database constraint to ensure consistency:

```sql
-- Add NOT NULL constraint to appointment_id
ALTER TABLE invoices 
ADD CONSTRAINT invoices_appointment_id_not_null 
CHECK (appointment_id IS NOT NULL);

-- Or create index for faster queries
CREATE INDEX idx_invoices_appointment_status 
ON invoices(appointment_id, payment_status);
```

### Current State
- System works with nullable `appointment_id`
- Gracefully falls back if appointment_id is missing
- New invoices consistently populate appointment_id via form

---

## Files Modified

1. **src/features/billing/types/forms.ts**
   - Added `appointmentId: z.string().optional()` to schema

2. **src/features/billing/api/billing-mutations.ts**
   - Updated `useCreateInvoice()` mutation
   - Updated `useUpdateInvoice()` mutation
   - Priority logic: explicit > booking > null

3. **src/features/billing/billing-page.tsx**
   - Added `useAppointments()` hook
   - Added appointment selector field in form
   - Updated form reset logic in `openCreateModal()` and `openEditModal()`

4. **src/features/billing/components/invoice-form-modal.tsx**
   - Updated component interface to accept appointments
   - Added appointment selector UI
   - Added helper function to format appointment times

5. **src/features/consultation/services/consultation-access-service.ts**
   - Enhanced `syncAppointmentAfterPaidValidation()` to accept appointmentId
   - Prioritizes invoice's appointmentId over current appointment
   - Updated error messages to be session-specific
   - Modified `validatePatientConsultationAccess()` to pass appointmentId to sync

---

## Future Enhancements

1. **Auto-link to Today's Appointment**
   - Modify form to auto-select today's appointment if only one exists
   - Warn if multiple appointments on same day

2. **Appointment History in Invoice**
   - Show recent appointments in billing form for quick selection
   - Track which appointment each invoice belongs to

3. **Database Constraint**
   - Add NOT NULL constraint to appointment_id
   - Would prevent future NULL values

4. **Audit Trail**
   - Log payment verification attempts
   - Track which staff approved which sessions
   - Audit trail for compliance

5. **Payment Reminder**
   - Auto-send reminder when invoice created but not paid
   - SMS/Email to patient with payment link

---

## Support & Troubleshooting

### Issue: "No invoice generated for this session"
**Cause**: No invoice exists for today's appointment
**Solution**: 
1. Create invoice in billing page
2. Ensure appointment is selected
3. Collect payment
4. Re-scan QR

### Issue: "Payment Required for today's session"
**Cause**: Invoice exists but status is not 'paid'
**Solution**:
1. Mark invoice as paid in billing page
2. Re-scan QR

### Issue: Old paid invoice not working
**Expected**: System should reject old invoices
**Verification**: Correct behavior - each session needs its own paid invoice

### Issue: Appointment not showing in selector
**Cause**: Appointment status is cancelled/completed/no_show
**Solution**: Create new appointment for today if needed

---

## Technical References

- **Query Keys**: `src/lib/query-keys.ts` - Caching strategy
- **API Layer**: `src/lib/supabase-clinic.ts` - Database operations
- **Type Definitions**: `src/types/domain.ts` - Invoice, Appointment types
- **Hooks**: `src/features/appointments/hooks/use-appointments.ts`
