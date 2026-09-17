// ==============================================================================
// src/app/api/v1/export/route.ts
// Export Project Schedule (JSON or CSV format) with dependency preservation
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/error/api-handler';
import { db } from '@/lib/supabase/mock-db';

export const GET = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const projectId = url.searchParams.get('projectId') || 'd0000000-0000-0000-0000-000000000001';
  const format = url.searchParams.get('format') || 'json';
  const tenantId = req.headers.get('x-tenant-id') || 'a0000000-0000-0000-0000-000000000001';

  const project = db.projects.find(p => p.id === projectId);
  const tasks = db.getProjectTasksWithRelations(projectId, tenantId);
  const dependencies = db.dependencies.filter(d => d.project_id === projectId);

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
    // Generate CSV data string
    const headers = ['ID', 'Title', 'Status', 'Priority', 'Start Date', 'End Date', 'Duration (Days)', 'Progress %', 'Critical Path'];
    const rows = tasks.map(t => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      t.start_date,
      t.end_date,
      t.duration_days,
      `${t.progress_percent}%`,
      t.is_critical ? 'YES' : 'NO',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

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
