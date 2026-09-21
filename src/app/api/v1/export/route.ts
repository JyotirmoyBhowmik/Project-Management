// ==============================================================================
// src/app/api/v1/export/route.ts
// Export Project Schedule (JSON or CSV format) with dependency preservation
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/error/api-handler';
import { dbService } from '@/lib/supabase/db-service';
import { Task } from '@/types/database';

export const GET = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const projectId = url.searchParams.get('projectId');
  const format = url.searchParams.get('format') || 'json';
  const tenantId = req.headers.get('x-tenant-id') || url.searchParams.get('tenant_id') || url.searchParams.get('tenantId');

  if (!projectId || !tenantId) {
    return NextResponse.json(
      { error: 'Missing required parameters: projectId and tenantId' },
      { status: 400 }
    );
  }

  const [project, tasks, dependencies] = await Promise.all([
    dbService.getProjectDetails(projectId, tenantId),
    dbService.getTasksForProject(projectId, tenantId),
    dbService.getDependenciesForProject(projectId, tenantId),
  ]);

  const exportPayload = {
    system: 'Antigravity Enterprise PMS',
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    correlation_id: correlationId,
    project,
    tasks,
    dependencies,
  };

  if (format === 'csv') {
    // Generate CSV data string with complete CPM scheduling fidelity
    const headers = [
      'Task Code',
      'Title',
      'Status',
      'Priority',
      'Start Date',
      'End Date',
      'Duration (Days)',
      'Progress %',
      'Critical Path',
      'Early Start',
      'Early Finish',
      'Late Start',
      'Late Finish',
      'Total Float (Days)',
      'Free Float (Days)',
      'Predecessors',
    ];

    const predMap = new Map<string, string[]>();
    for (const d of dependencies) {
      const predTask = tasks.find((pt: Task) => pt.id === d.predecessor_id);
      const code = predTask?.task_code || (predTask as any)?.code || d.predecessor_id;
      const desc = `${code}:${d.dep_type || d.type || 'FS'}+${d.lag_days || 0}`;
      if (!predMap.has(d.successor_id)) {
        predMap.set(d.successor_id, []);
      }
      predMap.get(d.successor_id)!.push(desc);
    }

    const rows = tasks.map((t: Task) => [
      t.task_code || (t as any).code || t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      t.start_date,
      t.end_date,
      t.duration_days,
      `${t.progress ?? t.progress_percent ?? 0}%`,
      t.is_critical ? 'YES' : 'NO',
      t.early_start || '',
      t.early_finish || '',
      t.late_start || '',
      t.late_finish || '',
      t.total_float ?? 0,
      t.free_float ?? 0,
      `"${(predMap.get(t.id) || []).join(', ') || 'None'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${project?.code || 'project'}-schedule.csv"`,
        'x-correlation-id': correlationId,
      },
    });
  }

  return NextResponse.json(exportPayload, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${project?.code || 'project'}-schedule.json"`,
      'x-correlation-id': correlationId,
    },
  });
});
