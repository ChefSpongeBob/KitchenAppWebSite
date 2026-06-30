import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireBusinessId } from '$lib/server/tenant';
import { recordOperationalEventBestEffort } from '$lib/server/operationalEvents';
import { normalizeFormText } from '$lib/server/inputSanitizer';

function textValue(form: FormData, key: string, maxLength: number) {
	return normalizeFormText(form, key, { maxLength });
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.userId) throw redirect(303, '/login');
	const db = locals.DB;
	if (!db) return { entries: [] };
	const businessId = requireBusinessId(locals);

	const rows = await db
		.prepare(
			`
			SELECT
				w.id,
				w.product,
				w.amount,
				w.unit,
				w.reason,
				w.notes,
				w.created_at,
				COALESCE(u.display_name, u.email, 'Unknown') AS submitted_by_name
			FROM waste_logs w
			LEFT JOIN users u ON u.id = w.submitted_by_user_id
			WHERE w.business_id = ?
			ORDER BY w.created_at DESC
			LIMIT 25
			`
		)
		.bind(businessId)
		.all<{
			id: string;
			product: string;
			amount: number | null;
			unit: string;
			reason: string;
			notes: string;
			created_at: number;
			submitted_by_name: string;
		}>();

	return { entries: rows.results ?? [] };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.userId) throw redirect(303, '/login');
		const db = locals.DB;
		if (!db) return fail(503, { error: 'Database unavailable.' });

		const businessId = requireBusinessId(locals);
		const form = await request.formData();
		const product = textValue(form, 'product', 120);
		const amountRaw = String(form.get('amount') ?? '').trim();
		const unit = textValue(form, 'unit', 24);
		const reason = textValue(form, 'reason', 160);
		const notes = textValue(form, 'notes', 300);
		const amount = amountRaw ? Number(amountRaw) : null;

		if (!product || !reason) {
			return fail(400, { error: 'Product and reason are required.', product, amount: amountRaw, unit, reason, notes });
		}
		if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
			return fail(400, { error: 'Enter a valid amount.', product, amount: amountRaw, unit, reason, notes });
		}

		const now = Math.floor(Date.now() / 1000);
		const id = crypto.randomUUID();
		await db
			.prepare(
				`
				INSERT INTO waste_logs (
					id,
					business_id,
					submitted_by_user_id,
					product,
					amount,
					unit,
					reason,
					notes,
					created_at
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				`
			)
			.bind(id, businessId, locals.userId, product, amount, unit, reason, notes, now)
			.run();

		await recordOperationalEventBestEffort(db, {
			businessId,
			eventType: 'waste.submitted',
			category: 'lists',
			actorUserId: locals.userId,
			subjectType: 'waste_log',
			subjectId: id,
			title: 'Waste submitted',
			payload: { product, amount, unit, reason }
		}, request);

		return { success: true };
	}
};
