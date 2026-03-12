import type { Actions, PageServerLoad } from './$types';
import { createListPage } from '$lib/server/preplist';

const handlers = createListPage('orders', 'sysco', 'Sysco Order', {
  subtitle: 'Build out the Sysco order list with counts to place.',
  valueLabel: 'Order',
  submitLabel: 'Submit Order Counts',
  resetLabel: 'Reset Order Sheet',
  adminSummaryLabel: '+ Admin Par Levels',
  defaults: [
    { content: 'Chicken cases', par_count: 4 },
    { content: 'Avocado cases', par_count: 3 },
    { content: 'Cream cheese cases', par_count: 2 },
    { content: 'To-go bag cases', par_count: 2 },
    { content: 'Glove boxes', par_count: 10 }
  ]
});

export const load: PageServerLoad = handlers.load;
export const actions: Actions = handlers.actions;
