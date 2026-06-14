import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface InviteEmailOptions {
  to: string;
  recipientName: string;
  inviterName: string;
  companyName: string;
  role: string;
  inviteUrl: string;
  expiresInDays?: number;
}

interface ResendEmailOptions {
  to: string;
  recipientName: string;
  companyName: string;
  role: string;
  inviteUrl: string;
  resentCount: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
  viewer: "Viewer",
};

const FROM = process.env.EMAIL_FROM ?? "CompanyOS <onboarding@resend.dev>";

function baseTemplate(content: string, previewText: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${previewText}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f4f4f5; color: #18181b; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
  </style>
</head>
<body style="background:#f4f4f5; padding: 32px 16px;">
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;color:#f4f4f5;font-size:1px;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <!-- Container -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;margin:0 auto;">
    <tr><td>

      <!-- Logo / Brand bar -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding:0 0 20px 0; text-align:center;">
            <span style="display:inline-block; font-size:22px; font-weight:700; letter-spacing:-0.5px; color:#09090b;">
              Company<span style="color:#6366f1;">OS</span>
            </span>
          </td>
        </tr>
      </table>

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
        <tr><td style="padding:40px 40px 32px;">
          ${content}
        </td></tr>
      </table>

      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding:24px 0 0 0; text-align:center; font-size:12px; color:#71717a; line-height:1.6;">
            This email was sent by CompanyOS on behalf of your organization.<br/>
            If you didn't expect this, you can safely ignore it — your account won't be affected.
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0 0;">
    <tr>
      <td align="center">
        <a href="${href}" target="_blank"
           style="display:inline-block;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;
                  padding:13px 32px;border-radius:8px;letter-spacing:0.01em;text-decoration:none;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

export async function sendInviteEmail(opts: InviteEmailOptions) {
  const roleLabel = ROLE_LABELS[opts.role] ?? opts.role;
  const days = opts.expiresInDays ?? 7;

  const content = `
    <!-- Icon -->
    <div style="width:52px;height:52px;background:#eef2ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;">
      <span style="font-size:26px;">👋</span>
    </div>

    <h1 style="font-size:22px;font-weight:700;color:#09090b;margin-bottom:8px;line-height:1.3;">
      You've been invited to join ${opts.companyName}
    </h1>
    <p style="font-size:15px;color:#52525b;line-height:1.6;margin-bottom:0;">
      <strong>${opts.inviterName}</strong> has invited you to join <strong>${opts.companyName}</strong> on CompanyOS as a <strong>${roleLabel}</strong>.
    </p>

    <!-- Role badge -->
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0 0;">
      <tr>
        <td style="background:#f4f4f5;border-radius:6px;padding:10px 16px;">
          <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Your role</span><br/>
          <span style="font-size:15px;font-weight:600;color:#09090b;margin-top:2px;display:block;">${roleLabel}</span>
        </td>
      </tr>
    </table>

    ${ctaButton(opts.inviteUrl, "Accept Invitation &rarr;")}

    <p style="margin-top:20px;font-size:13px;color:#a1a1aa;line-height:1.6;">
      This invitation expires in ${days} day${days !== 1 ? "s" : ""}. Clicking the button will let you set your password and access your account.
    </p>

    <hr style="border:none;border-top:1px solid #f4f4f5;margin:24px 0 20px;" />
    <p style="font-size:12px;color:#a1a1aa;line-height:1.6;">
      Can't click the button? Copy and paste this link into your browser:<br/>
      <span style="color:#6366f1;word-break:break-all;">${opts.inviteUrl}</span>
    </p>
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `You've been invited to join ${opts.companyName} on CompanyOS`,
    html: baseTemplate(content, `${opts.inviterName} invited you to join ${opts.companyName}`),
  });

  if (error) throw new Error(error.message);
}

export async function sendResendInviteEmail(opts: ResendEmailOptions) {
  const roleLabel = ROLE_LABELS[opts.role] ?? opts.role;

  const content = `
    <!-- Icon -->
    <div style="width:52px;height:52px;background:#fef3c7;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;">
      <span style="font-size:26px;">🔔</span>
    </div>

    <h1 style="font-size:22px;font-weight:700;color:#09090b;margin-bottom:8px;line-height:1.3;">
      Invitation reminder — ${opts.companyName}
    </h1>
    <p style="font-size:15px;color:#52525b;line-height:1.6;">
      Just a reminder that you have a pending invitation to join <strong>${opts.companyName}</strong> on CompanyOS as a <strong>${roleLabel}</strong>.
    </p>
    <p style="font-size:13px;color:#71717a;margin-top:8px;">
      Your invitation link has been refreshed and is valid for another 7 days.
    </p>

    ${ctaButton(opts.inviteUrl, "Accept Invitation &rarr;")}

    <hr style="border:none;border-top:1px solid #f4f4f5;margin:24px 0 20px;" />
    <p style="font-size:12px;color:#a1a1aa;line-height:1.6;">
      Can't click the button? Copy and paste this link into your browser:<br/>
      <span style="color:#6366f1;word-break:break-all;">${opts.inviteUrl}</span>
    </p>
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Reminder: Your invitation to join ${opts.companyName}`,
    html: baseTemplate(content, `Your invitation to join ${opts.companyName} is still waiting`),
  });

  if (error) throw new Error(error.message);
}
