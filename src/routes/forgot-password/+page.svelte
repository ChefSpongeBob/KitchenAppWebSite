<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  export let form: { error?: string; notice?: string } | undefined;
</script>

<Layout>
  <PageHeader title="Reset Password" />

  <section class="auth-shell">
    <form method="POST" class="auth-card">
      <p class="auth-copy">Enter the email on your account and we’ll send you a password reset link.</p>

      <div class="field">
        <label for="reset-email">Email</label>
        <input
          id="reset-email"
          name="email"
          type="email"
          required
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
        />
      </div>

      <button type="submit" class="submit">Send Reset Link</button>

      {#if form?.error}
        <p class="error">{form.error}</p>
      {:else if form?.notice}
        <p class="notice">{form.notice}</p>
      {/if}
    </form>
  </section>

  <p><a href="/login">Back to login</a></p>
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

  .auth-copy {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.5;
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
    border: 1px solid rgba(122, 132, 148, 0.24);
    background: linear-gradient(180deg, rgba(122, 132, 148, 0.24), rgba(122, 132, 148, 0.15));
    color: var(--color-primary-contrast);
    font-weight: var(--weight-semibold);
  }

  p {
    margin: 0.5rem 0 0;
    color: var(--color-text-muted);
  }

  a {
    color: var(--color-text);
  }

  .notice {
    color: var(--color-text-muted);
    margin: 0;
  }

  .error {
    color: #ff8d92;
    margin: 0;
  }
</style>

