ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS system_status_type text DEFAULT 'maintenance';
