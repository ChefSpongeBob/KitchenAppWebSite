<script>
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import FormSection from '$lib/components/ui/FormSection.svelte';
  import TextInput from '$lib/components/ui/TextInput.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { goto } from '$app/navigation';

  let title = '';
  let description = '';
  let category = '';

  function save() {
    const recipe = {
      id: crypto.randomUUID(),
      title,
      description,
      category
    };

    console.log('NEW RECIPE', recipe);

    // later → DB call
    goto('/recipes');
  }
</script>

<PageHeader
  title="Add Recipe"
  subtitle="Admin"
/>

<FormSection title="Recipe Info">
  <TextInput label="Title" bind:value={title} />
  <TextInput label="Description" bind:value={description} />
  <TextInput label="Category" bind:value={category} />
</FormSection>

<Button on:click={save}>
  Save Recipe
</Button>
