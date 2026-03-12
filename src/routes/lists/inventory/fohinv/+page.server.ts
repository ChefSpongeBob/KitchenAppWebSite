import type { Actions, PageServerLoad } from './$types';
import { createListPage } from '$lib/server/preplist';

const handlers = createListPage('inventory', 'foh', 'FOH Inventory', {
  subtitle: 'Track front-of-house stock counts and reset for a fresh count cycle.',
  valueLabel: 'Count',
  submitLabel: 'Submit Inventory Counts',
  resetLabel: 'Reset Inventory Count',
  adminSummaryLabel: '+ Admin Par Levels',
  defaults: [
    { content: 'Takeout chopsticks', par_count: 8 },
    { content: 'Soy sauce bottles', par_count: 12 },
    { content: 'Kids cups', par_count: 16 },
    { content: 'Napkin sleeves', par_count: 10 },
    { content: 'To-go ramekins', par_count: 14 }
  ]
});

export const load: PageServerLoad = handlers.load;
export const actions: Actions = handlers.actions;
