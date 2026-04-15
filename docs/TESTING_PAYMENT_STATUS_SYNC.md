# Testing Payment Status Sync & Invoice Filtering

This document describes testing procedures for the payment-to-appointment sync trigger and the appointment-specific invoice filtering refactor.

## Overview

### Changes Made
1. **Database Trigger**: `sync_payment_to_appointment_status()` on `invoices` table
   - Automatically updates appointment status to 'confirmed' when invoice payment_status changes to 'paid'
   - Only updates if appointment_id is not null
   - Only updates if appointment status is 'scheduled' (safety check)

2. **Query Refactor**: `getLatestInvoiceByPatientIdLiveOrDemo(patientId, appointmentId?)`
   - Added optional appointmentId parameter
   - Filters invoices by specific appointment when provided
   - Prevents old paid invoices from masking new pending ones

3. **Consultation Access Service**: Updated to find today's soonest appointment
   - `getTodaysSoonestAppointment()` helper function
   - Validates payment against correct appointment for returning patients

---

## Test Cases

### Test 1: Database Trigger - Payment Status Change to Paid

**Objective**: Verify that updating invoice.payment_status to 'paid' automatically updates the linked appointment to 'confirmed'

**Setup**:
1. Create a patient record
2. Create an appointment with status='scheduled', scheduled_at=today
3. Create an invoice linked to that appointment with payment_status='unpaid'

**Steps**:
1. UPDATE invoices SET payment_status='paid' WHERE id={invoice_id}
2. SELECT status FROM appointments WHERE id={appointment_id}

**Expected Result**:
- appointment.status = 'confirmed'
- appointment.updated_at reflects the current timestamp

**SQL Test**:
```sql
-- Setup
INSERT INTO appointments (id, patient_id, doctor_id, scheduled_at, status)
VALUES ('test-appt-1', 'test-patient-1', NULL, NOW(), 'scheduled');

INSERT INTO invoices (id, patient_id, appointment_id, invoice_number, payment_status, total)
VALUES ('test-inv-1', 'test-patient-1', 'test-appt-1', 'INV-123', 'unpaid', 150.00);

-- Test
UPDATE invoices SET payment_status='paid' WHERE id='test-inv-1';

-- Verify
SELECT status FROM appointments WHERE id='test-appt-1'; -- Should be 'confirmed'
```

---

### Test 2: Database Trigger - No Update on NULL appointment_id

**Objective**: Verify that the trigger gracefully handles invoices with null appointment_id

**Setup**:
1. Create an invoice with appointment_id=NULL

**Steps**:
1. UPDATE invoices SET payment_status='paid' WHERE id={invoice_id}
2. Verify no errors occur

**Expected Result**:
- Update succeeds without error
- No appointment is updated (none to update)

**SQL Test**:
```sql
INSERT INTO invoices (id, patient_id, appointment_id, invoice_number, payment_status, total)
VALUES ('test-inv-2', 'test-patient-2', NULL, 'INV-456', 'unpaid', 100.00);

UPDATE invoices SET payment_status='paid' WHERE id='test-inv-2'; -- Should not error

SELECT COUNT(*) FROM appointments WHERE status='confirmed'; -- Count should not increase
```

---

### Test 3: Database Trigger - Safety Check: Don't Update Non-Scheduled Status

**Objective**: Verify that the trigger only updates 'scheduled' appointments, not already confirmed/in-progress ones

**Setup**:
1. Create an appointment with status='confirmed'
2. Create an invoice linked to that appointment with payment_status='unpaid'

**Steps**:
1. UPDATE invoices SET payment_status='paid' WHERE id={invoice_id}
2. SELECT status FROM appointments WHERE id={appointment_id}

**Expected Result**:
- appointment.status remains 'confirmed' (not changed)
- Payment status is updated, but appointment is protected from overwrite

**SQL Test**:
```sql
INSERT INTO appointments (id, patient_id, doctor_id, scheduled_at, status)
VALUES ('test-appt-3', 'test-patient-3', NULL, NOW(), 'confirmed');

INSERT INTO invoices (id, patient_id, appointment_id, invoice_number, payment_status, total)
VALUES ('test-inv-3', 'test-patient-3', 'test-appt-3', 'INV-789', 'unpaid', 75.00);

UPDATE invoices SET payment_status='paid' WHERE id='test-inv-3';

SELECT status FROM appointments WHERE id='test-appt-3'; -- Should still be 'confirmed' (not changed)
```

---

### Test 4: Query Refinement - Appointment-Specific Invoice Lookup

**Objective**: Verify that `getLatestInvoiceByPatientIdLiveOrDemo()` returns the correct invoice when appointmentId is provided

**Setup**:
1. Create a patient
2. Create appointment A (04/20/26) with paid invoice INV-100
3. Create appointment B (04/27/26) with pending invoice INV-200 (unpaid)

**Steps**:
1. Call `getLatestInvoiceByPatientIdLiveOrDemo(patientId, appointmentB.id)`
2. Verify invoice.invoiceNumber = 'INV-200'

