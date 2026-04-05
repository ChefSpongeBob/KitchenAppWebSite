<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  export let data: { valid?: boolean; email?: string | null };
  export let form: { error?: string } | undefined;

  let showPassword = false;
  let showConfirmPassword = false;
</script>

<Layout>
  <PageHeader title="Set New Password" />

  {#if data.valid}
    <section class="auth-shell">
      <form method="POST" class="auth-card">
        {#if data.email}
          <p class="target-email">{data.email}</p>
        {/if}

        <div class="field">
          <label for="reset-password">New Password</label>
          <div class="password-row">
            <input id="reset-password" name="password" type={showPassword ? 'text' : 'password'} required />
            <button type="button" class="toggle" on:click={() => (showPassword = !showPassword)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div class="field">
          <label for="reset-confirm-password">Confirm Password</label>
          <div class="password-row">
            <input id="reset-confirm-password" name="confirm_password" type={showConfirmPassword ? 'text' : 'password'} required />
            <button
              type="button"
              class="toggle"
              on:click={() => (showConfirmPassword = !showConfirmPassword)}
            >
              {showConfirmPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button type="submit" class="submit">Save New Password</button>
      </form>
    </section>
  {:else}
    <p class="error">This reset link is invalid or expired.</p>
    <p><a href="/forgot-password">Request a new reset link</a></p>
  {/if}

  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}
</Layout>

<style>
  form {
    width: min(100%, 34rem);
    display: grid;
    gap: 0.95rem;
  }

  .auth-shell {
    display: grid;
    gap: 1rem;
  }

  .auth-card {
    padding: 1.15rem;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: 0 18px 38px rgba(4, 5, 7, 0.2);
  }

  .field {
    display: grid;
    gap: 0.35rem;
  }

  label {
    display: block;
    font-size: 0.83rem;
    color: var(--color-text-muted);
  }

  input {
    width: 100%;
    padding: 0.55rem 0.65rem;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-alt);
    color: var(--color-text);
  }

  .submit {
    padding: 0.72rem 0.85rem;
    border-radius: 12px;
    border: 1px solid rgba(179, 58, 63, 0.24);
    background: linear-gradient(180deg, rgba(179, 58, 63, 0.24), rgba(179, 58, 63, 0.15));
    color: var(--color-primary-contrast);
    font-weight: var(--weight-semibold);
  }

  .target-email,
  p {
    margin: 0;
    color: var(--color-text-muted);
  }

  a {
    color: var(--color-text);
  }

  .error {
    color: #ff8d92;
    margin-top: 0.5rem;
  }

  .password-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .password-row input {
    flex: 1;
  }

  .toggle {
    min-width: 4.4rem;
    padding: 0.58rem 0.72rem;
  }

  @media (max-width: 760px) {
    .password-row {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
