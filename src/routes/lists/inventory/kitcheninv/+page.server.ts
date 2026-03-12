import type { Actions, PageServerLoad } from './$types';
import { createListPage } from '$lib/server/preplist';

const handlers = createListPage('inventory', 'kitchen', 'Kitchen Inventory', {
  subtitle: 'Track kitchen stock counts and reset for a fresh count cycle.',
  valueLabel: 'Count',
  submitLabel: 'Submit Inventory Counts',
  resetLabel: 'Reset Inventory Count',
  adminSummaryLabel: '+ Admin Par Levels',
  defaults: [
    { content: 'Panko cases', par_count: 4 },
    { content: 'Tempura flour', par_count: 6 },
    { content: 'Rice bags', par_count: 10 },
    { content: 'Fryer oil jugs', par_count: 8 },
    { content: 'To-go soup cups', par_count: 6 }
  ]
});

export const load: PageServerLoad = handlers.load;
export const actions: Actions = handlers.actions;
