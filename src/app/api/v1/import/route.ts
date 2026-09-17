// ==============================================================================
// src/app/api/v1/import/route.ts
// Data Exchange Import API: Standard Schema Ingestion with Cycle Pre-Validation
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { dbService } from '@/lib/supabase/db-service';
import { StandardImportRowSchema, ValidatedStandardImportRow } from '@/lib/validation/schemas';
import { addWorkingDays, parseISODate, formatDateToISO } from '@/lib/calendar/calendar-engine';
import { topologicalSort } from '@/lib/cpm/cpm-engine';
import { Task, TaskDependency } from '@/types/database';

export const POST = apiHandler(async (req: NextRequest, { correlationId }) => {
  const body = await req.json();
  const { projectId, dryRun = true, rows = [] } = body;

  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenant_id');
  const actorId = req.headers.get('x-user-id') || null;

  if (!tenantId) {
    throw new Error('Tenant ID is required for import');
  }

  const [tenant, holidays, members] = await Promise.all([
    dbService.getTenantById(tenantId),
    dbService.getCalendarHolidays(tenantId),
    dbService.getTenantMembers(tenantId),
  ]);

  const calendar = {
    working_days: tenant?.weekend_days ? [0, 1, 2, 3, 4, 5, 6].filter(d => !tenant.weekend_days?.includes(d)) : [1, 2, 3, 4, 5],
  };

  const previewResults: Array<{
    rowIndex: number;
    raw: unknown;
    isValid: boolean;
    errors: string[];
    warnings: string[];
    parsed?: ValidatedStandardImportRow;
    matchedAssignees?: string[];
  }> = [];

  const validRows: ValidatedStandardImportRow[] = [];

  // 1. Row Validation & Assignee Matching
  rows.forEach((row: unknown, index: number) => {
    // If incoming item has single assignee string instead of array, normalize
    const normalized = typeof row === 'object' && row !== null && (row as any).assignee
      ? {
          ...(row as any),
          assignee_emails: [(row as any).assignee],
        }
      : row;

    const parseResult = StandardImportRowSchema.safeParse(normalized);
    if (parseResult.success) {
      const data = parseResult.data;
      const warnings: string[] = [];
      const matchedAssignees: string[] = [];

      data.assignee_emails.forEach(email => {
        const found = members.find(m => m.user?.email.toLowerCase() === email.toLowerCase())?.user;
        if (found) {
          matchedAssignees.push(found.full_name);
        } else {
          warnings.push(`Assignee email '${email}' not found in tenant roster; will import unassigned.`);
        }
      });

      previewResults.push({
        rowIndex: index + 1,
        raw: row,
        isValid: true,
        errors: [],
        warnings,
        parsed: data,
        matchedAssignees,
      });
      validRows.push(data);
    } else {
      previewResults.push({
        rowIndex: index + 1,
        raw: row,
        isValid: false,
        errors: parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        warnings: [],
      });
    }
  });

  // 2. Pre-Validation: Check for circular dependency loops among import rows
  const simulatedTasks: Task[] = validRows.map((r, i) => ({
    id: r.task_id || `temp-${i}`,
    tenant_id: tenantId,
    project_id: projectId,
    phase_id: null,
    parent_task_id: null,
    title: r.title,
    description: r.description || null,
    status: r.status as any,
    priority: r.priority,
    start_date: r.start_date,
    end_date: r.start_date,
    duration_days: r.duration_days,
    progress: r.progress,
    is_milestone: r.duration_days === 0,
    sort_order: i + 1,
    early_start: null,
    early_finish: null,
    late_start: null,
    late_finish: null,
    total_float: 0,
    is_critical: false,
    created_at: '',
    updated_at: '',
  }));

  const simulatedDeps: TaskDependency[] = [];
  validRows.forEach(r => {
    if (r.task_id && r.predecessors) {
      r.predecessors.forEach(p => {
        simulatedDeps.push({
          id: `dep-${p.id}-${r.task_id}`,
          tenant_id: tenantId,
          project_id: projectId,
          predecessor_id: p.id,
          successor_id: r.task_id!,
          dep_type: p.type,
          lag_days: p.lag_days,
          created_at: '',
        });
      });
    }
  });

  const { hasCycle } = topologicalSort(simulatedTasks, simulatedDeps);
  if (hasCycle) {
    return createSuccessResponse(
      {
        isDryRun: true,
        hasCycle: true,
        cycleError: 'Detected circular dependency loop in import payload.',
        totalRows: rows.length,
        validCount: 0,
        errorCount: rows.length,
        preview: previewResults,
      },
      correlationId,
      422
    );
  }

  // If dry-run requested, return preview analysis without committing
  if (dryRun) {
    return createSuccessResponse(
      {
        isDryRun: true,
        hasCycle: false,
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: rows.length - validRows.length,
        preview: previewResults,
      },
      correlationId
    );
  }

  // 3. Commit valid rows to database
  const createdTasks: Task[] = [];
  const taskIdMap = new Map<string, string>(); // maps import task_id to db task.id

  for (const item of validRows) {
    const start = parseISODate(item.start_date);
    const end = addWorkingDays(start, item.duration_days, calendar, holidays);

    const task = await dbService.createTask({
      tenant_id: tenantId,
      project_id: projectId,
      phase_id: null,
      parent_id: null,
      title: item.title,
      description: item.description || null,
      status: item.status as any,
      priority: item.priority,
      start_date: item.start_date,
      end_date: formatDateToISO(end),
      duration_days: item.duration_days,
      progress: item.progress,
      is_milestone: item.duration_days === 0,
      created_by: actorId,
    });

    if (task) {
      createdTasks.push(task);
      if (item.task_id) {
        taskIdMap.set(item.task_id, task.id);
      }
    }
  }

  // 4. Create dependency connections
  for (const item of validRows) {
    if (item.task_id && taskIdMap.has(item.task_id) && item.predecessors) {
      const succDbId = taskIdMap.get(item.task_id)!;
      for (const pred of item.predecessors) {
        if (taskIdMap.has(pred.id)) {
          const predDbId = taskIdMap.get(pred.id)!;
          try {
            await dbService.createDependency({
              tenant_id: tenantId,
              project_id: projectId,
              predecessor_id: predDbId,
              successor_id: succDbId,
              dep_type: pred.type,
              lag_days: pred.lag_days,
            });
          } catch {
            // Cycle or duplicate skipped gracefully
          }
        }
      }
    }
  }

  return createSuccessResponse(
    {
      isDryRun: false,
      importedCount: createdTasks.length,
      tasks: createdTasks,
    },
    correlationId,
    201
  );
});
