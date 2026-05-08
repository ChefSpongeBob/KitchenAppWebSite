<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  export let data: {
    settings: {
      autofillNewWeeks: boolean;
    };
  };

  const withFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast(result.data?.message ?? 'Schedule settings updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That schedule setting could not be saved.', 'error');
      }
    };
  };
</script>

<Layout>
  <PageHeader
    title="Schedule Settings"
  />

  <section class="settings-shell">
    <header class="settings-head">
      <h2>Builder</h2>
      <a href="/admin/schedule-roles" class="settings-link">Department Roles</a>
    </header>

    <form method="POST" action="?/save_autofill" use:enhance={withFeedback} class="settings-form">
      <input type="hidden" name="autofill_new_weeks" value={data.settings.autofillNewWeeks ? '0' : '1'} />
      <div class="setting-row">
        <div class="setting-copy">
          <strong>Autofill</strong>
          <span>{data.settings.autofillNewWeeks ? 'Enabled' : 'Disabled'}</span>
        </div>
        <button type="submit">
          {data.settings.autofillNewWeeks ? 'Disable Autofill' : 'Enable Autofill'}
        </button>
      </div>
    </form>
  </section>
</Layout>

<style>
  .settings-shell {
    display: grid;
    gap: 0.85rem;
    padding: 1rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  }

  .settings-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
  }

  .settings-head h2 {
    margin: 0;
    font-size: 1rem;
  }

  .settings-form {
    display: grid;
    gap: 0.8rem;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0;
    border-top: 1px solid var(--color-divider);
  }

  .setting-copy {
    display: grid;
    gap: 0.2rem;
  }

  .setting-copy span {
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  button {
    min-height: 2.5rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid rgba(132, 146, 166, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.22), rgba(132, 146, 166, 0.08));
    color: var(--color-primary-contrast);
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: var(--weight-medium);
  }

  .settings-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.2rem;
    padding: 0.5rem 0.78rem;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: transparent;
    color: var(--color-text);
    text-decoration: none;
    font-size: 0.8rem;
    font-weight: var(--weight-medium);
  }

  @media (max-width: 720px) {
    .setting-row {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>


