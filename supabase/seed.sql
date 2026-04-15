-- Idempotent baseline seed for single-clinic setup.
-- Safe to run multiple times.

insert into public.clinics (name)
select 'Main Clinic'
where not exists (
	select 1
	from public.clinics
);

with first_clinic as (
	select id
	from public.clinics
	order by created_at asc
	limit 1
)
update public.profiles p
set
	clinic_id = fc.id,
	updated_at = timezone('utc', now())
from first_clinic fc
where p.clinic_id is null
	and p.deleted_at is null
	and p.role in (
		'owner_admin'::public.app_role,
		'doctor'::public.app_role,
		'nurse_staff'::public.app_role,
		'front_desk_cashier'::public.app_role,
		'lab_staff'::public.app_role,
		'inventory_staff'::public.app_role
	);

insert into public.medical_services (
	clinic_id,
	department,
	category,
	name,
	description,
	service_fee,
	estimated_duration_minutes,
	is_active
)
select
	c.id,
	'Laboratory',
	'Routine',
	'CBC',
	'Complete blood count',
	0,
	30,
	true
from public.clinics c
where not exists (
	select 1
	from public.medical_services ms
	where ms.department = 'Laboratory'
);
