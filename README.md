# Odyssey Clinic Platform

A full TypeScript clinic management scaffold built with React, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod, and Supabase-ready architecture.

## What is included

- Internal clinic management app for staff and administrators
- Patient-facing booking portal
- Typed role-based access control and protected routing
- White-label-ready clinic branding and settings model
- Typed local datastore so the UI can run before Supabase keys are configured
- Supabase SQL migration with normalized schema, timestamps, soft-delete fields, enums, and RLS policies
- Empty local/Supabase starting state for manual data entry during testing

## Stack

- React 19
- Vite
- TypeScript strict mode
- Tailwind CSS
- React Router
- TanStack Query
- React Hook Form + Zod
- Supabase JS client

## Quick start

1. Install dependencies:
   `npm install`
2. Copy environment variables:
   `copy .env.example .env`
3. Add your Supabase values to `.env`.
4. Start the app:
   `npm run dev`
5. Build or lint:
   `npm run build`
   `npm run lint`

## Local mode

If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not configured, the app runs in local mode with browser localStorage persistence. The local database now starts empty so records can be added manually during testing.
Use any email and a password with at least 6 characters in local mode.

## Supabase setup

1. Create a Supabase project.
2. Run the SQL in `supabase/migrations/202603250001_initial_schema.sql`.
3. Add your own test data manually. `supabase/seed.sql` is intentionally blank.
4. Create storage buckets such as `patient-files` if you plan to use file uploads immediately.
5. Create auth users for staff and patients, then populate `public.profiles` with matching `auth.users.id` values.

## Route overview

- Public portal: `/portal`, `/portal/book`, `/portal/my-bookings`
- Auth: `/login`, `/forgot-password`, `/reset-password`
- Internal app: `/app/dashboard`, `/app/patients`, `/app/appointments`, `/app/billing`, `/app/inventory`, `/app/laboratory`, `/app/settings/*`

## Architecture notes

- `src/config/clinic.ts` centralizes clinic identity and white-label-friendly settings.
- `src/config/permissions.ts` defines the frontend permission matrix.
- `src/lib/local-db.ts` provides a typed local persistence layer.
- `src/lib/supabase.ts` is the integration point for live Supabase auth and table queries.
- `docs/architecture.md` contains the folder structure, route map, RBAC summary, and schema strategy.

## Current implementation scope

The scaffold includes the full shell, routing, RBAC flow, branding/settings model, and CRUD-style screens for major modules. The frontend is production-oriented in structure, while some modules still use the local typed data adapter until you finish connecting each feature to your live Supabase project.


## ODC Superadmin Recovery

- Route: `/odc`
- Purpose: emergency superadmin console for system-wide disable and recovery messaging
- Operator access: provide a local key file such as `odc.key.json` based on `odc.key.example.json`
- Live Supabase security: the UI sends the key to the `odc-system-control` Edge Function, which validates it against the server-side `ODC_ACCESS_KEY` secret before updating `clinic_settings`
- Demo mode: if Supabase is not configured, `/odc` falls back to `VITE_ODC_DEMO_ACCESS_KEY`

Suggested deployment commands:

```bash
supabase secrets set ODC_ACCESS_KEY=your-strong-random-key
supabase functions deploy odc-system-control
```

Recovery password setup in Supabase SQL:

```sql
update public.clinic_settings
set odc_recovery_password_hash = encode(digest('your-password', 'sha256'), 'hex');
```

Run `supabase/migrations/202603250005_odc_recovery_password.sql` before using password-based recovery.
