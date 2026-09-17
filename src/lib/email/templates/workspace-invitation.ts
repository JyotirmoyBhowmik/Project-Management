// ==============================================================================
// src/lib/email/templates/workspace-invitation.ts
// Responsive HTML Email Template: Workspace Invitation
// ==============================================================================

import { WorkspaceInvitationTemplateData } from '../types';

export function renderWorkspaceInvitationEmail(data: WorkspaceInvitationTemplateData): { subject: string; html: string; text: string } {
  const subject = `You've been invited to join ${data.workspaceName} on Enterprise PMS`;

  const text = `
Hello ${data.recipientName} (${data.inviteeEmail}),

${data.inviterName} has invited you to join the workspace "${data.workspaceName}" (${data.tenantSlug}) with the role of ${data.role}.

To accept this invitation and set up your account, visit the link below:
${data.inviteUrl}

This invitation will expire on ${data.expiresAt}.

If you did not expect this invitation, please disregard this message.
`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 0; color: #f8fafc; }
    .container { max-width: 600px; margin: 40px auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em; }
    .header p { margin: 8px 0 0 0; color: #bfdbfe; font-size: 14px; }
    .body { padding: 32px 24px; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(59, 130, 246, 0.2); border: 1px solid #3b82f6; color: #93c5fd; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
    .card { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .card-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
    .card-label { color: #94a3b8; font-weight: 500; }
    .card-value { color: #f1f5f9; font-weight: 600; }
    .btn-container { text-align: center; margin: 32px 0 24px; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); }
    .footer { background: #0f172a; border-top: 1px solid #1e293b; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Enterprise PMS</h1>
      <p>Workspace Team Collaboration</p>
    </div>
    <div class="body">
      <span class="badge">Team Invitation</span>
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff;">Hello ${data.recipientName}, You're Invited!</h2>
      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
        <strong>${data.inviterName}</strong> has invited you to join the <strong>${data.workspaceName}</strong> workspace on Enterprise PMS.
      </p>

      <div class="card">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;">Workspace:</td>
            <td style="padding: 6px 0; text-align: right; color: #f8fafc; font-weight: 600;">${data.workspaceName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;">Assigned Role:</td>
            <td style="padding: 6px 0; text-align: right; color: #60a5fa; font-weight: 600;">${data.role}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;">Recipient Email:</td>
            <td style="padding: 6px 0; text-align: right; color: #f8fafc; font-weight: 500;">${data.inviteeEmail}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;">Expires:</td>
            <td style="padding: 6px 0; text-align: right; color: #f59e0b; font-weight: 500;">${data.expiresAt}</td>
          </tr>
        </table>
      </div>

      <div class="btn-container">
        <a href="${data.inviteUrl}" class="btn" target="_blank">Accept Invitation</a>
      </div>

      <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0;">
        If you cannot click the button above, copy and paste this URL into your browser:<br>
        <span style="word-break: break-all; color: #60a5fa;">${data.inviteUrl}</span>
      </p>
    </div>
    <div class="footer">
      This is an automated transactional message sent by Enterprise PMS.<br>
      Strict multi-tenant boundary controls are enforced for all invited members.
    </div>
  </div>
</body>
</html>
`;

  return { subject, html, text };
}
