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
    subtitle="Manage builder behavior and scheduling preferences."
  />

  <section class="stack">
    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Builder</span>
          <h2>Autofill Schedule</h2>
        </div>
      </header>

      <p class="panel-note">
        When enabled, new weeks treat last week as the default source for fast schedule building.
      </p>

      <form method="POST" action="?/save_autofill" use:enhance={withFeedback} class="settings-form">
        <input type="hidden" name="autofill_new_weeks" value={data.settings.autofillNewWeeks ? '0' : '1'} />
        <div class="setting-row">
          <div class="setting-copy">
            <strong>{data.settings.autofillNewWeeks ? 'Autofill Enabled' : 'Autofill Disabled'}</strong>
            <span>
              {data.settings.autofillNewWeeks
                ? 'New schedules default to autofill behavior.'
                : 'New schedules start without autofill by default.'}
            </span>
          </div>
          <button type="submit">
            {data.settings.autofillNewWeeks ? 'Disable Autofill' : 'Enable Autofill'}
          </button>
        </div>
      </form>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Roles</span>
          <h2>Department Roles</h2>
        </div>
      </header>

      <div class="setting-row">
        <div class="setting-copy">
          <strong>Manage schedule role options</strong>
          <span>Edit the role lists used for FOH, Sushi, and Kitchen scheduling.</span>
        </div>
        <a href="/admin/schedule-roles" class="settings-link">Open</a>
      </div>
    </section>
  </section>
</Layout>

<style>
  .stack {
    display: grid;
    gap: 0.9rem;
  }

  .panel {
    position: relative;
    overflow: hidden;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01) 48%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
  }

  .panel::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.9), rgba(195, 32, 43, 0.2));
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
    margin-bottom: 0.9rem;
  }

  .panel-kicker {
    display: inline-flex;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .panel-head h2 {
    margin: 0.2rem 0 0;
  }

  .panel-note {
    margin: 0 0 0.9rem;
    color: var(--color-text-muted);
    max-width: 46rem;
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
    padding: 0.85rem 0.9rem;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.03);
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
    border: 1px solid rgba(195, 32, 43, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: var(--weight-medium);
  }

  .settings-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.5rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
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
