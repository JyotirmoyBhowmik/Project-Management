// ==============================================================================
// src/lib/email/templates/task-assignment.ts
// Responsive HTML Email Template: Task Assignment Notification
// ==============================================================================

import { TaskAssignmentTemplateData } from '../types';

export function renderTaskAssignmentEmail(data: TaskAssignmentTemplateData): { subject: string; html: string; text: string } {
  const subject = `[${data.taskCode}] New Assignment: ${data.taskTitle}`;

  const text = `
Hello ${data.assigneeName},

You have been assigned to task "${data.taskTitle}" [${data.taskCode}] in project "${data.projectName}".

Priority: ${data.priority}
Due Date: ${data.dueDate}

View and update the task here:
${data.taskUrl}
`;

  const priorityColor =
    data.priority.toLowerCase() === 'urgent'
      ? '#ef4444'
      : data.priority.toLowerCase() === 'high'
      ? '#f97316'
      : data.priority.toLowerCase() === 'medium'
      ? '#3b82f6'
      : '#10b981';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; margin: 0; padding: 0; color: #f8fafc; }
    .container { max-width: 600px; margin: 40px auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { background: #0f172a; border-bottom: 1px solid #334155; padding: 24px; text-align: left; display: flex; align-items: center; justify-content: space-between; }
    .header-title { font-size: 18px; font-weight: 700; color: #ffffff; }
    .body { padding: 32px 24px; }
    .code-badge { font-family: monospace; font-size: 13px; font-weight: 700; background: #334155; color: #38bdf8; padding: 4px 8px; border-radius: 4px; }
    .priority-badge { font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; background: ${priorityColor}22; color: ${priorityColor}; border: 1px solid ${priorityColor}; }
    .task-title { font-size: 22px; font-weight: 700; color: #ffffff; margin: 16px 0 8px; line-height: 1.3; }
    .project-name { font-size: 14px; color: #94a3b8; margin-bottom: 24px; }
    .details-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 28px; }
    .btn { display: inline-block; background-color: #3b82f6; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; text-align: center; }
    .footer { background: #0f172a; border-top: 1px solid #334155; padding: 18px 24px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="header-title">Enterprise PMS</span>
      <span class="code-badge">${data.taskCode}</span>
    </div>
    <div class="body">
      <div style="margin-bottom: 12px;">
        <span class="priority-badge">${data.priority.toUpperCase()} Priority</span>
      </div>
      <h1 class="task-title">${data.taskTitle}</h1>
      <div class="project-name">Project: <strong>${data.projectName}</strong></div>

      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        Hi ${data.assigneeName}, you have been assigned to this work item. Please review the schedule, dependencies, and deliverables.
      </p>

      <div class="details-box">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;">Target Due Date:</td>
            <td style="padding: 6px 0; text-align: right; color: #f8fafc; font-weight: 600;">${data.dueDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;">Assigned To:</td>
            <td style="padding: 6px 0; text-align: right; color: #f8fafc; font-weight: 600;">${data.assigneeName}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0 16px;">
        <a href="${data.taskUrl}" class="btn" target="_blank">View Task in Gantt / Board</a>
      </div>
    </div>
    <div class="footer">
      Automated task dispatch by Enterprise PMS CPM Engine.
    </div>
  </div>
</body>
</html>
`;

  return { subject, html, text };
}
