<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import StaffAuthShell from '#lib/components/staff/StaffAuthShell.svelte';
  export let data: PageData;
  export let form: ActionData;
</script>

<svelte:head><title>{data.staff ? 'Security' : 'Staff Sign In'} | Crimini</title></svelte:head>

{#snippet verification()}
{#if form && 'error' in form}<p class="staff-feedback error" role="alert">{form.error}</p>{/if}
{#if form && 'sent' in form}<p class="staff-feedback" role="status">Code sent. Check your email.</p>{/if}
{#if data.deliveryFailed && !data.pending && !form}<p class="staff-feedback error" role="alert">Code could not be sent. Try again shortly.</p>{/if}
{#if data.pending}
  <p>Enter the code sent to {data.pending.email}.</p>
  <form method="POST" class="staff-toolbar staff-code-form">
    <input type="hidden" name="intent" value="verify" />
    <input type="hidden" name="challenge" value={data.pending.id} />
    <label>Verification Code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern={'[0-9]{6}'} minlength="6" maxlength="6" required /></label>
    <button type="submit">Verify Code</button>
  </form>
{/if}
{#if data.verified}
  <p>Verification email: {data.email}</p>
  <p><a href={data.next}>Continue to Staff Tools</a></p>
  <details>
    <summary>Change Verification Email</summary>
    <form method="POST" class="staff-toolbar">
      <input type="hidden" name="intent" value="change_email" />
      <label>New Email<input type="email" name="email" autocomplete="email" maxlength="254" required /></label>
      <label>Password<input type="password" name="password" autocomplete="current-password" maxlength="1024" required /></label>
      <button type="submit">Send Code to New Email</button>
    </form>
  </details>
{:else}
  {@render sendCode()}
{/if}
{/snippet}

{#snippet sendCode()}
  <form method="POST" class="staff-toolbar">
    <input type="hidden" name="intent" value="send" />
    <button type="submit">{data.pending ? 'Send New Code' : 'Send Verification Code'}</button>
  </form>
{/snippet}

{#if data.staff}
  <h2>Security</h2>
  {@render verification()}
{:else}
  <StaffAuthShell title="Verify your email">
    <div class="staff-verification">{@render verification()}</div>
    <form method="POST" action="/logout?staff=1" class="staff-auth-exit"><button type="submit">Sign Out</button></form>
  </StaffAuthShell>
{/if}

<style>
  .staff-verification { display: grid; gap: 1rem; }
  label { max-width: 22rem; }
  summary { cursor: pointer; padding-block: 0.8rem; }
</style>
