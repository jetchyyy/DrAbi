# Doctor -> Patient -> Specialist Flow Migration Guide (React Web + Supabase)

Date: 2026-04-13

## Goal
This document analyzes the current Firebase-based flow from:
1. doctor -> patient, then
2. patient -> specialist (via referral),

and provides implementation instructions to migrate it to a React web app backed by Supabase.

This guide preserves your zero-redundancy principle:
- doctor-patient relationship derived from appointments
- doctor-specialist relationship derived from referrals
- chat threads store only messaging metadata

## Current Flow Analysis (As-Is)

## 1) Doctor -> Patient Flow

### 1.1 Relationship Source of Truth
- Primary node: `appointments`
- Relationship key: `doctorId` + `patientId`
- Doctor patient list is derived from appointments plus clinic activity, not a separate relationship table.

Implementation references:
- `src/screens/DepartmentsScreen/DoctorScreens/hooks/usePatients.js`
- `src/screens/DepartmentsScreen/DoctorScreens/PatientListScreen.js`

### 1.2 Doctor Entry Points
- From patient list, doctor can:
  - open medical records
  - open patient history
  - open chat thread
  - refer to specialist

Implementation reference:
- `src/screens/DepartmentsScreen/DoctorScreens/PatientListScreen.js`

### 1.3 Consultation Save Behavior
When doctor saves consultation:
1. create consultation entry in `patientMedicalHistory/{patientId}/entries`
2. if `appointmentId` exists, update `appointments/{appointmentId}` with:
   - `status = completed`
   - consultation link fields
3. create `medicalServicesTransactions` record for audit and professional fee

Implementation reference:
- `src/screens/DepartmentsScreen/DeptComponents/components/medical-records/hooks/useConsultationSave.enhanced.js`

### 1.4 Chat Availability (Doctor-Patient)
Chat contacts are derived from appointments where:
- `appointment.doctorId == currentUserId`
- `status in [confirmed, completed]`

Then patient profile is fetched from `patients/{patientId}`.

Implementation references:
- `src/screens/Chat/ChatsScreen.js`
- `src/screens/Chat/utils/chatContactManager.js`

## 2) Patient -> Specialist Flow (Referral)

### 2.1 Referral Trigger Paths
Two trigger paths exist:
1. Direct from patient list via `SpecialistSelection`
2. From consultation actions (`handleReferToSpecialist`) after consultation save

Implementation references:
- `src/screens/DepartmentsScreen/DoctorScreens/PatientListScreen.js`
- `src/screens/DepartmentsScreen/DeptComponents/hooks/useActionHandlers.js`

### 2.2 Specialist Selection
The app loads `doctors`, filters out generalist doctors, and shows specialist choices.

Implementation reference:
- `src/screens/DepartmentsScreen/ReferralScreens/SpecialistSelectionScreen.js`

### 2.3 Schedule + Referral Creation
`ScheduleSelectionScreen`:
1. loads `specialistSchedules/{specialistId}`
2. computes date availability
3. checks booked slots in `specialistAppointments/{specialistId}`
4. creates referral in `referrals/{referralId}` with status `pending`
5. updates originating appointment `relatedReferralId`
6. marks specialist slot booked at `specialistAppointments/...` with `status = confirmed`

Implementation reference:
- `src/screens/DepartmentsScreen/ReferralScreens/ScheduleSelectionScreen.js`

### 2.4 Chat Availability (Doctor-Specialist)
Contacts derived from referrals where current user is either:
- `referringGeneralistId`, or
- `assignedSpecialistId`

and status in practice is checked against:
- `accepted`, `completed`, or `confirmed` in chat list screens

Note: `handleReferralAccepted` utility currently only auto-creates thread when status is exactly `accepted`.

Implementation references:
- `src/screens/Chat/ChatsScreen.js`
- `src/screens/Chat/utils/chatContactManager.js`

## 3) Noted Data/Behavior Inconsistencies to Fix During Migration

1. Referral status vocabulary drift
- Some code expects only `accepted` for chat thread creation utility.
- Chat list derivation accepts `accepted|completed|confirmed`.

2. Referral field naming drift across docs/code
- Examples include `referringDoctorId/specialistId` and `referringGeneralistId/assignedSpecialistId`.
- Migrate with one canonical naming standard.

3. Cross-node write atomicity
- Current flow writes referral, appointment link, and specialist slot as separate writes.
- In Supabase, use transactional RPC to keep these consistent.

4. Thread creation timing
- Current behavior is partly implicit and partly utility-driven.
- Use DB trigger/RPC in Supabase so thread creation is deterministic.

## Target Supabase Architecture (To-Be)

## 1) Canonical Tables

Use UUID primary keys and `timestamptz` audit fields.

1. `profiles`
- `id uuid pk` (auth user id)
- `role text` (`doctor`, `specialist`, `patient`, `admin`)
- `first_name`, `last_name`, `middle_name`

