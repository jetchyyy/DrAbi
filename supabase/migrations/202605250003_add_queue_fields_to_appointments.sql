-- =============================================================================
-- Migration: Add queue fields to appointments
-- =============================================================================

alter table public.appointments
  add column if not exists queue_number text,
  add column if not exists estimated_end time;
