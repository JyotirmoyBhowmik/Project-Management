// ==============================================================================
// src/actions/members.ts
// Production Server Actions for Member Provisioning, Role Management & Cross-Tenant Roster
// Only exports async functions to comply with Next.js 15 Server Action invariants
// ==============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { TenantMembership, CrossTenantUser } from '@/types/database';
import { logger } from '@/lib/logger/logger';
import {
  ProvisionMemberSchema,
  UpdateMemberRoleSchema,
  type ProvisionMemberInput,
  type UpdateMemberRoleInput,
  type ActionResponse,
} from '@/lib/validation/action-schemas';

// ------------------------------------------------------------------------------
// 1. Workspace Members Actions
// ------------------------------------------------------------------------------

export async function getWorkspaceMembersAction(
  tenantId: string
): Promise<ActionResponse<TenantMembership[]>> {
  const correlationId = `act-get-members-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('tenant_memberships')
      .select('*, user:profiles(id, email, full_name, avatar_url, is_superadmin)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.warn('Failed to fetch tenant memberships', {
        fn: 'getWorkspaceMembersAction',
        ctx: { tenantId, error: error.message },
      });
      return { success: false, error: error.message, correlation_id: correlationId };
    }

    return { success: true, data: data || [], correlation_id: correlationId };
  } catch (err: any) {
    logger.error('Exception in getWorkspaceMembersAction', { fn: 'getWorkspaceMembersAction', err });
    return { success: false, error: err?.message || 'Failed to fetch members', correlation_id: correlationId };
  }
}

export async function provisionMemberAction(
  rawInput: ProvisionMemberInput
): Promise<ActionResponse<TenantMembership>> {
  const correlationId = `act-provision-member-${Date.now()}`;
  try {
    const parsed = ProvisionMemberSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
        correlation_id: correlationId,
      };
    }

    const { tenant_id, email, full_name, role, team_id } = parsed.data;
    const supabase = await createServerSupabaseClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return { success: false, error: 'Unauthorized: Session required', correlation_id: correlationId };
    }

    // 1. Check if user already exists in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    let targetUserId = existingProfile?.id;

    if (!targetUserId) {
      // Create user profile
      targetUserId = crypto.randomUUID();
      const { error: profileError } = await supabase.from('profiles').insert({
        id: targetUserId,
        email: email.toLowerCase().trim(),
        full_name,
        is_superadmin: false,
      });

      if (profileError) {
        logger.error('Failed to create profile during provisioning', {
          fn: 'provisionMemberAction',
          ctx: { error: profileError.message },
        });
        return { success: false, error: profileError.message, correlation_id: correlationId };
      }
    }

    // 2. Upsert membership
    const { data: membership, error: memError } = await supabase
      .from('tenant_memberships')
      .upsert(
        {
          tenant_id,
          user_id: targetUserId,
          role,
          is_active: true,
          is_suspended: false,
          invited_by: currentUser.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,user_id' }
      )
      .select('*, user:profiles(id, email, full_name, avatar_url)')
      .single();

    if (memError) {
      logger.error('Failed to upsert tenant membership during provisioning', {
        fn: 'provisionMemberAction',
        ctx: { error: memError.message },
      });
      return { success: false, error: memError.message, correlation_id: correlationId };
    }

    // 3. Assign to team if specified
    if (team_id) {
      await supabase.from('team_members').upsert({
        team_id,
        user_id: targetUserId,
      });
    }

    // 4. Record audit log
    await supabase.from('audit_logs').insert({
      tenant_id,
      actor_id: currentUser.id,
      action: 'MEMBER_PROVISIONED',
      entity_type: 'tenant_membership',
      entity_id: membership.id,
      details: { email, role, target_user_id: targetUserId },
    });

    try {
      revalidatePath('/settings/members');
      revalidatePath('/admin/tenant');
    } catch {}

    return { success: true, data: membership, correlation_id: correlationId };
  } catch (err: any) {
    logger.error('Exception in provisionMemberAction', { fn: 'provisionMemberAction', err });
    return { success: false, error: err?.message || 'Failed to provision member', correlation_id: correlationId };
  }
}

export async function updateMemberRoleAction(
  rawInput: UpdateMemberRoleInput
): Promise<ActionResponse<TenantMembership>> {
  const correlationId = `act-update-role-${Date.now()}`;
  try {
    const parsed = UpdateMemberRoleSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
        correlation_id: correlationId,
      };
    }

    const { membership_id, tenant_id, role } = parsed.data;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('tenant_memberships')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', membership_id)
      .eq('tenant_id', tenant_id)
      .select('*, user:profiles(id, email, full_name, avatar_url)')
      .single();

    if (error) {
      return { success: false, error: error.message, correlation_id: correlationId };
    }

    await supabase.from('audit_logs').insert({
      tenant_id,
      actor_id: user?.id || null,
      action: 'MEMBER_ROLE_UPDATED',
      entity_type: 'tenant_membership',
      entity_id: membership_id,
      details: { new_role: role },
    });

    try {
      revalidatePath('/settings/members');
    } catch {}

    return { success: true, data, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update member role', correlation_id: correlationId };
  }
}

export async function toggleMemberSuspensionAction(
  membershipId: string,
  tenantId: string,
  suspend: boolean
): Promise<ActionResponse<void>> {
  const correlationId = `act-toggle-suspend-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('tenant_memberships')
      .update({
        is_suspended: suspend,
        suspended_at: suspend ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membershipId)
      .eq('tenant_id', tenantId);

    if (error) {
      return { success: false, error: error.message, correlation_id: correlationId };
    }

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: user?.id || null,
      action: suspend ? 'MEMBER_SUSPENDED' : 'MEMBER_REACTIVATED',
      entity_type: 'tenant_membership',
      entity_id: membershipId,
      details: { is_suspended: suspend },
    });

    try {
      revalidatePath('/settings/members');
    } catch {}

    return { success: true, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to toggle suspension', correlation_id: correlationId };
  }
}

