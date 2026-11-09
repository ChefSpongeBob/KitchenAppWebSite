<script lang="ts">
  import AuthShell from '#lib/components/ui/AuthShell.svelte';
  import { enhance } from '$app/forms';
  import { nativeRestaurantSwitch } from '#lib/client/restaurantSwitch.ts';
  import type { PageData } from './$types';
  export let data: PageData;
</script>

<svelte:head><title>Choose Restaurant | Crimini</title></svelte:head>
<AuthShell eyebrow="" title="Choose your restaurant">
  <div class="restaurants">
    <img class="logo" src="/crimini-full-logo.jpg" alt="Crimini" />
    {#each data.businesses as business}
      <form method="POST" action="/workspace/switch" use:nativeRestaurantSwitch>
        <input type="hidden" name="business_id" value={business.businessId} />
        <input type="hidden" name="entry" value="login" />
        <button type="submit">{business.businessName}</button>
      </form>
    {:else}
      <p>No active restaurants are connected to this account. Ask your restaurant manager for an invitation.</p>
    {/each}
    <form method="POST" action="/login?/not_you" use:enhance><button type="submit" class="sign-out">Use another account</button></form>
  </div>
</AuthShell>

<style>
  .restaurants { display: grid; gap: 0.75rem; }
  .logo { width: min(15rem, 100%); margin-bottom: 1rem; }
  form { border-bottom: 1px solid var(--color-divider); }
  button { width: 100%; text-align: left; padding: 0.8rem 0; border: 0; border-radius: 0; background: transparent; color: var(--color-text); font: inherit; cursor: pointer; overflow-wrap: anywhere; }
  button:hover, button:focus-visible { font-weight: var(--weight-bold); }
  .sign-out { font-size: 0.85rem; color: var(--color-text-muted); }
</style>
