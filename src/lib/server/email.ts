type EmailEnv = Partial<App.RuntimeEnv> & {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO_EMAIL?: string;
  APP_BASE_URL?: string;
};

import { PLAN_PRICES } from '#lib/billing/pricing.ts';

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

export function renderCriminiEmail({
  eyebrow = '',
  title,
  body,
  actionLabel,
  actionUrl,
  details = [],
  note,
  footer = 'Crimini by NNS, LLC'
}: {
  eyebrow?: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  details?: ReadonlyArray<{ label: string; value: string }>;
  note?: string;
  footer?: string;
}) {
  const safeEyebrow = escapeHtml(eyebrow);
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeFooter = escapeHtml(footer);
  const safeActionUrl = actionUrl ? escapeHtml(actionUrl) : '';
  const safeActionLabel = actionLabel ? escapeHtml(actionLabel) : '';
  const font = "'Manrope','Aptos','Segoe UI',Helvetica,sans-serif";
  const divider = '<tr><td height="1" style="height:1px;line-height:1px;font-size:1px;background-color:#deded8;background-image:linear-gradient(90deg,#ffffff,#d4d4ce,#ffffff);">&nbsp;</td></tr>';

  // Inline styles and presentation tables keep the layout usable without web fonts or modern CSS.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f1;color:#111214;font-family:${font};-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f1">
    <tr><td align="center" style="padding:24px 12px;">
      <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;margin:0 auto;background-color:#ffffff;">
        <tr><td style="padding:12px 28px 4px;">
          <img src="https://criminiops.com/crimini-full-logo.jpg" width="144" height="108" alt="Crimini" style="display:block;width:144px;max-width:100%;height:auto;border:0;color:#111214;font-size:20px;" />
        </td></tr>
        <tr><td style="padding:0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${divider}</table>
        </td></tr>
        <tr><td style="padding:28px;font-family:${font};">
          ${safeEyebrow ? `<p style="margin:0 0 10px;font-size:12px;line-height:18px;letter-spacing:0.06em;text-transform:uppercase;color:#62645f;">${safeEyebrow}</p>` : ''}
          <h1 style="margin:0 0 18px;font-size:26px;line-height:34px;font-weight:600;letter-spacing:-0.02em;color:#111214;">${safeTitle}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:25px;color:#41433f;overflow-wrap:anywhere;">${safeBody}</p>
          ${details.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fbf7ef" style="margin:0 0 20px;background-color:#fbf7ef;">
            ${details.map(({ label, value }) => `<tr><td style="padding:8px 14px;font-family:${font};font-size:14px;line-height:22px;color:#41433f;overflow-wrap:anywhere;"><strong style="font-weight:600;color:#111214;">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</td></tr>`).join('')}
          </table>` : ''}
          ${safeActionUrl && safeActionLabel ? `<p style="margin:0 0 8px;"><a href="${safeActionUrl}" style="display:inline-block;padding:12px 0;border-bottom:1px solid #8f826e;color:#111214;font-size:14px;line-height:20px;font-weight:600;text-decoration:none;">${safeActionLabel}</a></p>` : ''}
          ${note ? `<p style="margin:16px 0 0;font-size:13px;line-height:21px;color:#62645f;">${escapeHtml(note)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${divider}</table>
        </td></tr>
        <tr><td style="padding:20px 28px 28px;font-family:${font};font-size:12px;line-height:20px;color:#62645f;">
          ${safeActionUrl ? `<p style="margin:0 0 16px;">If the link above does not open, use:<br /><a href="${safeActionUrl}" style="color:#41433f;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${safeActionUrl}</a></p>` : ''}
          <p style="margin:0 0 8px;">${safeFooter}</p>
          <p style="margin:0;"><a href="https://criminiops.com/support" style="color:#41433f;text-decoration:underline;">Support</a><span aria-hidden="true"> &nbsp;|&nbsp; </span><a href="https://criminiops.com/privacy" style="color:#41433f;text-decoration:underline;">Privacy</a></p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
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
  idempotencyKey,
  sensitive = false
}: {
  env?: EmailEnv | null;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
  sensitive?: boolean;
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
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
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

    if (response.status >= 300 && response.status < 400) {
      console.error('Resend email send failed:', response.status, 'Redirect rejected.');
      return { sent: false, reason: 'Email provider returned an unexpected redirect.' };
    }

    if (!response.ok) {
      const body = await response.text();
      const errorMessage = sensitive ? '' : extractErrorMessage(body);
      console.error('Resend email send failed:', response.status, errorMessage || 'Provider rejected the request.');
      return {
        sent: false,
        reason: errorMessage
          ? `Email send failed (${response.status}): ${errorMessage}`
          : `Email send failed (${response.status}).`
      };
    }

    const data = (await response.json()) as { id?: string };
    if (typeof data?.id !== 'string' || !data.id.trim()) {
      return { sent: false, reason: 'Email provider did not confirm acceptance.' };
    }
    return {
      sent: true,
      id: data.id
    };
  } catch (error) {
    console.error('Resend request failed:', sensitive ? 'Sensitive email request failed.' : error);
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
  businessName,
  onboardingRequired = true
}: {
  env?: EmailEnv | null;
  origin: string;
  inviteeEmail: string;
  inviteCode: string;
  expiresAt: number | null;
  businessName?: string | null;
  onboardingRequired?: boolean;
}) {
  const baseUrl = getAppBaseUrl(origin, env);
  const registerUrl = `${baseUrl}/register?invite=${encodeURIComponent(inviteCode)}`;
  const expirationText = expiresAt
    ? new Date(expiresAt * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'soon';

  const subjectBusinessName = businessName?.trim() || 'Your team';
  const bodyText = onboardingRequired
    ? 'Complete your Crimini setup and onboarding forms.'
    : 'Complete your Crimini setup.';
  const actionLabel = onboardingRequired ? 'Complete onboarding' : 'Create account';

  return sendTransactionalEmail({
    env,
    to: inviteeEmail,
    subject: `${subjectBusinessName} invited you to Crimini`,
    html: renderCriminiEmail({
      eyebrow: 'Employee Onboarding',
      title: `Welcome to ${businessName?.trim() || 'your workspace'}`,
      body: bodyText,
      actionLabel,
      actionUrl: registerUrl,
      note: `Expires ${expirationText}.`
    }),
    text: [
      `${subjectBusinessName} invited you to Crimini.`,
      '',
      onboardingRequired ? 'Complete your setup and onboarding forms:' : 'Complete your setup:',
      registerUrl,
      '',
      `Expires: ${expirationText}`,
      '',
      'Crimini by NNS, LLC'
    ].join('\n'),
    idempotencyKey: `invite/${inviteCode}`
  });
}

export async function sendEmployeeOnboardingPackageEmail({
  env,
  origin,
  employeeEmail,
  employeeName,
  businessName,
  packageId
}: {
  env?: EmailEnv | null;
  origin: string;
  employeeEmail: string;
  employeeName?: string | null;
  businessName?: string | null;
  packageId: string;
}) {
  const baseUrl = getAppBaseUrl(origin, env);
  const onboardingUrl = `${baseUrl}/onboarding`;
  const workspaceName = businessName?.trim() || 'Your employer';
  const greetingName = employeeName?.trim() || 'there';
  const body = `${workspaceName} sent you an employee onboarding packet. Sign in to complete and submit it for review.`;

  return sendTransactionalEmail({
    env,
    to: employeeEmail,
    subject: `${workspaceName} sent your onboarding packet`,
    html: renderCriminiEmail({
      eyebrow: 'Employee Onboarding',
      title: `Hello ${greetingName}`,
      body,
      actionLabel: 'Open onboarding packet',
      actionUrl: onboardingUrl
    }),
    text: [
      `Hello ${greetingName},`,
      '',
      body,
      onboardingUrl,
      '',
      'Crimini by NNS, LLC'
    ].join('\n'),
    idempotencyKey: `onboarding-package/${packageId}`
  });
}

function signupPlanDetails(planTier: string) {
  const normalized = planTier.trim().toLowerCase();
  if (normalized === 'growth' || normalized === 'medium') {
    return {
      label: 'Medium',
      price: `$${PLAN_PRICES.growth}/mo`,
      features: 'Up to 75 employees with scheduling, lists, recipes, docs, ToDo, whiteboard, reports, vendors, and tools.'
    };
  }
  if (normalized === 'enterprise' || normalized === 'large') {
    return {
      label: 'Large',
      price: `$${PLAN_PRICES.enterprise}/mo`,
      features: 'Up to 250 employees with full workspace tools, multi-team operations, reporting, vendors, and tools.'
    };
  }
  return {
    label: 'Small',
    price: `$${PLAN_PRICES.starter}/mo`,
    features: 'Up to 20 employees with core scheduling, lists, recipes, docs, ToDo, whiteboard, reports, vendors, and tools.'
  };
}

export async function sendSignupConfirmationEmail({
  env,
  origin,
  ownerEmail,
  ownerName,
  ownerTitle,
  businessName,
  planTier
}: {
  env?: EmailEnv | null;
  origin: string;
  ownerEmail: string;
  ownerName: string;
  ownerTitle?: string | null;
  businessName: string;
  planTier: string;
}) {
  const baseUrl = getAppBaseUrl(origin, env);
  const loginUrl = `${baseUrl}/login`;
  const plan = signupPlanDetails(planTier);
  const billingText = 'Billing activation continues through the app store setup path.';

  return sendTransactionalEmail({
    env,
    to: ownerEmail,
    subject: 'Welcome to Crimini',
    html: renderCriminiEmail({
      eyebrow: 'Signup Confirmed',
      title: 'Thank you for choosing Crimini.',
      body: `${billingText} ${plan.features}`,
      details: [
        { label: 'Restaurant', value: businessName },
        { label: 'Account owner', value: ownerName },
        { label: 'Title', value: ownerTitle?.trim() || 'Owner / Manager' },
        { label: 'Plan', value: `${plan.label} - ${plan.price}` }
      ],
      actionLabel: 'Open Crimini',
      actionUrl: loginUrl
    }),
    text: [
      'Thank you for choosing Crimini.',
      '',
      `Restaurant: ${businessName}`,
      `Account owner: ${ownerName}`,
      `Title: ${ownerTitle?.trim() || 'Owner / Manager'}`,
      `Plan: ${plan.label} - ${plan.price}`,
      '',
      billingText,
      plan.features,
      '',
      `Open Crimini: ${loginUrl}`,
      '',
      'Crimini by NNS, LLC'
    ].join('\n'),
    idempotencyKey: `signup/${ownerEmail.toLowerCase()}`
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

export async function sendAccountDeletionRequestEmail({
  env,
  origin,
  userEmail,
  workspaceName,
  requestScope,
  requestId
}: {
  env?: EmailEnv | null;
  origin: string;
  userEmail: string;
  workspaceName?: string | null;
  requestScope: 'user' | 'workspace';
  requestId: string;
}) {
  const baseUrl = getAppBaseUrl(origin, env);
  const supportUrl = `${baseUrl}/support`;
  const scopeLabel = requestScope === 'workspace' ? 'workspace' : 'account';
  const workspaceText = workspaceName?.trim() ? ` for ${workspaceName.trim()}` : '';

  return sendTransactionalEmail({
    env,
    to: userEmail,
    subject: 'Crimini deletion request received',
    html: renderCriminiEmail({
      eyebrow: 'Deletion Request',
      title: 'We received your request',
      body: `Your ${scopeLabel} deletion request${workspaceText} is now pending review. We will contact you if verification or additional information is needed.`,
      actionLabel: 'Contact support',
      actionUrl: supportUrl
    }),
    text: [
      'We received your Crimini deletion request.',
      '',
      `Your ${scopeLabel} deletion request${workspaceText} is now pending review.`,
      'We will contact you if verification or additional information is needed.',
      '',
      `Support: ${supportUrl}`
    ].join('\n'),
    idempotencyKey: `account-deletion/${requestId}`
  });
}