2. `appointments`
- `id uuid pk`
- `clinic_id uuid`
- `patient_id uuid -> profiles.id`
- `doctor_id uuid -> profiles.id`
- `appointment_date date`
- `appointment_time time`
- `status text check (status in ('pending','confirmed','completed','cancelled'))`
- `related_referral_id uuid null`
- `consultation_id uuid null`
- `completed_at timestamptz null`
- `completed_by uuid null`
- `created_at`, `updated_at`

3. `consultations`
- `id uuid pk`
- `patient_id uuid`
- `provider_id uuid`
- `appointment_id uuid null`
- `type text`
- `clinical_summary text`
- `soap_notes jsonb`
- `diagnosis jsonb`
- `prescriptions jsonb`
- `present_illness_history text`
- `findings jsonb`
- `treatment_plan text`
- `created_at`, `updated_at`

4. `service_transactions`
- `id uuid pk`
- `clinic_id uuid`
- `patient_id uuid`
- `requested_by uuid`
- `service_category text`
- `service_name text`
- `service_id text`
- `transaction_type text`
- `status text`
- `result_status text`
- `sample_status text`
- `professional_fee numeric(12,2)`
- `notes text`
- `created_at`, `updated_at`

5. `referrals`
- `id uuid pk`
- `patient_id uuid`
- `source_appointment_id uuid null`
- `source_consultation_id uuid null`
- `referring_generalist_id uuid`
- `assigned_specialist_id uuid`
- `appointment_date date null`
- `appointment_time time null`
- `reason text`
- `generalist_notes text`
- `status text check (status in ('pending','accepted','confirmed','completed','declined','cancelled'))`
- `practice_location jsonb`
- `specialist_schedule_id uuid null`
- `created_at`, `updated_at`

6. `specialist_schedules`
- `id uuid pk`
- `specialist_id uuid`
- `recurrence jsonb`
- `slot_template jsonb`
- `is_active boolean`
- `valid_from date`
- `practice_location jsonb`
- `created_at`, `updated_at`

7. `specialist_appointments`
- `id uuid pk`
- `specialist_id uuid`
- `schedule_id uuid`
- `referral_id uuid`
- `patient_id uuid`
- `slot_date date`
- `slot_time time`
- `is_booked boolean`
- `status text`
- unique key: `(specialist_id, schedule_id, slot_date, slot_time)`

8. `chat_threads`
- `id uuid pk`
- `participant_a uuid`
- `participant_b uuid`
- `thread_key text unique` (sorted pair: `minId_maxId`)
- `type text default 'direct'`
- `linked_appointment_id uuid null`
- `linked_referral_id uuid null`
- `last_message_text text null`
- `last_message_at timestamptz null`
- `created_at`, `updated_at`

9. `messages`
- `id uuid pk`
- `thread_id uuid -> chat_threads.id`
- `sender_id uuid`
- `text text`
- `sent_at timestamptz`
- `read_at timestamptz null`

10. `thread_unread`
- `thread_id uuid`
- `user_id uuid`
- `unread_count int`
- primary key `(thread_id, user_id)`

## 2) Required RPCs / Transactions

Implement these Postgres functions and call via Supabase RPC.

1. `create_referral_with_slot_lock(...)`
- Validates slot availability
- Inserts `referrals`
- Updates `appointments.related_referral_id`
- Inserts or updates `specialist_appointments`
- All in one transaction

2. `complete_consultation_and_appointment(...)`
- Inserts `consultations`
- Updates `appointments.status='completed'` and links consultation
- Inserts `service_transactions`
- All in one transaction

3. `ensure_direct_thread(participant_1, participant_2, linked_referral_id?, linked_appointment_id?)`
- Upserts deterministic direct thread by `thread_key`

## 3) Trigger Rules

1. Appointment trigger
- On `appointments` status update to `confirmed` or `completed`:
  - call `ensure_direct_thread(doctor_id, patient_id, linked_appointment_id := id)`

2. Referral trigger
- On `referrals` status update to one of `accepted|confirmed|completed`:
  - call `ensure_direct_thread(referring_generalist_id, assigned_specialist_id, linked_referral_id := id)`

This eliminates timing drift between UI screens and chat availability.

## 4) RLS Policy Blueprint

Enable RLS on all clinical tables. Minimum policy intent:

1. Appointments
- Doctor can select/update own appointments (`doctor_id = auth.uid()`)
- Patient can select own appointments (`patient_id = auth.uid()`)

2. Consultations
- Provider who created can read/update
- Patient can read own
- Referred specialist can read if linked through referral and policy allows

3. Referrals
- Referring generalist and assigned specialist can read/update status
- Patient can read own referral summary

4. Chat
- User can read/write threads/messages only when they are participant

5. Schedules
- Specialist manages own schedules
- Doctors can read schedules for referral booking

## React Web Migration Instructions

## 1) Project Layering

