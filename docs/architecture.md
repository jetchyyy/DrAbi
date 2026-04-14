# Architecture

## Project structure

```text
src/
  app/                  # global providers and query client
  components/
    forms/              # form wrappers
    layout/             # app shell, public layout, settings layout
    ui/                 # reusable UI primitives
  config/               # clinic config, navigation, permissions
  data/                 # seeded local demo data
  features/
    appointments/
    auth/
    billing/
    booking/
    dashboard/
    inventory/
    laboratory/
    patients/
    settings/
    shared/
  lib/                  # local data store, query keys, Supabase client, helpers
  routes/               # router and guards
  types/                # domain types and Supabase DB types
supabase/
  migrations/           # SQL schema and RLS policies
  seed.sql              # development seed data
docs/
  architecture.md       # route map, RBAC, schema strategy
```

## Route map

### Public portal
- `/portal`
- `/portal/book`
- `/portal/my-bookings`

### Auth
- `/login`
- `/forgot-password`
- `/reset-password`

### Internal app
- `/app/dashboard`
- `/app/patients`
- `/app/patients/:patientId`
- `/app/appointments`
- `/app/consultations`
- `/app/billing`
- `/app/inventory`
- `/app/laboratory`
- `/app/settings/clinic`
- `/app/settings/catalog`
- `/app/settings/users`
- `/app/settings/support`

## Role and permission model

### Roles
- `owner_admin`
- `doctor`
- `nurse_staff`
- `front_desk_cashier`
- `lab_staff`
- `inventory_staff`
- `patient`

### Permission groups
- Dashboard: `dashboard.view`
- Patients: `patients.view`, `patients.manage`
- Appointments: `appointments.view`, `appointments.manage`, `consultations.manage`
- Billing: `billing.view`, `billing.manage`
- Inventory: `inventory.view`, `inventory.manage`
- Laboratory: `laboratory.view`, `laboratory.manage`
- Settings: `settings.view`, `settings.manage`, `users.manage`
- Booking portal: `booking.view`, `booking.manage`

The frontend uses a static permission matrix for clarity and speed, while the Supabase schema includes `roles`, `permissions`, and `role_permissions` tables so the model can move server-side later without reshaping the app.

Custom access roles used by Settings are stored separately from `profiles.role`. The assigned access role controls permissions, while `profiles.role` remains the canonical staff type for route guards and doctor-specific workflows.

## Data design notes

- Single-clinic runtime behavior only.
- White-label readiness comes from central `clinic_settings`, theme variables, service catalog records, specialty records, and booking rules instead of hardcoded business values.
- Bookings are distinct from appointments so patient requests can be reviewed, rescheduled, confirmed, or declined by staff.
- Medical records are split across `patients`, `appointments`, `consultations`, `prescriptions`, `lab_orders`, `lab_results`, and `file_uploads`.
- Billing is split into `invoices`, `invoice_items`, and `payments`.
- Inventory is split into `inventory_categories`, `inventory_items`, `stock_transactions`, and `suppliers`.
- Auditability is supported with `audit_logs`, timestamps, and `deleted_at` soft-delete columns.

## Supabase strategy

- Auth: Supabase Auth for staff and patient sign-in.
- Database: PostgreSQL with normalized tables and enums.
- RLS: patient self-access, staff role access, and public read for booking-facing catalog data.
- Storage: intended for file uploads and lab result attachments.
- Realtime: useful for queue boards, appointment updates, and lab status transitions.
- Edge Functions: reserved for high-trust server-side workflows such as payment reconciliation, receipt generation, or notification fan-out.

## Demo mode

The frontend ships with a local typed demo datastore so the platform can run immediately before Supabase keys are configured. The code is already split around a Supabase client and query layer, so live queries can replace the local adapters feature by feature.

