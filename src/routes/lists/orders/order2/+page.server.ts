import type { Actions, PageServerLoad } from './$types';
import { createListPage } from '$lib/server/preplist';

const handlers = createListPage('orders', 'order2', 'Order Sheet 2', {
  subtitle: 'Secondary order sheet for overflow and support items.',
  valueLabel: 'Order',
  submitLabel: 'Submit Order Counts',
  resetLabel: 'Reset Order Sheet',
  adminSummaryLabel: '+ Admin Par Levels',
  defaults: [
    { content: 'Ebi boxes', par_count: 2 },
    { content: 'Seaweed salad tubs', par_count: 3 },
    { content: 'Gyoza cases', par_count: 2 },
    { content: 'Ramen bowls', par_count: 4 }
  ]
});

export const load: PageServerLoad = handlers.load;
export const actions: Actions = handlers.actions;
