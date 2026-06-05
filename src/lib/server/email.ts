type EmailEnv = Partial<App.Platform['env']> & {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO_EMAIL?: string;
  APP_BASE_URL?: string;
};

export type EmailSendResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  id?: string;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractErrorMessage(body: string) {
  if (!body) return '';

  try {
    const parsed = JSON.parse(body) as {
      message?: string;
      error?: { message?: string };
      name?: string;
    };

    return parsed.message || parsed.error?.message || parsed.name || body;
  } catch {
    return body;
  }
}

function renderCriminiEmail({
  eyebrow = 'Crimini',
  title,
  body,
  actionLabel,
  actionUrl,
  footer = 'Crimini by NNS, LLC'
}: {
  eyebrow?: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  footer?: string;
}) {
  const safeEyebrow = escapeHtml(eyebrow);
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeFooter = escapeHtml(footer);
  const safeActionUrl = actionUrl ? escapeHtml(actionUrl) : '';
  const safeActionLabel = actionLabel ? escapeHtml(actionLabel) : '';

  return `
    <div style="margin:0;padding:0;background:#f7f2e8;color:#181716;font-family:Georgia,'Times New Roman',serif;">
      <div style="max-width:620px;margin:0 auto;padding:30px 18px;">
        <div style="background:#fffdf8;border:1px solid #ded2bf;border-radius:24px;padding:28px;">
          <p style="margin:0 0 12px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#7a6f61;">${safeEyebrow}</p>
          <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;font-weight:400;color:#181716;">${safeTitle}</h1>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#292520;">${safeBody}</p>
          ${
            safeActionUrl && safeActionLabel
              ? `<a href="${safeActionUrl}" style="display:inline-block;background:#181716;color:#fffdf8;text-decoration:none;border-radius:999px;padding:13px 22px;font-size:15px;letter-spacing:.03em;">${safeActionLabel}</a>`
              : ''
          }
          ${
            safeActionUrl
              ? `<p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#746b60;word-break:break-all;">${safeActionUrl}</p>`
              : ''
          }
          <div style="height:1px;width:100%;margin:26px 0 16px;background:linear-gradient(90deg,transparent,#b7aa98,transparent);"></div>
          <p style="margin:0;color:#746b60;font-size:12px;line-height:1.5;">${safeFooter}</p>
        </div>
      </div>
    </div>
  `;
}

export function isEmailConfigured(env?: EmailEnv | null) {
  return Boolean(env?.RESEND_API_KEY && env?.RESEND_FROM_EMAIL);
}

export function getAppBaseUrl(origin: string, env?: EmailEnv | null) {
  const configured = env?.APP_BASE_URL?.trim();
  return trimTrailingSlash(configured || origin);
}

export async function sendTransactionalEmail({
  env,
  to,
  subject,
  html,
  text,
  replyTo,
  idempotencyKey
}: {
  env?: EmailEnv | null;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
}): Promise<EmailSendResult> {
  if (!isEmailConfigured(env)) {
    return {
      sent: false,
      skipped: true,
      reason: 'Email delivery is not configured yet.'
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env?.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Crimini/1.0',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
      },
      body: JSON.stringify({
        from: env?.RESEND_FROM_EMAIL,
        to,
        subject,
        html,
        text,
        reply_to: replyTo || env?.RESEND_REPLY_TO_EMAIL || undefined
      })
    });

    if (!response.ok) {
      const body = await response.text();
      const errorMessage = extractErrorMessage(body);
      console.error('Resend email send failed:', response.status, body);
      return {
        sent: false,
        reason: errorMessage
          ? `Email send failed (${response.status}): ${errorMessage}`
          : `Email send failed (${response.status}).`
      };
    }

    const data = (await response.json()) as { id?: string };
    return {
      sent: true,
      id: data.id
    };
  } catch (error) {
    console.error('Resend request failed:', error);
    return {
      sent: false,
      reason: 'Email provider request failed.'
    };
  }
}

export async function sendInviteEmail({
  env,
  origin,
  inviteeEmail,
  inviteCode,
  expiresAt,
  businessName
}: {
  env?: EmailEnv | null;
  origin: string;
  inviteeEmail: string;
  inviteCode: string;
  expiresAt: number | null;
  businessName?: string | null;
}) {
  const baseUrl = getAppBaseUrl(origin, env);
  const registerUrl = `${baseUrl}/register?invite=${encodeURIComponent(inviteCode)}`;
  const logoUrl = `${baseUrl}/crimini-full-logo.jpg`;
  const expirationText = expiresAt
    ? new Date(expiresAt * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'soon';

  const safeRegisterUrl = escapeHtml(registerUrl);
  const safeLogoUrl = escapeHtml(logoUrl);
  const safeBusinessName = escapeHtml(businessName?.trim() || 'your workspace');
  const subjectBusinessName = businessName?.trim() || 'Your team';

  return sendTransactionalEmail({
    env,
    to: inviteeEmail,
    subject: `${subjectBusinessName} invited you to Crimini`,
    html: `
      <div style="margin:0;padding:0;background:#f7f2e8;color:#181716;font-family:Georgia,'Times New Roman',serif;">
        <div style="max-width:640px;margin:0 auto;padding:34px 18px;">
          <div style="background:#fffdf8;border:1px solid #ded2bf;border-radius:28px;overflow:hidden;">
            <div style="padding:28px 28px 18px;text-align:center;border-bottom:1px solid #ded2bf;">
              <img src="${safeLogoUrl}" alt="Crimini" style="display:block;width:180px;max-width:70%;height:auto;margin:0 auto 18px;" />
              <div style="height:1px;width:100%;background:linear-gradient(90deg,transparent,#b7aa98,transparent);"></div>
            </div>
            <div style="padding:34px 28px 30px;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#7a6f61;">Employee Onboarding</p>
              <h1 style="margin:0 0 14px;font-size:32px;line-height:1.05;font-weight:400;color:#181716;">Welcome to ${safeBusinessName}</h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4c463f;">Complete your Crimini setup and onboarding packet.</p>
              <a href="${safeRegisterUrl}" style="display:inline-block;background:#181716;color:#fffdf8;text-decoration:none;border-radius:999px;padding:14px 24px;font-size:15px;letter-spacing:.03em;">Complete onboarding</a>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#746b60;">Expires ${escapeHtml(expirationText)}.</p>
            </div>
            <div style="padding:18px 28px 26px;border-top:1px solid #ded2bf;color:#746b60;font-size:12px;line-height:1.5;">
              <p style="margin:0 0 8px;">If the button does not open, use this link:</p>
              <a href="${safeRegisterUrl}" style="color:#181716;word-break:break-all;">${safeRegisterUrl}</a>
              <p style="margin:18px 0 0;">Crimini by NNS, LLC</p>
            </div>
          </div>
        </div>
      </div>
    `,
    text: [
      `${subjectBusinessName} invited you to Crimini.`,
      '',
      'Complete your setup and onboarding packet:',
      registerUrl,
      '',
      `Expires: ${expirationText}`,
      '',
      'Crimini by NNS, LLC'
    ].join('\n'),
    idempotencyKey: `invite/${inviteCode}`
  });
}

export async function sendApprovalEmail({
  env,
  origin,
  userEmail,
  displayName
}: {
  env?: EmailEnv | null;
  origin: string;
  userEmail: string;
  displayName?: string | null;
}) {
  const baseUrl = getAppBaseUrl(origin, env);
  const loginUrl = `${baseUrl}/login`;
  const name = displayName?.trim() || 'there';

  return sendTransactionalEmail({
    env,
    to: userEmail,
    subject: 'Your Crimini access has been approved',
    html: renderCriminiEmail({
      eyebrow: 'Access Approved',
      title: 'Your Crimini access is ready',
      body: `Hi ${name}, your account is approved and ready to use.`,
      actionLabel: 'Sign in',
      actionUrl: loginUrl
    }),
    text: [
      `Hi ${displayName?.trim() || 'there'},`,
      '',
      'Your Crimini account is now approved and ready to use.',
      `Sign in here: ${loginUrl}`
    ].join('\n'),
    idempotencyKey: `approval/${userEmail.toLowerCase()}`
  });
}

export async function sendPasswordResetEmail({
  env,
  origin,
  userEmail,
  displayName,
  resetToken
}: {
  env?: EmailEnv | null;
  origin: string;
  userEmail: string;
  displayName?: string | null;
  resetToken: string;
}) {
  const baseUrl = getAppBaseUrl(origin, env);
  const resetUrl = `${baseUrl}/reset-password/${resetToken}`;
  const name = displayName?.trim() || 'there';

  return sendTransactionalEmail({
    env,
    to: userEmail,
    subject: 'Reset your Crimini password',
    html: renderCriminiEmail({
      eyebrow: 'Password Reset',
      title: 'Reset your password',
      body: `Hi ${name}, use this link to set a new password. It expires in 2 hours.`,
      actionLabel: 'Reset password',
      actionUrl: resetUrl
    }),
    text: [
      `Hi ${displayName?.trim() || 'there'},`,
      '',
      'Use this link to reset your Crimini password:',
      resetUrl,
      '',
      'This link expires in 2 hours.'
    ].join('\n'),
    idempotencyKey: `password-reset/${resetToken.slice(0, 24)}`
  });
}
