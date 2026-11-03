<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;
</script>

<h2>Security</h2>
{#if form && 'error' in form}<p class="staff-feedback error" role="alert">{form.error}</p>{/if}
{#if form && 'sent' in form}<p class="staff-feedback" role="status">Code sent. Check your email.</p>{/if}
{#if data.pending}
  <p>Enter the code sent to {data.pending.email}.</p>
  <form method="POST" class="staff-toolbar">
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
<p>Verify your email to open staff tools.</p>
<form method="POST" class="staff-toolbar">
  <input type="hidden" name="intent" value="send" />
  <label>Password<input type="password" name="password" autocomplete="current-password" required maxlength="1024" /></label>
  <button type="submit">{data.pending ? 'Send New Code' : 'Send Verification Code'}</button>
</form>
{/if}

<style>
  label { max-width: 22rem; margin-block: 1rem; }
  summary { cursor: pointer; padding-block: 0.8rem; }
</style>
