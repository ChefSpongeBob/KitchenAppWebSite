<script lang="ts">
  import SupportConversation from '#lib/components/staff/SupportConversation.svelte';
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;
</script>
<header class="staff-business-context"><a href={`/staff/businesses/${encodeURIComponent(data.detail.request.business_id)}?view=support`}>{data.detail.request.business_name}</a><a href="/staff/support">Support Queue</a></header>
{#if form?.error}<p class="staff-feedback error" role="alert">{form.error}</p>{/if}
<SupportConversation data={data.detail} staff />
