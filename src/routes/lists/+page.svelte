<script>
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ListIndex from '$lib/components/ui/ListIndex.svelte';

  const lists = [
    { href: '/lists/preplists', title: 'Prep Lists' },
    { href: '/lists/checklists', title: 'Checklists' },
    { href: '/lists/orders', title: 'Orders' },
    { href: '/lists/inventory', title: 'Inventory' }
  ];
</script>

<Layout>
  <PageHeader title="Lists" />
  <ListIndex items={lists} />
</Layout>

