<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;
</script>

<h2>Security</h2>
{#if form && 'error' in form}<p class="staff-feedback error" role="alert">{form.error}</p>{/if}
{#if data.verified}
  <p><a href={data.next}>Continue to Staff Tools</a></p>
{:else}
<p>Confirm your password to open staff tools.</p>
<form method="POST" class="staff-toolbar">
  <label>Password<input type="password" name="password" autocomplete="current-password" required maxlength="1024" /></label>
  <button type="submit">Confirm Password</button>
</form>
{/if}

<style>
  label { max-width: 22rem; margin-block: 1rem; }
</style>
