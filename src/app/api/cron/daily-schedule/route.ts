// ==============================================================================
// src/app/api/cron/daily-schedule/route.ts
// Automated Daily Background Schedule Worker
// Performs SLA milestone alerts, overdue task escalation, and daily digest dispatch
// Protected by Bearer CRON_SECRET authorization header (Vercel Cron standard)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';
import { emailService } from '@/lib/email';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = `cron-daily-${Date.now()}`;

  // 1. Bearer Token Authentication
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized attempt to trigger daily schedule cron', {
      fn: 'GET /api/cron/daily-schedule',
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

  logger.info('Starting daily automated schedule background worker', {
    fn: 'GET /api/cron/daily-schedule',
    corrId: correlationId,
  });

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pms.jyotirmoyb.com';

  let milestonesAlerted = 0;
  let overdueTasksProcessed = 0;
  let digestsSent = 0;

  try {
    const tenants = db.tenants;

    for (const tenant of tenants) {
      const tenantProjects = db.projects.filter(p => p.tenant_id === tenant.id);
      const tenantTasks = db.tasks.filter(t => t.tenant_id === tenant.id);
      const tenantMembers = db.memberships.filter(m => m.tenant_id === tenant.id);

      // Find primary admin/manager to receive alerts
      const adminMember = tenantMembers.find(m => m.role === 'admin' || m.role === 'owner' || m.role === 'project_manager') || tenantMembers[0];
      const adminUser = adminMember ? db.users.find(u => u.id === adminMember.user_id) : null;
      const recipientEmail = adminUser?.email || 'admin@jyotirmoyb.com';
      const recipientName = adminUser?.full_name || 'Project Lead';

      // ------------------------------------------------------------------------
      // A. SLA Milestone Monitoring (24h/48h warning & breach alerts)
      // ------------------------------------------------------------------------
      const milestoneTasks = tenantTasks.filter(t => t.is_milestone && t.status !== 'done');

      for (const milestone of milestoneTasks) {
        const targetDate = new Date(milestone.end_date);
        const diffHours = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60));
        const isBreached = diffHours < 0;

        if (diffHours <= 48) {
          const project = tenantProjects.find(p => p.id === milestone.project_id);
          const projectName = project?.name || 'Primary Project';

          // Dispatch transactional alert email
          await emailService.sendSlaMilestoneAlert(
            recipientEmail,
            {
              recipientName,
              milestoneTitle: milestone.title,
              projectName,
              targetDate: milestone.end_date,
              hoursRemaining: Math.max(0, diffHours),
              isBreached,
              actionUrl: `${appUrl}/projects/${milestone.project_id}?tab=gantt`,
            },
            correlationId
          );

          // Record in-app notification
          if (adminUser) {
            db.createNotification({
              tenant_id: tenant.id,
              recipient_id: adminUser.id,
              event_type: 'due_soon',
              title: isBreached ? `Critical SLA Breach: ${milestone.title}` : `SLA Warning: ${milestone.title}`,
              message: isBreached
                ? `Milestone "${milestone.title}" in ${projectName} has breached its deadline (${milestone.end_date}).`
                : `Milestone "${milestone.title}" in ${projectName} is due in ${diffHours} hours.`,
              entity_type: 'project',
              entity_id: milestone.project_id,
            });
          }

          milestonesAlerted++;
        }
      }

      // ------------------------------------------------------------------------
      // B. Overdue Task Escalation
      // ------------------------------------------------------------------------
      const overdueTasks = tenantTasks.filter(t => t.end_date < todayStr && t.status !== 'done');
      overdueTasksProcessed += overdueTasks.length;

      for (const task of overdueTasks) {
        const project = tenantProjects.find(p => p.id === task.project_id);
        if (adminUser) {
          db.createNotification({
            tenant_id: tenant.id,
            recipient_id: adminUser.id,
            event_type: 'due_soon',
            title: `Overdue Task: [${task.code || task.id}] ${task.title}`,
            message: `Task was scheduled for completion on ${task.end_date} in project "${project?.name || 'Project'}".`,
            entity_type: 'task',
            entity_id: task.id,
          });
        }
      }

      // ------------------------------------------------------------------------
      // C. Daily Digest Dispatch
      // ------------------------------------------------------------------------
      const upcomingTasks = tenantTasks.filter(t => {
        if (t.status === 'done') return false;
        const taskDue = new Date(t.end_date);
        const diffHours = (taskDue.getTime() - today.getTime()) / (1000 * 60 * 60);
        return diffHours >= 0 && diffHours <= 48;
      });

      if (overdueTasks.length > 0 || upcomingTasks.length > 0) {
        await emailService.sendDailyDigest(
          recipientEmail,
          {
            recipientName,
            workspaceName: tenant.name,
            date: todayStr,
            overdueTasks: overdueTasks.slice(0, 10).map(t => ({
              title: t.title,
              code: t.code || t.id.substring(0, 8),
              dueDate: t.end_date,
            })),
            upcomingTasks: upcomingTasks.slice(0, 10).map(t => ({
              title: t.title,
              code: t.code || t.id.substring(0, 8),
              dueDate: t.end_date,
            })),
            digestUrl: `${appUrl}/tasks`,
          },
          correlationId
        );
        digestsSent++;
      }
    }

    const durationMs = Date.now() - startTime;

    logger.info('Daily automated schedule worker completed successfully', {
      fn: 'GET /api/cron/daily-schedule',
      corrId: correlationId,
      ctx: {
        durationMs,
        milestonesAlerted,
        overdueTasksProcessed,
        digestsSent,
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      executionTimeMs: durationMs,
      correlationId,
      metrics: {
        milestonesAlerted,
        overdueTasksProcessed,
        digestsSent,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Failed executing daily schedule cron worker', {
      fn: 'GET /api/cron/daily-schedule',
      corrId: correlationId,
      err: error,
    });

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status_code: 500,
        error_code: 'CRON_EXECUTION_FAILURE',
        correlation_id: correlationId,
        message: 'Daily schedule background worker failed',
      },
      { status: 500 }
    );
  }
}
