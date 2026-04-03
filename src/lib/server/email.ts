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
      console.error('Resend email send failed:', response.status, body);
      return {
        sent: false,
        reason: `Email send failed (${response.status}).`
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
  expiresAt
}: {
  env?: EmailEnv | null;
  origin: string;
  inviteeEmail: string;
  inviteCode: string;
  expiresAt: number | null;
}) {
  const baseUrl = getAppBaseUrl(origin, env);
  const registerUrl = `${baseUrl}/register`;
  const expirationText = expiresAt
    ? new Date(expiresAt * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'soon';

  const safeCode = escapeHtml(inviteCode);
  const safeRegisterUrl = escapeHtml(registerUrl);

  return sendTransactionalEmail({
    env,
    to: inviteeEmail,
    subject: 'You have been invited to KitchenApp',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="margin-bottom: 0.5rem;">You have been invited to KitchenApp</h2>
        <p>An admin created an invite for this email address.</p>
        <p>Use this invite code when you register:</p>
        <p style="font-size: 1.1rem; font-weight: 700; letter-spacing: 0.06em;">${safeCode}</p>
        <p>This invite currently expires on ${escapeHtml(expirationText)}.</p>
        <p>
          Register here:
          <a href="${safeRegisterUrl}">${safeRegisterUrl}</a>
        </p>
        <p>After registering, an admin still needs to approve your access before first login.</p>
      </div>
    `,
    text: [
      'You have been invited to KitchenApp.',
      '',
      `Invite code: ${inviteCode}`,
      `Register here: ${registerUrl}`,
      `Invite expires: ${expirationText}`,
      '',
      'After registering, an admin still needs to approve your access before first login.'
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
  const safeName = escapeHtml(displayName?.trim() || 'there');
  const safeLoginUrl = escapeHtml(loginUrl);

  return sendTransactionalEmail({
    env,
    to: userEmail,
    subject: 'Your KitchenApp access has been approved',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="margin-bottom: 0.5rem;">Your access has been approved</h2>
        <p>Hi ${safeName},</p>
        <p>Your KitchenApp account is now approved and ready to use.</p>
        <p>
          Sign in here:
          <a href="${safeLoginUrl}">${safeLoginUrl}</a>
        </p>
      </div>
    `,
    text: [
      `Hi ${displayName?.trim() || 'there'},`,
      '',
      'Your KitchenApp account is now approved and ready to use.',
      `Sign in here: ${loginUrl}`
    ].join('\n'),
    idempotencyKey: `approval/${userEmail.toLowerCase()}`
  });
}
