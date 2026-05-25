import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const ARCHIVE_DIR = path.join(MIGRATIONS_DIR, 'archive');
const BASELINE_FILE_NAME = '202605250000_baseline_schema.sql';
const BASELINE_PATH = path.join(MIGRATIONS_DIR, BASELINE_FILE_NAME);

// SQL to append for master data & initial setup
const MASTER_DATA_SQL = `

-- ============================================================================
-- SYSTEM MASTER & BOOTSTRAP DATA SEED (ADDED FOR FRESH SETUP)
-- ============================================================================

-- 1. Create Default Storage Buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('lab-request-attachments', 'lab-request-attachments', true),
  ('hmo-documents', 'hmo-documents', false),
  ('hmo-claims', 'hmo-claims', false),
  ('hmo-authorizations', 'hmo-authorizations', false),
  ('soa-pdfs', 'soa-pdfs', false),
  ('patient-files', 'patient-files', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Populate Access Roles
INSERT INTO public.access_roles (system_key, name, description, permission_codes, is_system)
VALUES
  (
    'owner_admin',
    'Owner / Admin',
    'Full system access for the clinic owner or administrator.',
    array[
      'dashboard.view',
      'patients.view',
      'patients.manage',
      'appointments.view',
      'appointments.manage',
      'consultations.manage',
      'billing.view',
      'billing.manage',
      'inventory.view',
      'inventory.manage',
      'laboratory.view',
      'laboratory.manage',
      'settings.view',
      'settings.manage',
      'booking.view',
      'booking.manage',
      'users.manage'
    ],
    true
  ),
  (
    'doctor',
    'Doctor',
    'Clinical access for providers handling consultations and patient review.',
    array[
      'dashboard.view',
      'patients.view',
      'appointments.view',
      'consultations.manage',
      'laboratory.view',
      'booking.view'
    ],
    true
  ),
  (
    'nurse_staff',
    'Nurse / Staff',
    'Care-team access for patient intake, appointments, and consultation support.',
    array[
      'dashboard.view',
      'patients.view',
      'patients.manage',
      'appointments.view',
      'appointments.manage',
      'consultations.manage',
      'laboratory.view'
    ],
    true
  ),
  (
    'front_desk_cashier',
    'Front Desk / Cashier',
    'Reception and payment access for scheduling, billing, and bookings.',
    array[
      'dashboard.view',
      'patients.view',
      'patients.manage',
      'appointments.view',
      'appointments.manage',
      'billing.view',
      'billing.manage',
      'booking.view',
      'booking.manage'
    ],
    true
  ),
  (
    'lab_staff',
    'Lab Staff',
    'Laboratory operations access for sample processing and result handling.',
    array[
      'dashboard.view',
      'patients.view',
      'laboratory.view',
      'laboratory.manage'
    ],
    true
  ),
  (
    'inventory_staff',
    'Inventory Staff',
    'Stock and supply access for inventory monitoring and updates.',
    array[
      'dashboard.view',
      'inventory.view',
      'inventory.manage'
    ],
    true
  )
ON CONFLICT (system_key) DO UPDATE
SET
  name = excluded.name,
  description = excluded.description,
  permission_codes = excluded.permission_codes,
  is_system = excluded.is_system,
  updated_at = timezone('utc', now());

-- 3. Initialize Default Clinic Setup (Main Clinic)
INSERT INTO public.clinics (name)
SELECT 'Main Clinic'
WHERE NOT EXISTS (
	SELECT 1
	FROM public.clinics
);

-- 4. Initialize Default Laboratory Service (CBC)
INSERT INTO public.medical_services (
	clinic_id,
	department,
	category,
	name,
	description,
	service_fee,
	estimated_duration_minutes,
	is_active
)
SELECT
	c.id,
	'Laboratory',
	'Routine',
	'CBC',
	'Complete blood count',
	0,
	30,
	true
FROM public.clinics c
WHERE NOT EXISTS (
	SELECT 1
	FROM public.medical_services ms
	WHERE ms.department = 'Laboratory'
)
LIMIT 1;
`;

console.log('=== Supabase Migration Squasher ===');
console.log('This script will generate a consolidated schema baseline from your linked remote database.');

rl.question('Please enter your remote database password: ', (password) => {
  if (!password || password.trim() === '') {
    console.error('Error: Database password is required.');
    rl.close();
    process.exit(1);
  }

  try {
    console.log('\nStep 1: Running Supabase CLI db dump...');
    
    // Command to run the db dump. We use --linked to dump the linked project's schema.
    // Wrap database password in double quotes to handle special characters.
    const escapedPassword = password.replace(/"/g, '\\"');
    const dumpCmd = `npx supabase db dump --linked -f "${BASELINE_PATH}" -p "${escapedPassword}"`;
    
    // Run the dump command
    execSync(dumpCmd, { stdio: 'inherit', shell: true });
    console.log('✓ Database schema successfully dumped.');

    console.log('\nStep 2: Appending system master & seed data...');
    if (fs.existsSync(BASELINE_PATH)) {
      fs.appendFileSync(BASELINE_PATH, MASTER_DATA_SQL, 'utf8');
      console.log('✓ System access roles, storage buckets, and default clinic setup appended to baseline.');
    } else {
      throw new Error('Baseline SQL file was not found after dump.');
    }

    console.log('\nStep 3: Archiving older migrations...');
    if (!fs.existsSync(ARCHIVE_DIR)) {
      fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    }

    const files = fs.readdirSync(MIGRATIONS_DIR);
    let archivedCount = 0;

    files.forEach((file) => {
      // Archive other SQL files that match migration format (starts with digits)
      if (file !== BASELINE_FILE_NAME && /^\d+.*\.sql$/.test(file)) {
        const oldPath = path.join(MIGRATIONS_DIR, file);
        const newPath = path.join(ARCHIVE_DIR, file);
        fs.renameSync(oldPath, newPath);
        archivedCount++;
      }
    });

    console.log(`✓ Archived ${archivedCount} older migrations to: supabase/migrations/archive/`);
    console.log('\n======================================');
    console.log('SUCCESS: Database Baselining Complete!');
    console.log(`Consolidated file created: supabase/migrations/${BASELINE_FILE_NAME}`);
    console.log('You can now use this file in the SQL Editor of new Supabase projects.');
    console.log('======================================');

  } catch (error) {
    console.error('\n❌ Error occurred during baselining:', error.message);
  } finally {
    rl.close();
  }
});
