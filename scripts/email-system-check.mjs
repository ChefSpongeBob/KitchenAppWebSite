import { existsSync, readFileSync } from 'node:fs';

const checks = [];

function read(path) {
  return readFileSync(path, 'utf8');
}

function expect(path, label, predicate) {
  if (!existsSync(path)) {
    checks.push({ ok: false, label, detail: `${path} does not exist.` });
    return;
  }
  const source = read(path);
  checks.push({ ok: Boolean(predicate(source)), label, detail: path });
}

expect('src/lib/server/email.ts', 'central email helper uses Resend safely', (source) =>
  source.includes('sendTransactionalEmail') &&
  source.includes('https://api.resend.com/emails') &&
  source.includes('Idempotency-Key') &&
  source.includes('RESEND_API_KEY') &&
  source.includes('RESEND_FROM_EMAIL') &&
  source.includes('RESEND_REPLY_TO_EMAIL') &&
  source.includes('renderCriminiEmail')
);

expect('src/lib/server/email.ts', 'direct user emails are branded and wired', (source) =>
  source.includes('sendInviteEmail') &&
  source.includes('sendApprovalEmail') &&
  source.includes('sendPasswordResetEmail') &&
  source.includes('Employee Onboarding') &&
  source.includes('Access Approved') &&
  source.includes('Password Reset') &&
  !source.includes('font-family: Arial')
);

expect('src/lib/server/admin.ts', 'admin invite and approval emails use the central helper', (source) =>
  source.includes('sendInviteEmail') &&
  source.includes('sendApprovalEmail') &&
  source.includes('Invite created and email sent.') &&
  source.includes('Access restored and approval email sent.')
);

expect('src/routes/forgot-password/+page.server.ts', 'password reset requires successful email delivery', (source) =>
  source.includes('sendPasswordResetEmail') &&
  source.includes('deletePasswordResetRecordById') &&
  source.includes('password_reset_email_failed')
);

expect('src/lib/server/operationalEvents.ts', 'operational events resolve email recipients by event intent', (source) =>
  source.includes('loadEventEmailRecipients') &&
  source.includes('loadRecipientsWithCapability') &&
  source.includes('resolveBusinessCapabilities') &&
  source.includes("event.event_type === 'schedule.published'") &&
  source.includes("event.event_type.startsWith('temperature.')") &&
  source.includes("event.event_type.startsWith('camera.')") &&
  source.includes('email_updates') &&
  source.includes('operational/${event.id}/email/${recipient.id}')
);

expect('src/lib/server/operationalEvents.ts', 'operational email bodies are event specific', (source) =>
  source.includes('eventBodyFromPayload') &&
  source.includes("case 'schedule.published'") &&
  source.includes("case 'schedule.time_off.requested'") &&
  source.includes("case 'onboarding.item.submitted'") &&
  source.includes("case 'temperature.reading_batch.received'") &&
  source.includes("case 'camera.activity.received'") &&
  source.includes("event.event_type.startsWith('list.')") &&
  source.includes("event.event_type.endsWith('.completed')") &&
  source.includes("event.event_type.startsWith('billing.store_purchase.')")
);

expect('src/routes/api/internal/operational-events/process/+server.ts', 'email delivery processor remains internal-token protected', (source) =>
  source.includes('SMOKE_INTERNAL_TOKEN') &&
  source.includes('processOperationalEvents') &&
  source.includes('Not found.')
);

expect('docs/PROJECT_HANDOFF.md', 'handoff tracks Phase 3 email status', (source) =>
  source.includes('`3. Email system completion`') &&
  source.includes('Email system completion') &&
  source.includes('RESEND_API_KEY') &&
  source.includes('Run deferred Phase 3 real email flow tests')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
