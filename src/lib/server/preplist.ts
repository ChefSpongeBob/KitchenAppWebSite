import { fail } from '@sveltejs/kit';

type ItemRow = {
	id: string;
	content: string;
	amount: number;
	par_count: number;
	is_checked: number;
};

type DB = App.Platform['env']['DB'];
type PreplistLocals = {
	DB?: DB;
	userRole?: string | null;
};

export function createPreplistPage(sectionSlug: string, pageTitle: string) {
	const load = async ({ locals }: { locals: PreplistLocals }) => {
		const db = locals.DB;
		if (!db) return { title: pageTitle, items: [], isAdmin: false };

		const section = await db
			.prepare(`SELECT id FROM list_sections WHERE domain = 'preplists' AND slug = ? LIMIT 1`)
			.bind(sectionSlug)
			.first<{ id: string }>();

		if (!section) return { title: pageTitle, items: [], isAdmin: locals.userRole === 'admin' };

		const items = await db
			.prepare(
				`
        SELECT id, content, amount, par_count, is_checked
        FROM list_items
        WHERE section_id = ?
        ORDER BY sort_order ASC, created_at ASC
      `
			)
			.bind(section.id)
			.all<ItemRow>();

		return {
			title: pageTitle,
			items: items.results ?? [],
			isAdmin: locals.userRole === 'admin'
		};
	};

	const actions = {
		submit_prep_counts: async ({ request, locals }: { request: Request; locals: PreplistLocals }) => {
			const db = locals.DB;
			if (!db) return fail(503, { error: 'Database not configured.' });

			const section = await db
				.prepare(`SELECT id FROM list_sections WHERE domain = 'preplists' AND slug = ? LIMIT 1`)
				.bind(sectionSlug)
				.first<{ id: string }>();
			if (!section) return fail(404, { error: 'Prep section not found.' });

			const formData = await request.formData();
			const items = await db
				.prepare(`SELECT id FROM list_items WHERE section_id = ?`)
				.bind(section.id)
				.all<{ id: string }>();

			const now = Math.floor(Date.now() / 1000);
			for (const item of items.results ?? []) {
				const raw = formData.get(`amount_${item.id}`);
				if (raw === null) continue;
				const amount = Number(raw);
				if (!Number.isFinite(amount) || amount < 0) return fail(400, { error: 'Invalid prep amount.' });

				await db
					.prepare(`UPDATE list_items SET amount = ?, updated_at = ? WHERE id = ?`)
					.bind(amount, now, item.id)
					.run();
			}

			return { success: true };
		},
		toggle_checked: async ({ request, locals }: { request: Request; locals: PreplistLocals }) => {
			const db = locals.DB;
			if (!db) return fail(503, { error: 'Database not configured.' });

			const formData = await request.formData();
			const id = String(formData.get('id') ?? '');
			const isChecked = Number(formData.get('is_checked'));
			if (!id || (isChecked !== 0 && isChecked !== 1))
				return fail(400, { error: 'Invalid completion state.' });

			await db
				.prepare(`UPDATE list_items SET is_checked = ?, updated_at = ? WHERE id = ?`)
				.bind(isChecked, Math.floor(Date.now() / 1000), id)
				.run();

			return { success: true };
		},
		save_par_levels: async ({ request, locals }: { request: Request; locals: PreplistLocals }) => {
			if (locals.userRole !== 'admin') return fail(403, { error: 'Admin only.' });
			const db = locals.DB;
			if (!db) return fail(503, { error: 'Database not configured.' });

			const section = await db
				.prepare(`SELECT id FROM list_sections WHERE domain = 'preplists' AND slug = ? LIMIT 1`)
				.bind(sectionSlug)
				.first<{ id: string }>();
			if (!section) return fail(404, { error: 'Prep section not found.' });

			const formData = await request.formData();
			const items = await db
				.prepare(`SELECT id FROM list_items WHERE section_id = ?`)
				.bind(section.id)
				.all<{ id: string }>();

			const now = Math.floor(Date.now() / 1000);
			for (const item of items.results ?? []) {
				const raw = formData.get(`par_${item.id}`);
				if (raw === null) continue;
				const parCount = Number(raw);
				if (!Number.isFinite(parCount) || parCount < 0) return fail(400, { error: 'Invalid par count.' });

				await db
					.prepare(`UPDATE list_items SET par_count = ?, updated_at = ? WHERE id = ?`)
					.bind(parCount, now, item.id)
					.run();
			}

			return { success: true };
		}
	};

	return { load, actions };
}