**Test Code** (TypeScript):
```typescript
// Setup
const patient = { id: 'patient-1', name: 'John Doe' };
const appointmentA = { 
  id: 'appt-a', 
  patientId: 'patient-1', 
  scheduledAt: '2026-04-20T10:00:00Z', 
  status: 'completed' 
};
const appointmentB = {
  id: 'appt-b',
  patientId: 'patient-1',
  scheduledAt: '2026-04-27T14:00:00Z',
  status: 'scheduled'
};
const invoiceA = {
  id: 'inv-a',
  patientId: 'patient-1',
  appointmentId: 'appt-a',
  invoiceNumber: 'INV-100',
  paymentStatus: 'paid', // Old appointment, paid
  total: 150
};
const invoiceB = {
  id: 'inv-b',
  patientId: 'patient-1',
  appointmentId: 'appt-b',
  invoiceNumber: 'INV-200',
  paymentStatus: 'unpaid', // New appointment, pending
  total: 150
};

// Test
const result = await getLatestInvoiceByPatientIdLiveOrDemo(
  'patient-1',
  'appt-b' // requesting for appointment B
);

// Assert
expect(result?.invoiceNumber).toBe('INV-200');
expect(result?.paymentStatus).toBe('unpaid');
```

---

### Test 5: Query Refinement - Fallback Without appointmentId

**Objective**: Verify backward compatibility when appointmentId is not provided

**Setup**:
1. Same as Test 4 (patient with multiple appointments and invoices)

**Steps**:
1. Call `getLatestInvoiceByPatientIdLiveOrDemo(patientId)` (without appointmentId)
2. Verify most recent invoice is returned

**Expected Result**:
- invoice.invoiceNumber = 'INV-200' (most recent by createdAt)
- Backward compatible behavior preserved

**Test Code**:
```typescript
const result = await getLatestInvoiceByPatientIdLiveOrDemo('patient-1');
// Without appointmentId, should return the most recent invoice
expect(result?.invoiceNumber).toBe('INV-200'); // Most recent by date
```

---

### Test 6: Consultation Access Service - Today's Soonest Appointment

**Objective**: Verify that `validatePatientConsultationAccess()` uses today's soonest appointment for invoice lookup

**Setup**:
1. Create a patient
2. Create two appointments for today at different times (10:00 and 14:00)
3. Create invoices:
   - Invoice for 10:00 appointment: unpaid
   - Invoice for 14:00 appointment: unpaid

**Steps**:
1. Call `validatePatientConsultationAccess(patientId)` at 11:00 AM
2. System should validate the 10:00 appointment invoice (soonest today)
3. Verify access is blocked (unpaid)

**Test Code**:
```typescript
// Setup - at 11:00 AM today
const appointment10am = {
  id: 'appt-10am',
  patientId: 'patient-1',
  scheduledAt: '2026-04-15T10:00:00Z', // 10 AM today
  status: 'scheduled'
};
const appointment2pm = {
  id: 'appt-2pm',
  patientId: 'patient-1',
  scheduledAt: '2026-04-15T14:00:00Z', // 2 PM today
  status: 'scheduled'
};
const invoice10am = {
  id: 'inv-10am',
  appointmentId: 'appt-10am',
  invoiceNumber: 'INV-A',
  paymentStatus: 'unpaid'
};
const invoice2pm = {
  id: 'inv-2pm',
  appointmentId: 'appt-2pm',
  invoiceNumber: 'INV-B',
  paymentStatus: 'unpaid'
};

// Test
const result = await validatePatientConsultationAccess('patient-1');

// Assert
expect(result.allowed).toBe(false);
expect(result.reason).toBe('unpaid_balance');
expect(result.latestInvoice?.invoiceNumber).toBe('INV-A'); // 10 AM appointment invoice
```

---

### Test 7: End-to-End Returning Patient Scenario

**Objective**: Verify the complete flow for a returning patient with old paid and new pending appointments

**Scenario**:
1. Patient completed booking on 04/20/26 (paid) ✓
2. Patient books new appointment on 04/27/26 (unpaid) 
3. Doctor scans QR on 04/27/26
4. System should validate against 04/27 pending invoice, not 04/20 paid one
5. Access denied (payment pending)
6. Payment marked via receipt scan
7. Trigger auto-updates appointment to 'confirmed'
8. Doctor scans QR again
9. Access allowed

**Setup**:
```typescript
// Old appointment (04/20)
const oldAppointment = {
  id: 'old-appt',
  patientId: 'patient-1',
  scheduledAt: '2026-04-20T10:00:00Z',
  status: 'completed'
};
const oldInvoice = {
  id: 'old-inv',
  appointmentId: 'old-appt',
  invoiceNumber: 'INV-OLD',
  paymentStatus: 'paid', // Paid in past
  total: 150
};
const oldBooking = {
  id: 'old-booking',
  patientId: 'patient-1',
  preferredDate: '2026-04-20',
  paymentStatus: 'paid'
};

// New appointment (04/27)
const newAppointment = {
  id: 'new-appt',
  patientId: 'patient-1',
  scheduledAt: '2026-04-27T14:00:00Z',
  status: 'scheduled'
};
const newInvoice = {
  id: 'new-inv',
  appointmentId: 'new-appt',
  invoiceNumber: 'INV-NEW',
  paymentStatus: 'unpaid', // Pending for new appointment
  total: 150
};
const newBooking = {
  id: 'new-booking',
  patientId: 'patient-1',
  receiptCode: 'RECEIPT-TEST',
  preferredDate: '2026-04-27',
  appointmentId: 'new-appt',
  paymentStatus: 'pending_cashier'
};
```

