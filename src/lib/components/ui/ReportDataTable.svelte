<script lang="ts" context="module">
  export type ReportTableColumn = {
    key: string;
    label: string;
    align?: 'left' | 'right';
  };

  export type ReportTableRow = {
    id: string;
    cells: Record<string, string | number>;
  };
</script>

<script lang="ts">
  export let columns: ReportTableColumn[] = [];
  export let rows: ReportTableRow[] = [];
  export let empty = 'No report activity in this range.';
  export let limit = 100;

  $: visibleRows = rows.slice(0, limit);
</script>

<section class="report-data" aria-label="Report details">
  {#if visibleRows.length}
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            {#each columns as column}
              <th class:right={column.align === 'right'} scope="col">{column.label}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each visibleRows as row (row.id)}
            <tr>
              {#each columns as column}
                <td class:right={column.align === 'right'} data-label={column.label}>{row.cells[column.key] ?? '-'}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if rows.length > visibleRows.length}
      <p class="limit-note">Showing {visibleRows.length} of {rows.length} rows. Full results are available in CSV.</p>
    {/if}
  {:else}
    <p class="empty-state">{empty}</p>
  {/if}
</section>

<style>
  .report-data {
    padding: 1rem 0;
    border-bottom: 1px solid var(--color-divider);
  }

  .table-scroll {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    color: var(--color-text);
    font-size: 0.78rem;
  }

  th,
  td {
    padding: 0.62rem 0.75rem;
    border-bottom: 1px solid var(--color-divider);
    text-align: left;
    vertical-align: top;
  }

  th:first-child,
  td:first-child {
    padding-left: 0;
  }

  th:last-child,
  td:last-child {
    padding-right: 0;
  }

  th {
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  .right {
    text-align: right;
  }

  .limit-note,
  .empty-state {
    margin: 0;
    padding: 0.85rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  @media (max-width: 720px) {
    .table-scroll {
      overflow: visible;
    }

    table,
    tbody,
    tr,
    td {
      display: block;
      width: 100%;
    }

    thead {
      display: none;
    }

    tr {
      padding: 0.65rem 0;
      border-bottom: 1px solid var(--color-divider);
    }

    tbody tr:last-child {
      border-bottom: 0;
    }

    td,
    td:first-child,
    td:last-child {
      display: grid;
      grid-template-columns: minmax(6.5rem, 38%) minmax(0, 1fr);
      gap: 0.75rem;
      padding: 0.24rem 0;
      border: 0;
      text-align: left;
    }

    td::before {
      content: attr(data-label);
      color: var(--color-text-muted);
      font-size: 0.68rem;
      font-weight: var(--weight-semibold);
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
  }
</style>
