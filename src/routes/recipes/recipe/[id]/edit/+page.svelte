<script>
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import FormSection from '$lib/components/ui/FormSection.svelte';
  import TextInput from '$lib/components/ui/TextInput.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  $: id = $page.params.id;

  // placeholder values (later fetched from DB)
  let title = '';
  let description = '';
  let category = '';

  function save() {
    const updated = {
      id,
      title,
      description,
      category
    };

    console.log('UPDATED RECIPE', updated);

    // later → DB update
    goto(`/recipes/recipe/${id}`);
  }
</script>

<PageHeader
  title="Edit Recipe"
  subtitle="Admin"
/>

<FormSection title="Recipe Info">
  <TextInput label="Title" bind:value={title} />
  <TextInput label="Description" bind:value={description} />
  <TextInput label="Category" bind:value={category} />
</FormSection>

<Button on:click={save}>
  Save Changes
</Button>
