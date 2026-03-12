import type { Actions, PageServerLoad } from './$types';
import { createListPage } from '$lib/server/preplist';

const handlers = createListPage('orders', 'order1', 'Order Sheet 1', {
  subtitle: 'Primary order sheet with editable quantities and admin par targets.',
  valueLabel: 'Order',
  submitLabel: 'Submit Order Counts',
  resetLabel: 'Reset Order Sheet',
  adminSummaryLabel: '+ Admin Par Levels',
  defaults: [
    { content: 'Salmon cases', par_count: 5 },
    { content: 'Tuna cases', par_count: 4 },
    { content: 'Shrimp boxes', par_count: 3 },
    { content: 'Crab mix tubs', par_count: 6 }
  ]
});

export const load: PageServerLoad = handlers.load;
export const actions: Actions = handlers.actions;
