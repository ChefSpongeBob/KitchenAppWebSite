<script>
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ListIndex from '$lib/components/ui/ListIndex.svelte';

  export let data;
  const lists = data.sections ?? [];
</script>

<Layout>
  <PageHeader title="Checklists" />
  <ListIndex items={lists} emptyLabel="No checklists yet." />
</Layout>

