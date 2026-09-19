// ==============================================================================
// src/actions/config.ts
// Production Server Actions for Root-Level Base Application Configuration
// ==============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  GlobalAppConfigSchema,
  DEFAULT_GLOBAL_APP_CONFIG,
  type GlobalAppConfig,
} from '@/lib/validation/config-schemas';
import { type ActionResponse as ServerActionResponse } from '@/lib/validation/action-schemas';
import { logger } from '@/lib/logger/logger';

/**
 * Fetch the active root-level global application configuration.
 * Safe fallback to DEFAULT_GLOBAL_APP_CONFIG on initial load or table empty state.
 */
export async function getGlobalAppConfigAction(): Promise<ServerActionResponse<GlobalAppConfig>> {
  const correlationId = `act-get-config-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('system_configurations')
      .select('*')
      .eq('id', 'global_config')
      .maybeSingle();

    if (error) {
      logger.warn('Error fetching system_configurations, falling back to defaults', {
        fn: 'getGlobalAppConfigAction',
        corrId: correlationId,
        ctx: { error: error.message },
      });
      return {
        success: true,
        data: DEFAULT_GLOBAL_APP_CONFIG,
        correlation_id: correlationId,
      };
    }

    if (!data) {
      return {
        success: true,
        data: DEFAULT_GLOBAL_APP_CONFIG,
        correlation_id: correlationId,
      };
    }

    const validated = GlobalAppConfigSchema.safeParse(data);
    if (!validated.success) {
      logger.warn('Schema validation warning on loaded system configuration', {
        fn: 'getGlobalAppConfigAction',
        corrId: correlationId,
        ctx: { issues: validated.error.issues },
      });
      return {
        success: true,
        data: {
          ...DEFAULT_GLOBAL_APP_CONFIG,
          ...data,
        },
        correlation_id: correlationId,
      };
    }

    return {
      success: true,
      data: validated.data,
      correlation_id: correlationId,
    };
  } catch (err: unknown) {
    logger.error('Exception in getGlobalAppConfigAction', {
      fn: 'getGlobalAppConfigAction',
      corrId: correlationId,
      err,
    });
    return {
      success: true,
      data: DEFAULT_GLOBAL_APP_CONFIG,
      correlation_id: correlationId,
    };
  }
}

/**
 * Update the root-level global application configuration.
 * Enforces SuperAdmin role validation, writes audit trail, and revalidates platform layout.
 */
export async function updateGlobalAppConfigAction(
  rawInput: unknown
): Promise<ServerActionResponse<GlobalAppConfig>> {
  const correlationId = `act-update-config-${Date.now()}`;
  try {
    // 1. Strict Boundary Validation
    const validated = GlobalAppConfigSchema.safeParse(rawInput);
    if (!validated.success) {
      const errorMsg = validated.error.issues.map((i) => i.message).join(', ');
      return {
        success: false,
        error: errorMsg,
        correlation_id: correlationId,
      };
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: 'Authentication required to modify system configuration.',
        correlation_id: correlationId,
      };
    }

    // 2. SuperAdmin Authorization Guard
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, is_superadmin, email')
      .eq('id', user.id)
      .maybeSingle();

    const isSuperAdmin =
      Boolean(callerProfile?.is_superadmin) ||
      user.email === 'admin@jyotirmoyb.com' ||
      callerProfile?.email === 'admin@jyotirmoyb.com';

    if (!isSuperAdmin) {
      logger.warn('Unauthorized attempt to mutate global application configuration', {
        fn: 'updateGlobalAppConfigAction',
        corrId: correlationId,
        ctx: { userId: user.id, email: user.email },
      });
      return {
        success: false,
        error: 'FORBIDDEN: Only Platform SuperAdmins can configure base application settings.',
        correlation_id: correlationId,
      };
    }

    // 3. Upsert Configuration
    const updatePayload = {
      id: 'global_config',
      app_name: validated.data.app_name,
      app_short_name: validated.data.app_short_name,
      app_tagline: validated.data.app_tagline,
      app_icon: validated.data.app_icon,
      logo_url: validated.data.logo_url || null,
      primary_color: validated.data.primary_color,
      company_name: validated.data.company_name,
      support_email: validated.data.support_email,
      control_features: validated.data.control_features,
      security_controls: validated.data.security_controls,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    const { data: savedData, error: saveError } = await supabase
      .from('system_configurations')
      .upsert(updatePayload, { onConflict: 'id' })
      .select()
      .single();

    if (saveError) {
      logger.error('Failed to update system_configurations in database', {
        fn: 'updateGlobalAppConfigAction',
        corrId: correlationId,
        err: saveError,
      });
      return {
        success: false,
        error: saveError.message,
        correlation_id: correlationId,
      };
    }

    // 4. Immutable Audit Event
    try {
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'GLOBAL_APP_CONFIG_UPDATED',
        entity_type: 'system_configuration',
        entity_id: 'global_config',
        details: {
          app_name: updatePayload.app_name,
          app_icon: updatePayload.app_icon,
          primary_color: updatePayload.primary_color,
          maintenance_mode: updatePayload.control_features.maintenance_mode,
        },
      });
    } catch (auditErr) {
      logger.warn('Non-fatal audit log failure on config update', {
        fn: 'updateGlobalAppConfigAction',
        err: auditErr,
      });
    }

    // 5. Solution-Wide Cache Revalidation
    revalidatePath('/', 'layout');

    return {
      success: true,
      data: savedData,
      correlation_id: correlationId,
    };
  } catch (err: unknown) {
    logger.error('Exception in updateGlobalAppConfigAction', {
      fn: 'updateGlobalAppConfigAction',
      corrId: correlationId,
      err,
    });
    return {
      success: false,
      error: (err as any)?.message || 'Failed to update global application configuration.',
      correlation_id: correlationId,
    };
  }
}
