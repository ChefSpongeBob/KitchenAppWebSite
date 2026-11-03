<script lang="ts">
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '$app/forms';
  import Layout from '#lib/components/ui/Layout.svelte';
  import ManagerSectionNav from '#lib/components/ui/ManagerSectionNav.svelte';
  import PageHeader from '#lib/components/ui/PageHeader.svelte';
  import { pushToast } from '#lib/client/toasts.ts';
  import type { AppFeatureKey, AppFeatureMode } from '#lib/features/appFeatures.ts';

  type FeatureRow = {
    key: AppFeatureKey;
    label: string;
    description: string;
    mode: AppFeatureMode;
  };

  export let data: { features: FeatureRow[] };

  let features: FeatureRow[] = data.features.map((feature) => ({ ...feature }));
  let featuresMessage = '';
  let editing = false;

  const featureGroups: Array<{ label: string; keys: AppFeatureKey[] }> = [
    {
      label: 'Operations',
      keys: ['scheduling', 'todo', 'whiteboard', 'announcements', 'employee_spotlight', 'daily_specials']
    },
    { label: 'Content', keys: ['lists', 'recipes', 'documents', 'menus'] },
    { label: 'Tools', keys: ['conversions', 'food_cost_calculator', 'safety_healthcode', 'waste_tracker'] },
    { label: 'Systems', keys: ['temps', 'vendors'] }
  ];

  $: if (data.features) {
    features = data.features.map((feature) => ({ ...feature }));
  }

  const withFeatureSaveFeedback: SubmitFunction = () => {
    featuresMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        editing = false;
      }

      const message =
        result.type === 'success'
          ? (result.data?.message ?? 'Feature Matrix saved.')
          : result.type === 'failure'
            ? (result.data?.error ?? 'Could not save the Feature Matrix.')
            : '';

      if (message) {
        pushToast(message, result.type === 'success' ? 'success' : 'error');
        featuresMessage = message;
      }
    };
  };

  function isLive(mode: AppFeatureMode) {
    return mode !== 'off';
  }

  function statusLabel(mode: AppFeatureMode) {
    if (mode === 'off') return 'Hidden';
    if (mode === 'admin') return 'Manager Only';
    return 'Available';
  }

  function groupFeatures(keys: AppFeatureKey[]) {
    return keys.map((key) => features.find((feature) => feature.key === key)).filter(Boolean) as FeatureRow[];
  }

  function startEditing() {
    editing = true;
  }

  function cancelEditing() {
    features = data.features.map((feature) => ({ ...feature }));
    editing = false;
  }

  $: availableCount = features.filter((feature) => feature.mode === 'all').length;
  $: managerCount = features.filter((feature) => feature.mode === 'admin').length;
  $: hiddenCount = features.filter((feature) => feature.mode === 'off').length;
</script>

