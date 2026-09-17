// ==============================================================================
// src/lib/email/templates/daily-digest.ts
// Responsive HTML Email Template: Daily Schedule & Overdue Task Digest
// ==============================================================================

import { DailyDigestTemplateData } from '../types';

export function renderDailyDigestEmail(data: DailyDigestTemplateData): { subject: string; html: string; text: string } {
  const subject = `Daily Project Digest: ${data.workspaceName} (${data.date})`;

  const text = `
Enterprise PMS Daily Digest
Workspace: ${data.workspaceName}
Date: ${data.date}

Hello ${data.recipientName},

OVERDUE TASKS (${data.overdueTasks.length}):
${data.overdueTasks.map(t => `- [${t.code}] ${t.title} (Due: ${t.dueDate})`).join('\n') || 'None'}

UPCOMING TASKS (NEXT 48H) (${data.upcomingTasks.length}):
${data.upcomingTasks.map(t => `- [${t.code}] ${t.title} (Due: ${t.dueDate})`).join('\n') || 'None'}

Access your workspace dashboard:
${data.digestUrl}
`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; margin: 0; padding: 0; color: #f8fafc; }
    .container { max-width: 650px; margin: 40px auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .header { background: #0f172a; border-bottom: 1px solid #334155; padding: 24px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; }
    .header p { margin: 4px 0 0; font-size: 13px; color: #94a3b8; }
    .body { padding: 28px 24px; }
    .section-title { font-size: 16px; font-weight: 700; margin: 24px 0 12px; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; }
    .overdue-title { color: #f87171; }
    .upcoming-title { color: #60a5fa; }
    .task-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px; }
    .task-table th { background: #0f172a; color: #94a3b8; text-align: left; padding: 10px 12px; border-bottom: 1px solid #334155; font-size: 12px; }
    .task-table td { padding: 10px 12px; border-bottom: 1px solid #334155; color: #cbd5e1; }
    .code-pill { font-family: monospace; font-size: 12px; background: #334155; padding: 2px 6px; border-radius: 4px; color: #38bdf8; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .footer { background: #0f172a; border-top: 1px solid #334155; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${data.workspaceName} &bull; Daily Schedule Digest</h1>
      <p>Automated summary for ${data.recipientName} on ${data.date}</p>
    </div>
    <div class="body">
      <div class="section-title overdue-title">
        ⚠️ Overdue Tasks (${data.overdueTasks.length})
      </div>
      ${
        data.overdueTasks.length === 0
          ? '<p style="color: #94a3b8; font-size: 14px; font-style: italic;">No overdue tasks today. Great work!</p>'
          : `<table class="task-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Task</th>
                  <th style="text-align: right;">Target Due</th>
                </tr>
              </thead>
              <tbody>
                ${data.overdueTasks
                  .map(
                    t => `
                  <tr>
                    <td><span class="code-pill">${t.code}</span></td>
                    <td style="color: #f8fafc; font-weight: 500;">${t.title}</td>
                    <td style="text-align: right; color: #f87171; font-weight: 600;">${t.dueDate}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>`
      }

      <div class="section-title upcoming-title">
        📅 Upcoming Due in Next 48 Hours (${data.upcomingTasks.length})
      </div>
      ${
        data.upcomingTasks.length === 0
          ? '<p style="color: #94a3b8; font-size: 14px; font-style: italic;">No tasks due in the next 48 hours.</p>'
          : `<table class="task-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Task</th>
                  <th style="text-align: right;">Due Date</th>
                </tr>
              </thead>
              <tbody>
                ${data.upcomingTasks
                  .map(
                    t => `
                  <tr>
                    <td><span class="code-pill">${t.code}</span></td>
                    <td style="color: #f8fafc; font-weight: 500;">${t.title}</td>
                    <td style="text-align: right; color: #60a5fa; font-weight: 600;">${t.dueDate}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>`
      }

      <div style="text-align: center; margin-top: 32px;">
        <a href="${data.digestUrl}" class="btn" target="_blank">Open Workspace Daily View</a>
      </div>
    </div>
    <div class="footer">
      Delivered by Enterprise PMS Automated Schedule Worker.
    </div>
  </div>
</body>
</html>
`;

  return { subject, html, text };
}
