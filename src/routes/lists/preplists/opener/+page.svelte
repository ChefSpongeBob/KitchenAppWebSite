<script lang="ts">
  import PreplistEditor from '$lib/components/ui/PreplistEditor.svelte';

  type PreplistItem = {
    id: string;
    content: string;
    details?: string | null;
    amount: number;
    amount_text?: string | null;
    par_count: number;
    is_checked: number;
  };

  export let data: {
    title: string;
    subtitle?: string;
    items: PreplistItem[];
    isAdmin: boolean;
    valueLabel?: string;
    submitLabel?: string;
    resetLabel?: string;
    adminSummaryLabel?: string;
    valueType?: 'number' | 'text';
  };
</script>

<PreplistEditor
  title={data.title}
  items={data.items}
  isAdmin={data.isAdmin}
  valueLabel={data.valueLabel ?? 'Prep'}
  submitLabel={data.submitLabel ?? 'Submit Prep Counts'}
  resetLabel={data.resetLabel ?? 'New Prep List (Reset to 0)'}
  adminSummaryLabel={data.adminSummaryLabel ?? '+ Admin Par Levels'}
  valueType={data.valueType ?? 'text'}
/>


