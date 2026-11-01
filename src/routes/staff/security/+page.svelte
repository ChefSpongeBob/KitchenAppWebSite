<script lang="ts">
  import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;
  let supported = false;
  let busy = false;
  let message = '';
  let keyName = '';
  onMount(() => { supported = browserSupportsWebAuthn(); });
  async function request(body: Record<string, unknown>) {
    const response = await fetch('/staff/security/passkeys', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Passkey request failed.');
    return result;
  }
  async function passkey(purpose: 'register' | 'authenticate') {
    busy = true; message = '';
    try {
      const optionsJSON = await request({ action: 'options', purpose });
      const response = purpose === 'register' ? await startRegistration({ optionsJSON }) : await startAuthentication({ optionsJSON });
      await request({ action: 'verify', purpose, response, name: keyName || 'Passkey' });
      await invalidateAll();
      message = purpose === 'register' ? 'Passkey added.' : 'Passkey verified.';
    } catch (err) {
      message = err instanceof Error && err.name === 'NotAllowedError' ? 'Passkey request cancelled. Try again when ready.'
        : err instanceof Error ? err.message : 'Passkey could not be verified.';
    } finally { busy = false; }
  }
  async function remove(id: string) {
    busy = true; message = '';
    try { await request({ action: 'remove', id }); await invalidateAll(); message = 'Passkey removed. Confirm your password and remaining passkey.'; }
    catch (err) { message = err instanceof Error ? err.message : 'Passkey could not be removed.'; }
    finally { busy = false; }
  }
</script>

<h2>Security</h2>
<p>Confirm your password and passkey to open staff tools.</p>
{#if form && 'error' in form}<p class="staff-feedback error" role="alert">{form.error}</p>{/if}
{#if message}<p class="staff-feedback" role="status">{message}</p>{/if}
{#if !data.passkeyDomainReady}
  <p>Use the Crimini domain for staff passkeys.</p>
  {#if data.canonicalStaffUrl}<a href={data.canonicalStaffUrl}>Open Crimini Staff</a>{/if}
{:else if !supported}<p>Open staff tools in a browser that supports passkeys.</p>
{:else}
{#if !data.passwordConfirmed}
<form method="POST" class="staff-toolbar">
  <label>Password<input type="password" name="password" autocomplete="current-password" required maxlength="1024" /></label>
  <button type="submit">Confirm Password</button>
</form>
{:else}
  {#if !data.passkeys.length}
    <label>Passkey Name<input bind:value={keyName} maxlength="60" placeholder="My passkey" /></label>
    <button type="button" disabled={busy} on:click={() => passkey('register')}>Add Passkey</button>
  {:else if !data.verified}
    <button type="button" disabled={busy} on:click={() => passkey('authenticate')}>Verify Passkey</button>
  {:else}
    <p><a href={data.next}>Continue to Staff Tools</a></p>
    <details><summary>Manage Passkeys</summary>
      <p>Add a second passkey or security key for backup.</p>
      {#each data.passkeys as key}
        <div class="passkey-row"><span>{key.name}</span>
          <button type="button" disabled={busy || data.passkeys.length < 2} on:click={() => remove(key.credential_id)}>Remove</button></div>
      {/each}
      {#if data.passkeys.length < 5}
        <label>Passkey Name<input bind:value={keyName} maxlength="60" placeholder="Backup passkey" /></label>
        <button type="button" disabled={busy} on:click={() => passkey('register')}>Add Passkey</button>
      {/if}
    </details>
  {/if}
{/if}
{/if}

<style>
  .passkey-row { display: flex; gap: 1rem; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid var(--color-divider); }
  label { max-width: 22rem; margin-block: 1rem; }
</style>
