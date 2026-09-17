// ==============================================================================
// src/app/api/v1/import/route.ts
// Data Exchange Import API: Dry-run schema validation and batch ingestion
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { db } from '@/lib/supabase/mock-db';
import { ImportRowSchema, ValidatedImportRow } from '@/lib/validation/schemas';
import { addWorkingDays, parseISODate, formatDateToISO } from '@/lib/calendar/calendar-engine';

export const POST = apiHandler(async (req: NextRequest, { correlationId }) => {
  const body = await req.json();
  const { projectId, dryRun = true, rows = [] } = body;

  const tenantId = req.headers.get('x-tenant-id') || 'a0000000-0000-0000-0000-000000000001';
  const actorId = req.headers.get('x-user-id') || 'b0000000-0000-0000-0000-000000000002';
  const calendar = db.calendars.find(c => c.tenant_id === tenantId) || { working_days: [1, 2, 3, 4, 5] };
  const holidays = db.holidays.filter(h => h.tenant_id === tenantId);

  const previewResults: Array<{
    rowIndex: number;
    raw: unknown;
    isValid: boolean;
    errors: string[];
    parsed?: ValidatedImportRow;
  }> = [];

  const validRows: ValidatedImportRow[] = [];

  rows.forEach((row: unknown, index: number) => {
    const parseResult = ImportRowSchema.safeParse(row);
    if (parseResult.success) {
      previewResults.push({
        rowIndex: index + 1,
        raw: row,
        isValid: true,
        errors: [],
        parsed: parseResult.data,
      });
      validRows.push(parseResult.data);
    } else {
      previewResults.push({
        rowIndex: index + 1,
        raw: row,
        isValid: false,
        errors: parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      });
    }
  });

  // If dry-run requested, return preview analysis without committing
  if (dryRun) {
    return createSuccessResponse(
      {
        isDryRun: true,
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: rows.length - validRows.length,
        preview: previewResults,
      },
      correlationId
    );
  }

  // Commit valid rows
  const createdTasks = [];
  for (const item of validRows) {
    const start = parseISODate(item.start_date);
    const end = addWorkingDays(start, item.duration_days, calendar, holidays);

    const task = db.createTask(
      {
        tenant_id: tenantId,
        project_id: projectId,
        phase_id: null,
        parent_id: null,
        title: item.title,
        description: `Imported via Data Exchange (${item.assignee ? `Assignee: ${item.assignee}` : 'Unassigned'})`,
        status: item.status,
        priority: item.priority,
        start_date: item.start_date,
        end_date: formatDateToISO(end),
        duration_days: item.duration_days,
        progress_percent: 0,
        is_milestone: item.duration_days === 0,
        order_index: db.tasks.length + 1,
        created_by: actorId,
      },
      actorId,
      correlationId
    );
    createdTasks.push(task);
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
