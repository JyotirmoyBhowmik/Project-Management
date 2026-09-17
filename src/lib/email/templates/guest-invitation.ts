// ==============================================================================
// src/lib/email/templates/guest-invitation.ts
// Responsive HTML Email Template: External Guest Containment Portal Invitation
// ==============================================================================

import { GuestInvitationTemplateData } from '../types';

export function renderGuestInvitationEmail(data: GuestInvitationTemplateData): { subject: string; html: string; text: string } {
  const subject = `External Collaboration Invitation: ${data.projectName}`;

  const text = `
Hello,

${data.inviterName} has granted you external guest access to the project "${data.projectName}" with ${data.accessLevel.toUpperCase()} permissions.

Access is strictly confined to this specific project and will expire on ${data.expiresAt}.

Access the project portal using the link below:
${data.portalUrl}

If you did not expect this invitation, please disregard this email.
`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; margin: 0; padding: 0; color: #f8fafc; }
    .container { max-width: 600px; margin: 40px auto; background: #111827; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6); }
    .header { background: linear-gradient(135deg, #059669, #047857); padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
    .header p { margin: 8px 0 0 0; color: #a7f3d0; font-size: 14px; }
    .body { padding: 32px 24px; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #6ee7b7; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
    .card { background: #0b0f19; border: 1px solid #1f2937; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .btn-container { text-align: center; margin: 32px 0 24px; }
    .btn { display: inline-block; background-color: #059669; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; }
    .notice { background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #93c5fd; }
    .footer { background: #090d16; border-top: 1px solid #1f2937; padding: 20px 24px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Enterprise PMS</h1>
      <p>External Guest Collaboration Portal</p>
    </div>
    <div class="body">
      <span class="badge">Guest Access</span>
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff;">Project Access Granted</h2>
      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #d1d5db;">
        <strong>${data.inviterName}</strong> has granted you secure guest access to collaborate on <strong>${data.projectName}</strong>.
      </p>

      <div class="card">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #9ca3af;">Project Name:</td>
            <td style="padding: 6px 0; text-align: right; color: #f9fafb; font-weight: 600;">${data.projectName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #9ca3af;">Access Tier:</td>
            <td style="padding: 6px 0; text-align: right; color: #34d399; font-weight: 600; text-transform: uppercase;">${data.accessLevel.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #9ca3af;">Guest Identity:</td>
            <td style="padding: 6px 0; text-align: right; color: #f9fafb; font-weight: 500;">${data.guestEmail}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #9ca3af;">Access Valid Until:</td>
            <td style="padding: 6px 0; text-align: right; color: #fbbf24; font-weight: 500;">${data.expiresAt}</td>
          </tr>
        </table>
      </div>

      <div class="notice">
        <strong>Guest Boundary Isolation:</strong> Your access is strictly confined to "${data.projectName}". Internal tenant repositories, financial metrics, and other projects are completely hidden from view.
      </div>

      <div class="btn-container">
        <a href="${data.portalUrl}" class="btn" target="_blank">Open Project Portal</a>
      </div>

      <p style="font-size: 13px; color: #9ca3af; line-height: 1.5; margin: 0;">
        Direct link: <span style="word-break: break-all; color: #34d399;">${data.portalUrl}</span>
      </p>
    </div>
    <div class="footer">
      Enterprise PMS External Containment Infrastructure &bull; Zero Cross-Tenant Leakage Guarantee
    </div>
  </div>
</body>
</html>
`;

  return { subject, html, text };
}