<Layout>
  <PageHeader title="Feature Matrix" />
  <ManagerSectionNav groupId="business" />

  <div class="matrix-page">
    <section class="matrix-summary">
      <header class="section-heading">
        <h2>Feature Access</h2>
        {#if editing}
          <button type="button" on:click={cancelEditing}>Close Editor</button>
        {:else}
          <button type="button" on:click={startEditing}>Edit Access</button>
        {/if}
      </header>
      <div class="status-grid">
        <div><span>Available</span><strong>{availableCount}</strong></div>
        <div><span>Manager Only</span><strong>{managerCount}</strong></div>
        <div><span>Hidden</span><strong>{hiddenCount}</strong></div>
      </div>
    </section>

    <form method="POST" action="?/save" use:enhance={withFeatureSaveFeedback} class="matrix-form">
      {#each featureGroups as group}
        <section class="feature-group">
          <header><h2>{group.label}</h2></header>
          <div class="feature-list">
            {#each groupFeatures(group.keys) as feature}
              <div class="feature-item">
                <div class="feature-main">
                  <i class="dot" class:live={isLive(feature.mode)} class:off={!isLive(feature.mode)} aria-hidden="true"></i>
                  <strong>{feature.label}</strong>
                </div>

                {#if editing}
                  <label class="mode-field">
                    <span class="sr-only">{feature.label} access</span>
                    <select name={`feature_${feature.key}`} bind:value={feature.mode}>
                      <option value="all">Available</option>
                      <option value="admin">Manager Only</option>
                      <option value="off">Hidden</option>
                    </select>
                  </label>
                {:else}
                  <span class:off={feature.mode === 'off'} class="status-text">{statusLabel(feature.mode)}</span>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/each}

      {#if editing}
        <div class="form-actions">
          <button type="button" on:click={cancelEditing}>Cancel</button>
          <i aria-hidden="true"></i>
          <button type="submit">Save Changes</button>
        </div>
      {/if}
    </form>

    {#if featuresMessage}
      <p class="save-message">{featuresMessage}</p>
    {/if}
  </div>
</Layout>

<style>
  :global(.main-content:has(.matrix-page)) {
    max-width: 1040px;
  }

  .matrix-page,
  .matrix-form {
    display: grid;
    gap: 1rem;
  }

  .matrix-page {
    padding-bottom: 2rem;
  }

  .matrix-summary,
  .feature-group {
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
  }

  .section-heading {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .section-heading h2,
  .feature-group h2 {
    margin: 0;
    font-size: 1rem;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .status-grid > div {
    min-height: 4.2rem;
    padding: 0.7rem 0.9rem;
    display: grid;
    align-content: center;
    gap: 0.1rem;
    border-right: 1px solid var(--color-divider);
    transition: background 160ms var(--ease-out);
  }

  .status-grid > div:last-child {
    border-right: 0;
  }

  .status-grid > div:hover,
  .feature-item:hover {
    background: color-mix(in srgb, var(--color-surface-alt) 34%, transparent);
  }

  .status-grid span {
    color: var(--color-text-muted);
    font-size: 0.64rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .status-grid strong {
    font-size: 1.15rem;
    font-weight: var(--weight-semibold);
  }

  .feature-group > header {
    padding: 0.72rem 1rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .feature-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(150px, 190px);
    gap: 0.8rem;
    align-items: center;
    min-height: 3.35rem;
    padding: 0.55rem 1rem;
    border-bottom: 1px solid var(--color-divider);
    transition: background 160ms var(--ease-out);
  }

  .feature-item:last-child {
    border-bottom: 0;
  }

  .feature-main {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
  }

  .feature-main strong {
    font-size: 0.84rem;
  }

  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 0;
    border: 1px solid var(--color-border);
    display: inline-block;
    flex: 0 0 auto;
  }

  .dot.live {
    background: var(--color-success);
  }

  .dot.off {
    background: transparent;
  }

  .status-text {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: var(--weight-semibold);
    text-align: right;
  }

  .status-text.off {
    opacity: 0.72;
  }

  .mode-field {
    display: grid;
  }

  .mode-field select {
    width: 100%;
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    padding: 0.42rem 0;
    background: transparent;
    color: var(--color-text);
    font-size: 0.8rem;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.65rem;
    padding: 0.15rem 1rem 0;
  }

  .form-actions i {
    width: 1px;
    height: 1rem;
    background: var(--color-divider);
  }

  button {
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    padding: 0.44rem 0.72rem;
    cursor: pointer;
    font-size: 0.79rem;
    font-weight: var(--weight-semibold);
  }

  .save-message {
    margin: 0;
    padding: 0 1rem;
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 560px) {
    .status-grid,
    .feature-item {
      grid-template-columns: 1fr;
    }

    .status-grid > div,
    .status-grid > div:last-child {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .status-grid > div:last-child {
      border-bottom: 0;
    }

    .status-text {
      text-align: left;
    }
  }
</style>
