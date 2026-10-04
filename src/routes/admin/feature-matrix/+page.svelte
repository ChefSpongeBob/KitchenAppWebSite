<script lang="ts">
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '@sveltejs/kit';
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { pushToast } from '$lib/client/toasts';
  import type { AppFeatureKey, AppFeatureMode } from '$lib/features/appFeatures';

  type FeatureRow = {
    key: AppFeatureKey;
    label: string;
    description: string;
    mode: AppFeatureMode;
  };

  export let data: { features: FeatureRow[] };

  let features: FeatureRow[] = data.features.map((feature) => ({ ...feature }));
  let featuresMessage = '';

  $: if (data.features) {
    features = data.features.map((feature) => ({ ...feature }));
  }

  const withFeatureSaveFeedback: SubmitFunction = () => {
    featuresMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
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
    if (mode === 'admin') return 'Live (Manager Only)';
    return 'Live';
  }
</script>

<Layout>
  <PageHeader title="Feature Matrix" />

  <section class="matrix-section">
    <div class="section-heading">
      <div>
        <h2>Feature Visibility</h2>
        <p>Hidden features are disabled, not deleted.</p>
      </div>
      <div class="status-legend" aria-label="Feature status legend">
        <span><i class="dot live"></i> Live</span>
        <span><i class="dot off"></i> Hidden</span>
      </div>
    </div>

    <form method="POST" action="?/save" use:enhance={withFeatureSaveFeedback} class="matrix-form">
      <div class="feature-list">
        {#each features as feature}
          <article class="feature-item">
            <div class="feature-main">
              <i class="dot" class:live={isLive(feature.mode)} class:off={!isLive(feature.mode)} aria-hidden="true"></i>
              <div class="feature-copy">
                <h3>{feature.label}</h3>
                <p>{feature.description}</p>
              </div>
            </div>

            <label class="mode-field">
              <span class="status-text" class:off={feature.mode === 'off'}>{statusLabel(feature.mode)}</span>
              <select name={`feature_${feature.key}`} bind:value={feature.mode}>
                <option value="all">On</option>
                <option value="admin">Manager Only</option>
                <option value="off">Hidden</option>
              </select>
            </label>
          </article>
        {/each}
      </div>

      <div class="form-actions">
        <button type="submit">Save Feature Matrix</button>
      </div>
    </form>

    {#if featuresMessage}
      <p class="save-message">{featuresMessage}</p>
    {/if}
  </section>
</Layout>

<style>
  .matrix-section {
    padding: 0.9rem 1rem 1rem;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    display: grid;
    gap: 0.8rem;
  }

  .section-heading {
    display: flex;
    justify-content: space-between;
    gap: 0.9rem;
    align-items: end;
    flex-wrap: wrap;
  }

  .section-heading h2 {
    margin: 0;
    font-size: 1rem;
  }

  .section-heading p,
  .feature-copy p,
  .save-message {
    color: var(--color-text-muted);
  }

  .section-heading p {
    margin: 0.28rem 0 0;
    font-size: 0.8rem;
  }

  .status-legend {
    display: inline-flex;
    gap: 0.7rem;
    align-items: center;
    font-size: 0.74rem;
    color: var(--color-text-muted);
  }

  .status-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .dot {
    width: 0.62rem;
    height: 0.62rem;
    border-radius: 0;
    border: 1px solid var(--color-border);
    display: inline-block;
    flex: 0 0 auto;
  }

  .dot.live {
    background: var(--color-success);
  }

  .dot.off {
    background: var(--color-error);
  }

  .matrix-form,
  .feature-list {
    display: grid;
    gap: 0.5rem;
  }

  .feature-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(190px, 210px);
    gap: 0.65rem;
    align-items: center;
    padding: 0.55rem 0;
    border-top: 1px solid var(--color-divider);
  }

  .feature-main {
    display: flex;
    align-items: start;
    gap: 0.5rem;
    min-width: 0;
  }

  .feature-copy h3 {
    margin: 0;
    font-size: 0.9rem;
  }

  .feature-copy p {
    margin: 0.2rem 0 0;
    font-size: 0.75rem;
    line-height: 1.35;
  }

  .mode-field {
    display: grid;
    gap: 0.24rem;
  }

  .status-text {
    font-size: 0.72rem;
    color: var(--color-success);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: var(--weight-semibold);
  }

  .status-text.off {
    color: var(--color-error);
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
    font-size: 0.78rem;
  }

  @media (max-width: 900px) {
    .feature-item {
      grid-template-columns: 1fr;
    }
  }
</style>
