<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { enhance } from '$app/forms';
  import { recipeCategories } from '$lib/assets/recipeCategories';

  type ListItem = {
    id: string;
    content: string;
    amount: number;
    par_count: number;
    is_checked: number;
  };

  type Section = {
    id: string;
    slug: string;
    title: string;
    items: ListItem[];
  };

  type Recipe = {
    id: number;
    title: string;
    category: string;
    ingredients: string;
    instructions: string;
  };

  type Todo = {
    id: string;
    title: string;
    description: string;
    completed_at: number | null;
    assigned_name?: string | null;
    assigned_email?: string | null;
  };

  type UserOption = {
    id: string;
    display_name: string | null;
    email: string;
    role: string;
    is_active: number;
  };

  type NodeName = {
    sensor_id: number;
    name: string;
  };

  type WhiteboardIdea = {
    id: string;
    content: string;
    votes: number;
    status: 'pending' | 'approved' | 'rejected';
    submitted_name?: string | null;
    submitted_email?: string | null;
  };

  type DocumentItem = {
    id: string;
    slug: string;
    title: string;
    section: string;
    category: string;
    content: string | null;
    file_url: string | null;
    is_active: number;
  };

  export let data: {
    preplists: Section[];
    inventory: Section[];
    recipes: Recipe[];
    todos: Todo[];
    users: UserOption[];
    nodeNames: NodeName[];
    whiteboardIdeas: WhiteboardIdea[];
    documents: DocumentItem[];
  };

  const defaultRecipeCategories = [...recipeCategories];
  $: recipeCategoryOptions = Array.from(
    new Set([
      ...defaultRecipeCategories,
      ...data.recipes.map((recipe) => recipe.category).filter(Boolean)
    ])
  );
  $: recipesByCategory = recipeCategoryOptions.map((category) => ({
    category,
    recipes: data.recipes.filter((recipe) => recipe.category === category)
  }));

  let newDocSlug = 'about';
  const preferredDocSlugOrder = ['about', 'sop', 'handbook'];
  $: documentBuckets = Array.from(
    data.documents.reduce((acc, doc) => {
      const bucket = acc.get(doc.slug) ?? [];
      bucket.push(doc);
      acc.set(doc.slug, bucket);
      return acc;
    }, new Map<string, DocumentItem[]>())
  ).sort((a, b) => {
    const aIndex = preferredDocSlugOrder.indexOf(a[0]);
    const bIndex = preferredDocSlugOrder.indexOf(b[0]);
    if (aIndex === -1 && bIndex === -1) return a[0].localeCompare(b[0]);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
</script>

<Layout>
  <PageHeader
    title="Admin Dashboard"
    subtitle="Manage high-traffic operations from one panel."
  />

  <nav class="jump-nav" aria-label="Admin sections">
    <a href="#todos">Todo</a>
    <a href="#access">User Access</a>
    <a href="#whiteboard">Whiteboard</a>
    <a href="#nodes">Node Names</a>
    <a href="#preplists">Preplists</a>
    <a href="#inventory">Inventory</a>
    <a href="#recipes">Recipes</a>
    <a href="#documents">Documents</a>
  </nav>

  <section class="panel" id="todos">
    <h2>Todo</h2>
    <form method="POST" action="?/create_todo" use:enhance class="add-row">
      <input name="title" placeholder="Task title" required />
      <input name="description" placeholder="Description" />
      <select name="assigned_to">
        <option value="">Assign: Anyone</option>
        {#each data.users as user}
          <option value={user.id}>{user.display_name ?? user.email}</option>
        {/each}
      </select>
      <button type="submit">+ Add</button>
    </form>

    <table class="sheet">
      <thead>
        <tr>
          <th>Title</th>
          <th>Description</th>
          <th>Assigned</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each data.todos as todo}
          <tr>
            <td>{todo.title}</td>
            <td>{todo.description}</td>
            <td>{todo.assigned_name ?? todo.assigned_email ?? 'Anyone'}</td>
            <td>{todo.completed_at ? 'Completed' : 'Active'}</td>
            <td>
              <form method="POST" action="?/delete_todo" use:enhance class="inline">
                <input type="hidden" name="id" value={todo.id} />
                <button type="submit" class="icon-btn danger" aria-label="Remove task">X</button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section class="panel" id="access">
    <h2>User Access</h2>
    <table class="sheet">
      <thead>
        <tr>
          <th>User</th>
          <th>Email</th>
          <th>Access</th>
          <th>Role</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#if data.users.length === 0}
          <tr><td colspan="5">No users found.</td></tr>
        {:else}
          {#each data.users as user}
            <tr>
              <td>{user.display_name ?? 'Unnamed User'}</td>
              <td>{user.email}</td>
              <td>
                {#if user.is_active === 1}
                  <span class="status status-approved">Approved</span>
                {:else}
                  <span class="status status-pending">Pending</span>
                {/if}
              </td>
              <td>{user.role}</td>
              <td>
                <div class="inline">
                {#if user.is_active !== 1}
                  <form method="POST" action="?/approve_user" use:enhance class="inline">
                    <input type="hidden" name="user_id" value={user.id} />
                    <button type="submit" class="icon-btn" aria-label="Approve user account">OK</button>
                  </form>
                {/if}
                {#if user.role !== 'admin'}
                  <form method="POST" action="?/make_user_admin" use:enhance class="inline">
                    <input type="hidden" name="user_id" value={user.id} />
                    <button type="submit" class="icon-btn" aria-label="Promote user to admin">A</button>
                  </form>
                {/if}
                {#if user.role === 'admin'}
                  <span class="status status-approved">Admin</span>
                {/if}
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </section>

  <section class="panel" id="whiteboard">
    <h2>Whiteboard Approval</h2>
    <table class="sheet">
      <thead>
        <tr>
          <th>Idea</th>
          <th>Votes</th>
          <th>Status</th>
          <th>Submitted By</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#if data.whiteboardIdeas.length === 0}
          <tr><td colspan="5">No whiteboard ideas yet.</td></tr>
        {:else}
          {#each data.whiteboardIdeas as idea}
            <tr>
              <td>{idea.content}</td>
              <td>{idea.votes}</td>
              <td>
                <span class="status status-{idea.status}">{idea.status}</span>
              </td>
              <td>{idea.submitted_name ?? idea.submitted_email ?? 'Unknown'}</td>
              <td>
                <div class="inline">
                  <form method="POST" action="?/approve_whiteboard" use:enhance class="inline">
                    <input type="hidden" name="id" value={idea.id} />
                    <button type="submit" class="icon-btn" aria-label="Approve idea">A</button>
                  </form>
                  <form method="POST" action="?/reject_whiteboard" use:enhance class="inline">
                    <input type="hidden" name="id" value={idea.id} />
                    <button type="submit" class="icon-btn" aria-label="Reject idea">R</button>
                  </form>
                  <form method="POST" action="?/delete_whiteboard" use:enhance class="inline">
                    <input type="hidden" name="id" value={idea.id} />
                    <button type="submit" class="icon-btn danger" aria-label="Delete idea">X</button>
                  </form>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </section>

  <section class="panel" id="nodes">
    <h2>Node Names</h2>
    <form method="POST" action="?/add_node_name" use:enhance class="add-row">
      <input name="sensor_id" type="number" min="1" placeholder="Node ID" required />
      <input name="name" placeholder="Display name (Cook Bus, Fry Line, etc.)" required />
      <button type="submit">+ Save</button>
    </form>

    <table class="sheet">
      <thead>
        <tr>
          <th>Node ID</th>
          <th>Name</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#if data.nodeNames.length === 0}
          <tr>
            <td colspan="3">No node names yet.</td>
          </tr>
        {:else}
          {#each data.nodeNames as node}
            <tr>
              <td>{node.sensor_id}</td>
              <td>{node.name}</td>
              <td>
                <form method="POST" action="?/delete_node_name" use:enhance class="inline">
                  <input type="hidden" name="sensor_id" value={node.sensor_id} />
                  <button type="submit" class="icon-btn danger" aria-label="Remove node name">X</button>
                </form>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </section>

  <section class="panel" id="preplists">
    <h2>Preplists</h2>
    {#each data.preplists as section}
      <details class="section-block">
        <summary>
          <h3>{section.title}</h3>
          <span>{section.items.length} items</span>
        </summary>
        <table class="sheet">
          <thead>
            <tr>
              <th>Item</th>
              <th>Par</th>
              <th>Current Prep</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each section.items as item}
              <tr>
                <td>
                  <form method="POST" action="?/update_list_item" use:enhance class="inline">
                    <input type="hidden" name="id" value={item.id} />
                    <input name="content" value={item.content} required />
                    <input name="par_count" type="number" min="0" step="0.1" value={item.par_count} required />
                    <button type="submit" class="icon-btn" aria-label="Save item">S</button>
                  </form>
                </td>
                <td>{item.par_count}</td>
                <td>{item.amount}</td>
                <td>{item.is_checked ? 'Done' : 'Open'}</td>
                <td>
                  <form method="POST" action="?/delete_list_item" use:enhance class="inline">
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" class="icon-btn danger" aria-label="Remove item">X</button>
                  </form>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>

        <details class="add-toggle">
          <summary>+ Add item</summary>
          <form method="POST" action="?/add_list_item" use:enhance class="add-row">
            <input type="hidden" name="section_id" value={section.id} />
            <input name="content" placeholder={`Add item to ${section.title}`} required />
            <input name="par_count" type="number" min="0" step="0.1" placeholder="Par" value="0" required />
            <button type="submit">Add</button>
          </form>
        </details>
      </details>
    {/each}
  </section>

  <section class="panel" id="inventory">
    <h2>Inventory</h2>
    {#each data.inventory as section}
      <details class="section-block">
        <summary>
          <h3>{section.title}</h3>
          <span>{section.items.length} items</span>
        </summary>
        <table class="sheet">
          <thead>
            <tr>
              <th>Item</th>
              <th>Par</th>
              <th>Current</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each section.items as item}
              <tr>
                <td>
                  <form method="POST" action="?/update_list_item" use:enhance class="inline">
                    <input type="hidden" name="id" value={item.id} />
                    <input name="content" value={item.content} required />
                    <input name="par_count" type="number" min="0" step="0.1" value={item.par_count} required />
                    <button type="submit" class="icon-btn" aria-label="Save item">S</button>
                  </form>
                </td>
                <td>{item.par_count}</td>
                <td>{item.amount}</td>
                <td>
                  <form method="POST" action="?/delete_list_item" use:enhance class="inline">
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" class="icon-btn danger" aria-label="Remove item">X</button>
                  </form>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>

        <details class="add-toggle">
          <summary>+ Add item</summary>
          <form method="POST" action="?/add_list_item" use:enhance class="add-row">
            <input type="hidden" name="section_id" value={section.id} />
            <input name="content" placeholder={`Add item to ${section.title}`} required />
            <input name="par_count" type="number" min="0" step="0.1" placeholder="Par" value="0" required />
            <button type="submit">Add</button>
          </form>
        </details>
      </details>
    {/each}
  </section>

  <section class="panel" id="recipes">
    <h2>Recipes</h2>
    <details class="section-block">
      <summary>
        <h3>Recipe Manager</h3>
        <span>{data.recipes.length} recipes</span>
      </summary>

      <form method="POST" action="?/create_recipe" use:enhance class="add-row recipe-add">
        <select name="category" required>
          <option value="">Select Category</option>
          {#each recipeCategoryOptions as category}
            <option value={category}>{category}</option>
          {/each}
        </select>
        <input name="title" placeholder="Title" required />
        <textarea name="materials_needed" placeholder="Materials needed" rows="3" required></textarea>
        <textarea name="ingredients" placeholder="Ingredients" rows="3" required></textarea>
        <textarea name="instruction" placeholder="Instruction" rows="3" required></textarea>
        <button type="submit">+ Add</button>
      </form>

      <div class="recipe-tabs">
        {#each recipesByCategory as bucket}
          <details class="add-toggle recipe-cat">
            <summary>{bucket.category} ({bucket.recipes.length})</summary>
            {#if bucket.recipes.length === 0}
              <p class="muted">No recipes in this category yet.</p>
            {:else}
              <table class="sheet">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {#each bucket.recipes as recipe}
                    <tr>
                      <td>{recipe.title}</td>
                      <td>
                        <form method="POST" action="?/delete_recipe" use:enhance class="inline">
                          <input type="hidden" name="id" value={recipe.id} />
                          <button type="submit" class="icon-btn danger" aria-label="Remove recipe">X</button>
                        </form>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </details>
        {/each}
      </div>
    </details>
  </section>

  <section class="panel" id="documents">
    <h2>Documents</h2>
    <details class="section-block" open>
      <summary>
        <h3>Document Manager</h3>
        <span>{data.documents.length} docs</span>
      </summary>

      <form method="POST" action="?/create_document" use:enhance class="add-row docs-form">
        <select name="slug" bind:value={newDocSlug} required>
          <option value="about">About</option>
          <option value="sop">SOP</option>
          <option value="handbook">Handbook</option>
          <option value="custom">Custom slug</option>
        </select>
        {#if newDocSlug === 'custom'}
          <input name="slug_custom" placeholder="custom-slug" required />
        {/if}
        <input name="title" placeholder="Document title" required />
        <input name="section" placeholder="Section" value="Docs" />
        <input name="category" placeholder="Category" value="General" />
        <input name="file_url" placeholder="File URL (optional)" />
        <textarea name="content" rows="8" placeholder="Full document content / notes"></textarea>
        <select name="is_active">
          <option value="1" selected>Active</option>
          <option value="0">Inactive</option>
        </select>
        <button type="submit">+ Add Document</button>
      </form>

      <div class="recipe-tabs">
        {#if documentBuckets.length === 0}
          <p class="muted">No documents found.</p>
        {:else}
          {#each documentBuckets as [slug, docs]}
            <details class="add-toggle recipe-cat">
              <summary>{slug} ({docs.length})</summary>
              {#each docs as doc}
                <details class="edit-doc">
                  <summary>{doc.title}</summary>
                  <form method="POST" action="?/update_document" use:enhance class="add-row docs-form">
                    <input type="hidden" name="id" value={doc.id} />
                    <input name="slug" value={doc.slug} required />
                    <input name="title" value={doc.title} required />
                    <input name="section" value={doc.section} />
                    <input name="category" value={doc.category} />
                    <input name="file_url" value={doc.file_url ?? ''} />
                    <textarea name="content" rows="8">{doc.content ?? ''}</textarea>
                    <select name="is_active">
                      <option value="1" selected={doc.is_active === 1}>Active</option>
                      <option value="0" selected={doc.is_active === 0}>Inactive</option>
                    </select>
                    <button type="submit">Save</button>
                  </form>
                  <form method="POST" action="?/delete_document" use:enhance class="inline">
                    <input type="hidden" name="id" value={doc.id} />
                    <button type="submit" class="icon-btn danger" aria-label="Delete document">X</button>
                  </form>
                </details>
              {/each}
            </details>
          {/each}
        {/if}
      </div>
    </details>
  </section>
</Layout>

<style>
  .jump-nav {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    margin: 0.5rem 0 0.8rem;
  }

  .jump-nav a {
    text-decoration: none;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.22rem 0.55rem;
    font-size: 0.78rem;
    background: var(--color-surface);
  }

  .panel {
    margin-top: 0.8rem;
    padding: 0.8rem;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-surface);
    overflow-x: auto;
  }

  h2 {
    margin: 0 0 0.75rem;
  }

  h3 {
    margin: 0;
    font-size: 0.95rem;
    color: var(--color-text-muted);
  }

  .section-block + .section-block {
    margin-top: 0.6rem;
  }

  summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    list-style: none;
    padding: 0.35rem 0.1rem;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary span {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .section-block > summary::after {
    content: '+';
    font-size: 0.95rem;
    line-height: 1;
    color: var(--color-text-muted);
    margin-left: 0.45rem;
  }

  .section-block[open] > summary::after {
    content: '-';
  }

  .sheet {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .sheet th {
    text-align: left;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    padding: 0.35rem 0.32rem;
    text-transform: uppercase;
  }

  .sheet td {
    padding: 0.28rem 0.32rem;
    vertical-align: middle;
  }

  .add-row,
  .inline {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .add-row {
    margin-top: 0.6rem;
  }

  .add-toggle {
    margin-top: 0.45rem;
  }

  .add-toggle > summary {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    padding: 0.2rem 0.4rem;
    border: 1px dashed var(--color-border);
    border-radius: 7px;
    width: fit-content;
  }

  .add-toggle[open] > summary {
    color: var(--color-text);
  }

  .edit-doc summary {
    border: 1px dashed var(--color-border);
    border-radius: 7px;
    padding: 0.18rem 0.45rem;
    font-size: 0.75rem;
  }

  input,
  textarea,
  select {
    border: 1px solid var(--color-border);
    border-radius: 7px;
    padding: 0.3rem 0.42rem;
    background: var(--color-surface-alt);
    color: var(--color-text);
    font-size: 0.82rem;
    width: 100%;
  }

  button {
    border: 1px solid var(--color-border);
    border-radius: 7px;
    background: var(--color-surface-alt);
    color: var(--color-text);
    padding: 0.3rem 0.45rem;
    cursor: pointer;
    font-size: 0.78rem;
  }

  .icon-btn {
    width: 1.7rem;
    height: 1.7rem;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }

  .danger {
    border-color: #ef4444;
    color: #ef4444;
  }

  .status {
    display: inline-flex;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    padding: 0.12rem 0.45rem;
    font-size: 0.72rem;
  }

  .status-pending {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .status-approved {
    border-color: #16a34a;
    color: #16a34a;
  }

  .status-rejected {
    border-color: #ef4444;
    color: #ef4444;
  }

  .recipe-add input {
    min-width: 150px;
  }

  .recipe-add textarea {
    min-width: 220px;
    resize: vertical;
  }

  .recipe-tabs {
    margin-top: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .recipe-cat .muted {
    margin: 0.25rem 0 0.35rem;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .docs-form {
    align-items: flex-start;
  }

  .docs-form textarea {
    width: 100%;
    min-height: 180px;
    resize: vertical;
    flex: 1 1 100%;
  }

  @media (max-width: 900px) {
    .jump-nav {
      gap: 0.35rem;
    }

    .jump-nav a {
      font-size: 0.72rem;
      padding: 0.2rem 0.5rem;
    }

    .sheet {
      min-width: 680px;
    }

    .add-row > *,
    .inline > * {
      flex: 1 1 100%;
      min-width: 0;
    }

    .inline .icon-btn {
      flex: 0 0 auto;
    }

    .icon-btn {
      width: 1.9rem;
      height: 1.9rem;
    }

    .recipe-add input,
    .recipe-add textarea {
      min-width: 0;
      width: 100%;
    }
  }
</style>
