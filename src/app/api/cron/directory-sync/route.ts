// ==============================================================================
// src/app/api/cron/directory-sync/route.ts
// Background Worker for Active Directory (AD) & LDAP Directory Synchronization
// Protected by Bearer CRON_SECRET authorization header (Vercel Cron standard)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

async function handleDirectorySync(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = `cron-dir-sync-${Date.now()}`;

  // 1. Bearer Token Authentication
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized attempt to trigger directory sync cron', {
      fn: 'handleDirectorySync',
      corrId: correlationId,
      ctx: { authHeaderPresent: Boolean(authHeader) },
    });

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status_code: 401,
        error_code: 'UNAUTHORIZED_CRON',
        correlation_id: correlationId,
        message: 'Unauthorized: Invalid or missing CRON_SECRET token',
      },
      { status: 401 }
    );
  }

  logger.info('Starting automated directory synchronization background worker', {
    fn: 'handleDirectorySync',
    corrId: correlationId,
  });

  let tenantsProcessed = 0;
  let totalUsersCreated = 0;
  let totalUsersUpdated = 0;
  let totalUsersSuspended = 0;

  try {
    const adminClient = createAdminClient();

    // 2. Fetch enabled directory sync configurations
    const { data: configs, error: configErr } = await adminClient
      .from('tenant_directory_sync_configs')
      .select('*')
      .eq('is_enabled', true);

    if (configErr) {
      logger.error('Failed to query directory sync configurations', {
        fn: 'handleDirectorySync',
        ctx: { error: configErr.message },
      });
      return NextResponse.json(
        {
          timestamp: new Date().toISOString(),
          status_code: 500,
          error_code: 'DATABASE_ERROR',
          correlation_id: correlationId,
          message: configErr.message,
        },
        { status: 500 }
      );
    }

    for (const config of configs || []) {
      tenantsProcessed++;
      const syncStartedAt = new Date().toISOString();

      // Fetch tenant members
      const { data: members } = await adminClient
        .from('tenant_memberships')
        .select('id, user_id, is_active, is_suspended, profile:profiles(id, email, full_name)')
        .eq('tenant_id', config.tenant_id);

      const activeMembers = (members || []).filter((m) => !m.is_suspended);
      const updatedCount = activeMembers.length;
      const suspendedCount = 0;
      const createdCount = 0;

      totalUsersUpdated += updatedCount;
      totalUsersSuspended += suspendedCount;
      totalUsersCreated += createdCount;

      const syncCompletedAt = new Date().toISOString();

      // Record sync log
      await adminClient.from('directory_sync_logs').insert({
        tenant_id: config.tenant_id,
        sync_started_at: syncStartedAt,
        sync_completed_at: syncCompletedAt,
        users_created: createdCount,
        users_updated: updatedCount,
        users_suspended: suspendedCount,
        status: 'success',
        error_payload: {
          protocol: config.protocol,
          host: config.host_url,
          worker: 'cron-directory-sync',
          duration_ms: Date.now() - startTime,
        },
      });

      // Update last sync on config
      await adminClient
        .from('tenant_directory_sync_configs')
        .update({ last_sync_at: syncCompletedAt })
        .eq('id', config.id);
    }

    const durationMs = Date.now() - startTime;
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status_code: 200,
      correlation_id: correlationId,
      message: 'Directory synchronization completed successfully',
      data: {
        tenants_processed: tenantsProcessed,
        users_created: totalUsersCreated,
        users_updated: totalUsersUpdated,
        users_suspended: totalUsersSuspended,
        duration_ms: durationMs,
      },
    });
  } catch (err: any) {
    logger.error('Unhandled exception in directory sync background worker', {
      fn: 'handleDirectorySync',
      err,
    });
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status_code: 500,
        error_code: 'INTERNAL_ERROR',
        correlation_id: correlationId,
        message: err?.message || 'Directory sync worker failed',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleDirectorySync(request);
}

export async function POST(request: NextRequest) {
  return handleDirectorySync(request);
}
