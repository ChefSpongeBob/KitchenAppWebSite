<script>
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ListIndex from '$lib/components/ui/ListIndex.svelte';

  const lists = [
    { href: '/lists/preplists', title: 'Prep Lists', description: 'Prep counts and production targets.' },
    { href: '/lists/checklists', title: 'Checklists', description: 'Shift routines and service tasks.' },
    { href: '/lists/orders', title: 'Orders', description: 'Purchasing lists and vendor pulls.' },
    { href: '/lists/inventory', title: 'Inventory', description: 'Counts, par levels, and stock checks.' }
  ];
</script>

<Layout>
  <PageHeader title="Lists" />
  <ListIndex items={lists} />
</Layout>