Create modules:
1. `src/features/appointments/`
2. `src/features/consultations/`
3. `src/features/referrals/`
4. `src/features/chat/`
5. `src/lib/supabase/`

In each feature:
- `api/` for Supabase calls
- `hooks/` for React Query hooks
- `components/` for UI
- `types.ts`

## 2) Service Contracts (Web)

1. `consultationService`
- `submitConsultation(payload)` -> calls RPC `complete_consultation_and_appointment`

2. `referralService`
- `createReferral(payload)` -> calls RPC `create_referral_with_slot_lock`
- `updateReferralStatus(referralId, status)`

3. `chatService`
- `getDerivedContacts(userId)`:
  - patients from appointments (`confirmed|completed`)
  - specialists from referrals (`accepted|confirmed|completed`)
- `openOrCreateThread(contactId)` -> `ensure_direct_thread`

## 3) Route Mapping (Suggested)

1. `/doctor/patients`
- list derived patients by clinic/doctor

2. `/doctor/patients/:patientId/consultation`
- 6-step consultation form

3. `/doctor/patients/:patientId/refer`
- specialist selection -> schedule slot -> create referral

4. `/chat`
- derived contacts + thread previews

5. `/chat/:threadId`
- realtime message thread

## 4) Data Fetching Pattern

Use React Query + Supabase client.
- Query keys:
  - `['appointments', doctorId, clinicId]`
  - `['patient-consultations', patientId]`
  - `['referrals', userId]`
  - `['chat-contacts', userId]`
- Mutations invalidate affected keys.

## 5) Realtime Pattern

Use Supabase Realtime channels for:
- `messages` inserts
- `chat_threads` updates
- `appointments` status updates (optional for live dashboard)
- `referrals` status updates

## Firebase -> Supabase Mapping

1. `appointments/{id}` -> `appointments`
2. `patientMedicalHistory/{patientId}/entries/{id}` -> `consultations`
3. `medicalServicesTransactions/{id}` -> `service_transactions`
4. `referrals/{id}` -> `referrals`
5. `specialistSchedules/{specialistId}` -> `specialist_schedules`
6. `specialistAppointments/{specialistId}/...` -> `specialist_appointments`
7. `chatThreads/{threadId}` -> `chat_threads`
8. `messages/{threadId}/{msgId}` -> `messages`

## Migration Execution Plan

## Phase 1: Schema + Security
1. Create all tables and constraints.
2. Add enum/check constraints for statuses.
3. Enable RLS and add baseline policies.
4. Add indexes:
   - appointments: `(doctor_id, status, appointment_date)`
   - referrals: `(referring_generalist_id, status)` and `(assigned_specialist_id, status)`
   - chat_threads: `thread_key unique`
   - messages: `(thread_id, sent_at desc)`

## Phase 2: Data Backfill
1. Export Firebase nodes.
2. Transform field names to canonical schema.
3. Resolve identity mapping Firebase uid -> Supabase auth uid.
4. Import in this order:
   - profiles
   - appointments
   - consultations
   - service_transactions
   - referrals
   - specialist schedules/slots
   - chat threads/messages

## Phase 3: Dual-Write (Short Window)
1. Keep Firebase as read fallback.
2. Write new records to Supabase first.
3. Reconcile counts and spot-check records.
4. Switch reads feature-by-feature:
   - patient list
   - consultation
   - referral
   - chat

## Phase 4: Cutover + Cleanup
1. Disable Firebase writes.
2. Keep read-only snapshot for audit fallback.
3. Remove deprecated adapters and dead code.

## Parity Test Checklist

1. Doctor sees patient in list after confirmed appointment.
2. Saving consultation marks appointment completed and links consultation.
3. Service transaction created for consultation save.
4. Referral creation locks slot and links source appointment.
5. Referral status transition to accepted/confirmed enables specialist chat contact.
6. Thread key remains deterministic for same user pair.
7. Unread counters increment/decrement correctly.
8. RLS blocks unauthorized record access.

## Recommended Canonical Decisions (Make Before Build)

1. Use one referral status state machine:
- `pending -> accepted -> completed`
- optional branches: `declined`, `cancelled`
- keep `confirmed` only if it has a distinct business meaning.

2. Use one referral actor naming convention:
- `referring_generalist_id`
- `assigned_specialist_id`

3. Keep relationship derivation query-based.
- Do not add redundant contact tables.

4. Move multi-write business logic to SQL RPC.
- Do not split critical writes across independent client calls.

## Deliverables You Should Build First

1. SQL migration file creating all core tables and indexes.
2. SQL file for RPCs and triggers.
3. `supabaseClient` setup for web.
4. `consultationService`, `referralService`, `chatService` with typed DTOs.
5. React Query hooks for appointments/referrals/chat contacts.
6. One end-to-end pilot flow:
- doctor opens patient -> saves consultation -> creates referral -> specialist accepts -> chat appears.
