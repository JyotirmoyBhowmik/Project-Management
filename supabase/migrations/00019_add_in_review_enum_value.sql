-- ==============================================================================
-- supabase/migrations/00019_add_in_review_enum_value.sql
-- Add 'in_review' to task_status_enum to prevent 22P02 invalid input errors
-- ==============================================================================

DO $$ 
BEGIN
    ALTER TYPE public.task_status_enum ADD VALUE IF NOT EXISTS 'in_review';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
