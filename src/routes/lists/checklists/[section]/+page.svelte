<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ListIndex from '$lib/components/ui/ListIndex.svelte';

  export let data: {
    title: string;
    shifts: Array<{
      href: string;
      title: string;
      description?: string | null;
    }>;
  };
</script>

<Layout>
  <PageHeader title={data.title} />
  <ListIndex items={data.shifts} emptyLabel="No checklist shifts yet." />
</Layout>

