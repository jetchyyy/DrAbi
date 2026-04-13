# Consultation Flow Migration Notes

## Redundancy Check

### Existing functions reviewed

- `createConsultationLiveOrDemo` in `src/lib/supabase-clinic.ts`
- `listAppointmentsByPatientIdLiveOrDemo` in `src/lib/supabase-clinic.ts`
- `listConsultationsByPatientIdLiveOrDemo` in `src/lib/supabase-clinic.ts`
- `useCreateConsultation` in `src/features/patients/hooks/use-patients.ts`
- Existing QR consultation entry in `src/features/patients/patient-qr-lookup-page.tsx`

### Existing fields and tables reviewed

- `public.appointments`
- `public.consultations`
- `public.doctors`
- `public.services`
- `public.bookings`
- Existing consultation expansion migration `202604110004_consultation_and_prescription_live_fields.sql`

### Reused items

- Reused `createConsultationLiveOrDemo` as the persistence method under a dedicated service layer.
- Reused current patient chart UI (`PatientDetailPage`) as the consultation page route target to avoid duplicate forms.
- Reused existing doctor profile mapping in `public.doctors` and exposed `public.providers` as a view to prevent duplicate provider records.
- Reused existing appointments and consultation list query functions for context loading.

### New items introduced and justification

- `consultationService`, `appointmentService`, `transactionService`:
  - Needed to satisfy the dedicated service layer requirement and prevent inline persistence logic in UI.
- `public.consultation_types`:
  - Needed as explicit consultation type catalog.
- `public.patient_medical_history_entries`:
  - Needed for normalized clinical history entries and audit trail.
- `public.medical_services_transactions`:
  - Needed for professional fee and consultation transaction records.
- `public.appointments` linkage fields (`consultation_id`, `completed_by`, `completed_at`):
  - Needed to persist completion linkage from appointment to consultation.
- `/app/consultation/:patientId` route and QR redirect update:
  - Needed to satisfy mandatory consultation initiation triggers from patient chart and QR workflow.