**Test Steps**:
```typescript
// Step 1: Doctor scans QR on 04/27
let result = await validatePatientConsultationAccess('patient-1');
expect(result.allowed).toBe(false); // Unpaid new booking
expect(result.reason).toBe('unpaid_balance');
expect(result.latestInvoice?.invoiceNumber).toBe('INV-NEW'); // New invoice, not old

// Step 2: Payment marked via receipt scan
await markBookingPaidAndCreateInvoiceLiveOrDemo('RECEIPT-TEST');

// Verify appointment was updated by trigger
const updatedAppointment = await getAppointmentById('new-appt');
expect(updatedAppointment.status).toBe('confirmed'); // Trigger auto-updated

// Step 3: Doctor scans QR again
result = await validatePatientConsultationAccess('patient-1');
expect(result.allowed).toBe(true); // Now paid
expect(result.reason).toBe('paid');
```

---

## Manual Testing Checklist

- [ ] Deploy migration with trigger to Supabase
- [ ] Test 1: Trigger updates appointment on payment status change ✓
- [ ] Test 2: Trigger handles NULL appointment_id safely ✓
- [ ] Test 3: Trigger respects safety check (scheduled → confirmed only) ✓
- [ ] Test 4: Query filters by appointmentId correctly ✓
- [ ] Test 5: Query backward compatible without appointmentId ✓
- [ ] Test 6: Consultation access validates correct appointment ✓
- [ ] Test 7: End-to-end returning patient scenario ✓
- [ ] Verify no regression: existing one-time patient flow still works
- [ ] Verify demo/mock mode (isSupabaseConfigured=false) works

---

## Integration with Demo Mode

The refactored `getLatestInvoiceByPatientIdLiveOrDemo()` already handles the mock layer correctly:

**Mock Implementation** (in supabase-clinic.ts):
```typescript
if (!isSupabaseConfigured) {
  let invoices = getDatabase().invoices
    .filter((invoice) => invoice.patientId === patientId);
  
  if (appointmentId) {
    invoices = invoices.filter((invoice) => invoice.appointmentId === appointmentId);
  }
  
  const latest = invoices.sort(...)[0];
  return latest ?? null;
}
```

**Demo Testing**:
- [ ] Disable Supabase configuration (set `isSupabaseConfigured=false`)
- [ ] Run Test 4 (appointment-specific invoice lookup)
- [ ] Verify demo mode returns same results as Supabase mode

---

## PostgreSQL Trigger Verification

To verify the trigger exists and is active:

```sql
-- List all triggers on invoices table
SELECT trigger_name, event_type, function_name
FROM information_schema.triggers
WHERE event_object_table = 'invoices'
  AND event_object_schema = 'public';

-- Expected output:
-- tr_sync_payment_to_appointment_status | UPDATE | sync_payment_to_appointment_status
```

---

## Rollback Plan

If the trigger causes issues, disable it temporarily:

```sql
-- Disable trigger
ALTER TABLE public.invoices DISABLE TRIGGER tr_sync_payment_to_appointment_status;

-- Re-enable trigger
ALTER TABLE public.invoices ENABLE TRIGGER tr_sync_payment_to_appointment_status;

-- Drop trigger completely (if needed)
DROP TRIGGER tr_sync_payment_to_appointment_status ON public.invoices;
```

---

## Performance Notes

- The trigger uses an indexed foreign key lookup (`appointments.id`)
- The migration adds an optional index on `invoices.appointment_id`
- Query performance improved due to more specific WHERE clauses
- No N+1 issues: trigger doesn't loop or fetch multiple rows

---

## Deployment Checklist

1. **Development**:
   - [ ] Run all test cases locally
   - [ ] Verify trigger fires as expected
   - [ ] Test fallback behavior (no appointmentId)

2. **Staging**:
   - [ ] Deploy migration to staging Supabase
   - [ ] Run full integration tests
   - [ ] Verify with actual QR scanning flow

3. **Production**:
   - [ ] Schedule deployment during low-traffic window
   - [ ] Deploy migration (creates trigger)
   - [ ] Monitor logs for errors
   - [ ] Have rollback script ready
   - [ ] Run sanity checks (existing paid invoices still work)
   - [ ] Test with real patient returning scenario

---

## Success Criteria

✅ Returning patients cannot proceed with old paid invoices  
✅ New pending invoices block access correctly  
✅ Payment status changes automatically trigger appointment confirmation  
✅ QR validation correctly identifies which appointment is "current"  
✅ No errors when invoice lacks appointment link  
✅ Demo mode works identically to Supabase mode  
✅ All existing workflows continue to function
