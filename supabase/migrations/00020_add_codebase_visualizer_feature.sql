-- ==============================================================================
-- Migration 00020: Add Codebase Architecture Visualizer Feature Flag
-- Description: Updates public.system_configurations control_features JSONB
-- to include enable_codebase_visualizer flag.
-- ==============================================================================

UPDATE public.system_configurations
SET control_features = control_features || '{"enable_codebase_visualizer": true}'::jsonb
WHERE id = 'global_config';
