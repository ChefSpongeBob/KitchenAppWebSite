import { error, fail, isHttpError, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupportRequest, customerSupportContext, listSupportRequests, loadSupportRequest, readSupportForm, updateSupportRequest } from '#lib/server/platformSupport.ts';
import { checkRateLimit } from '#lib/server/security.ts';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  const context = await customerSupportContext(locals);
  if (!context) return { canRequest: false, businessName: null, queue: null, detail: null, submissionId: null };
  const id = url.searchParams.get('request');
  const listing = new URL(url); listing.searchParams.set('status', 'all');
  return { canRequest: true, businessName: locals.businessName ?? 'Your Business', submissionId: crypto.randomUUID(),
    queue: id ? null : await listSupportRequests(locals.DB, listing, { customer: context }),
    detail: id ? await loadSupportRequest(locals.DB, id, context, url) : null };
};

async function submit(event: Parameters<Actions[string]>[0], reply: boolean) {
  const context = await customerSupportContext(event.locals);
  if (!context) error(401, 'Sign in to your restaurant account to request help.');
  const limit = await checkRateLimit(event.locals.DB, { action: 'customer-support-write', identifier: `${context.businessId}:${context.userId}`,
    limit: 12, windowSeconds: 900, blockSeconds: 300 });
  if (!limit.allowed) return fail(429, { error: 'Please wait before sending another support message.' });
  const businessLimit = await checkRateLimit(event.locals.DB, { action: reply ? 'business-support-reply' : 'business-support-create',
    identifier: context.businessId, limit: reply ? 120 : 30, windowSeconds: 3600, blockSeconds: 300 });
  if (!businessLimit.allowed) return fail(429, { error: 'This business has reached its support-request limit. Please try again later or email support.' });
  const form = await readSupportForm(event.request);
  const input = Object.fromEntries(['subject', 'body', 'category', 'priority', 'submission_id', 'revision'].map(key => [key, form.get(key)]));
  let id = String(form.get('request_id') ?? '');
  try {
    if (reply) await updateSupportRequest(event.locals.DB, context, id, input);
    else id = await createSupportRequest(event.locals.DB, context, input);
  } catch (err) {
    if (isHttpError(err)) return fail(err.status, { error: err.body.message });
    return fail(503, { error: 'Support could not save your message. Please try again.' });
  }
  redirect(303, `/support?request=${encodeURIComponent(id)}`);
}

export const actions: Actions = { create: event => submit(event, false), reply: event => submit(event, true) };
