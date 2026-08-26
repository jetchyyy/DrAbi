-- Migration: Add is_superadmin column to profiles
-- Date: 2026-07-27

BEGIN;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
