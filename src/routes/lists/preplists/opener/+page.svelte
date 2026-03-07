<script lang="ts">
  import PreplistEditor from '$lib/components/ui/PreplistEditor.svelte';

  type PreplistItem = {
    id: string;
    content: string;
    amount: number;
    par_count: number;
    is_checked: number;
  };

  export let data: {
    title: string;
    items: PreplistItem[];
    isAdmin: boolean;
  };
</script>

<PreplistEditor title={data.title} items={data.items} isAdmin={data.isAdmin} />

