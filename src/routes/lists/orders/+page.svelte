<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ListIndex from '$lib/components/ui/ListIndex.svelte';

  type SectionItem = {
    href: string;
    title: string;
    description: string | null;
  };

  export let data: { sections?: SectionItem[] };
  const sections = data.sections ?? [];
</script>

<Layout>
  <PageHeader title="Orders" />
  <ListIndex items={sections} emptyLabel="No order lists yet." />
</Layout>

