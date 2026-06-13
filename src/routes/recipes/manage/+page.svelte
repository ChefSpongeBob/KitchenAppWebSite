<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
</script>

<Layout>
  <PageHeader title="Creator Studio" />
  <p class="redirect-note">Opening Creator Studio.</p>
</Layout>

<style>
  .redirect-note {
    margin: 0;
    color: var(--color-text-muted);
  }
</style>
