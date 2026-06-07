<script lang="ts">
	import { enhance } from '$app/forms';
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	export let data: {
		entries: Array<{
			id: string;
			product: string;
			amount: number | null;
			unit: string;
			reason: string;
			notes: string;
			created_at: number;
			submitted_by_name: string;
		}>;
	};

	export let form:
		| {
				error?: string;
				success?: boolean;
				product?: string;
				amount?: string;
				unit?: string;
				reason?: string;
				notes?: string;
		  }
		| undefined;

	const units = ['', 'each', 'oz', 'lb', 'g', 'kg', 'qt', 'gal', 'case', 'pan', 'portion'];

	function dateLabel(timestamp: number) {
		return new Date(timestamp * 1000).toLocaleString([], {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Waste Tracker | Crimini</title>
</svelte:head>

<Layout>
	<PageHeader title="Waste Tracker" />

	<section class="waste-layout">
		<form method="POST" use:enhance={({ formElement }) => {
			return async ({ result, update }) => {
				await update();
				if (result.type === 'success') formElement.reset();
			};
		}} class="waste-form">
			<label class="wide">
				<span>Product</span>
				<input name="product" value={form?.product ?? ''} placeholder="Salmon" required />
			</label>
			<label>
				<span>Amount</span>
				<input name="amount" type="number" min="0" step="any" value={form?.amount ?? ''} placeholder="4" />
			</label>
			<label>
				<span>Unit</span>
				<select name="unit">
					{#each units as unit}
						<option value={unit} selected={(form?.unit ?? '') === unit}>{unit || 'none'}</option>
					{/each}
				</select>
			</label>
			<label class="wide">
				<span>Reason</span>
				<input name="reason" value={form?.reason ?? ''} placeholder="Smells fishy" required />
			</label>
			<label class="wide">
				<span>Notes</span>
				<textarea name="notes" rows="3" placeholder="Optional detail">{form?.notes ?? ''}</textarea>
			</label>
			<div class="form-actions">
				<button type="submit">Submit Waste</button>
				{#if form?.error}
					<p class="error">{form.error}</p>
				{:else if form?.success}
					<p class="success">Waste submitted.</p>
				{/if}
			</div>
		</form>

		<section class="recent-list" aria-label="Recent waste submissions">
			<header>
				<h2>Recent Waste</h2>
				<small>Report exports live under Reports.</small>
			</header>
			{#if data.entries.length === 0}
				<p class="empty-state">No waste submitted yet.</p>
			{:else}
				{#each data.entries as entry}
					<article>
						<div>
							<strong>{entry.product}</strong>
							<small>{entry.amount ?? '-'} {entry.unit}</small>
						</div>
						<p>{entry.reason}</p>
						{#if entry.notes}
							<small>{entry.notes}</small>
						{/if}
						<footer>
							<span>{entry.submitted_by_name}</span>
							<span>{dateLabel(entry.created_at)}</span>
						</footer>
					</article>
				{/each}
			{/if}
		</section>
	</section>
</Layout>

<style>
	.waste-layout {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
		gap: 1rem;
	}

	.waste-form,
	.recent-list {
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
		background: transparent;
	}

	.waste-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0;
		align-content: start;
	}

	label {
		display: grid;
		gap: 0.35rem;
		padding: 0.85rem;
		border-right: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
	}

	.wide {
		grid-column: span 2;
	}

	label span {
		color: var(--color-text-muted);
		font-size: 0.74rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	input,
	select,
	textarea {
		width: 100%;
		border: 0;
		border-bottom: 1px solid var(--color-divider);
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
	}

	.form-actions {
		grid-column: span 2;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		padding: 0.85rem;
	}

	button {
		border: 0;
		border-bottom: 1px solid var(--color-divider);
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
		font-weight: var(--weight-semibold);
	}

	.error {
		color: #8f1f2c;
	}

	.success {
		color: var(--color-text-muted);
	}

	.recent-list {
		display: grid;
		align-content: start;
	}

	.recent-list header,
	.recent-list article,
	.empty-state {
		padding: 0.85rem 0;
		border-bottom: 1px solid var(--color-divider);
	}

	.recent-list header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: end;
	}

	h2,
	p {
		margin: 0;
	}

	.recent-list article {
		display: grid;
		gap: 0.35rem;
	}

	.recent-list article > div,
	.recent-list footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}

	small,
	footer,
	.empty-state {
		color: var(--color-text-muted);
		font-size: 0.84rem;
	}

	@media (max-width: 760px) {
		.waste-layout,
		.waste-form {
			grid-template-columns: 1fr;
		}

		.wide,
		.form-actions {
			grid-column: span 1;
		}

		label {
			border-right: 0;
		}
	}
</style>
