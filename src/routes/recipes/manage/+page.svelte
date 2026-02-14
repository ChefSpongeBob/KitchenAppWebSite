<script>
  let category = 'kitchen';
  let title = '';
  let ingredients = '';
  let instructions = '';

  const categories = ['kitchen','sushi','sushiprep','sauces','specials'];

  const addRecipe = () => {
    alert(`Would add recipe:
Category: ${category}
Title: ${title}
Ingredients: ${ingredients}
Instructions: ${instructions}`);
  };
</script>

<h1>Manage Recipes</h1>

<div class="form">
  <label>
    Category:
    <select bind:value={category}>
      {#each categories as c}
        <option value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
      {/each}
    </select>
  </label>

  <label>
    Title:
    <input type="text" placeholder="Recipe title" bind:value={title} />
  </label>

  <label>
    Ingredients:
    <textarea placeholder="Ingredients" bind:value={ingredients}></textarea>
  </label>

  <label>
    Instructions:
    <textarea placeholder="Instructions" bind:value={instructions}></textarea>
  </label>

  <button on:click={addRecipe}>Add Recipe</button>
</div>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 500px;
    margin: 2rem auto;
  }

  label {
    display: flex;
    flex-direction: column;
  }

  input, textarea, select {
    padding: 0.5rem;
    font-size: 1rem;
  }

  button {
    padding: 0.75rem;
    background-color: var(--color-primary);
    color: white;
    border: none;
    cursor: pointer;
  }

  button:hover {
    background-color: var(--color-primary-dark);
  }
</style>