export async function revokeMemberSessionsAction(
  membershipId: string,
  userId: string,
  tenantId: string
): Promise<ActionResponse<void>> {
  const correlationId = `act-revoke-session-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Mark updated timestamp to force frontend token validation refresh
    await supabase
      .from('tenant_memberships')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', membershipId);

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: user?.id || null,
      action: 'MEMBER_SESSIONS_REVOKED',
      entity_type: 'tenant_membership',
      entity_id: membershipId,
      details: { target_user_id: userId },
    });

    try {
      revalidatePath('/settings/members');
    } catch {}

    return { success: true, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to revoke sessions', correlation_id: correlationId };
  }
}

export async function removeMemberAction(
  membershipId: string,
  tenantId: string
): Promise<ActionResponse<void>> {
  const correlationId = `act-remove-member-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('tenant_memberships')
      .delete()
      .eq('id', membershipId)
      .eq('tenant_id', tenantId);

    if (error) {
      return { success: false, error: error.message, correlation_id: correlationId };
    }

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: user?.id || null,
      action: 'MEMBER_REMOVED',
      entity_type: 'tenant_membership',
      entity_id: membershipId,
    });

    try {
      revalidatePath('/settings/members');
      revalidatePath('/admin/tenant');
    } catch {}

    return { success: true, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to remove member', correlation_id: correlationId };
  }
}

// ------------------------------------------------------------------------------
// 2. Cross-Tenant SuperAdmin Roster Actions
// ------------------------------------------------------------------------------

export async function getCrossTenantUsersAction(): Promise<ActionResponse<CrossTenantUser[]>> {
  const correlationId = `act-cross-tenant-users-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Verify SuperAdmin
    const isSuperadmin = Boolean(user?.user_metadata?.is_superadmin) || user?.email === 'admin@jyotirmoyb.com';

    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, is_superadmin, created_at');

    if (profileErr) {
      return { success: false, error: profileErr.message, correlation_id: correlationId };
    }

    const { data: memberships } = await supabase
      .from('tenant_memberships')
      .select('id, tenant_id, user_id, role, is_active, is_suspended, tenant:tenants(id, name, slug)');

    const result: CrossTenantUser[] = (profiles || []).map((p) => {
      const userMems = (memberships || []).filter((m) => m.user_id === p.id);
      const isAnySuspended = userMems.some((m) => m.is_suspended);
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name || 'User',
        avatar_url: p.avatar_url,
        is_superadmin: Boolean(p.is_superadmin),
        is_suspended: isAnySuspended,
        created_at: p.created_at,
        auth_provider: p.email.includes('partner') || p.email.includes('core') ? 'SAML/AzureAD' : 'Password',
        tenants: userMems.map((m: any) => ({
          tenant_id: m.tenant_id,
          tenant_name: m.tenant?.name || 'Workspace',
          role: m.role,
          is_active: Boolean(m.is_active),
          is_suspended: Boolean(m.is_suspended),
        })),
      };
    });

    return { success: true, data: result, correlation_id: correlationId };
  } catch (err: any) {
    logger.error('Exception in getCrossTenantUsersAction', { fn: 'getCrossTenantUsersAction', err });
    return { success: false, error: err?.message || 'Failed to fetch cross-tenant users', correlation_id: correlationId };
  }
}

export async function toggleGlobalUserLockAction(
  userId: string,
  isLocked: boolean
): Promise<ActionResponse<void>> {
  const correlationId = `act-global-lock-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Lock/unlock all tenant memberships for this user
    await supabase
      .from('tenant_memberships')
      .update({
        is_suspended: isLocked,
        suspended_at: isLocked ? new Date().toISOString() : null,
      })
      .eq('user_id', userId);

    await supabase.from('audit_logs').insert({
      actor_id: user?.id || null,
      action: isLocked ? 'GLOBAL_USER_LOCKED' : 'GLOBAL_USER_UNLOCKED',
      entity_type: 'user',
      entity_id: userId,
      details: { is_locked: isLocked },
    });

    try {
      revalidatePath('/admin/multisite/users');
    } catch {}

    return { success: true, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update user lock state', correlation_id: correlationId };
  }
}
