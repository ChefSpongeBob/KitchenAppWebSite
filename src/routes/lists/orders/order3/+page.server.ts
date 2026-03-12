import type { Actions, PageServerLoad } from './$types';
import { createListPage } from '$lib/server/preplist';

const handlers = createListPage('orders', 'order3', 'Order Sheet 3', {
  subtitle: 'Additional order sheet for backup and less frequent items.',
  valueLabel: 'Order',
  submitLabel: 'Submit Order Counts',
  resetLabel: 'Reset Order Sheet',
  adminSummaryLabel: '+ Admin Par Levels',
  defaults: [
    { content: 'Disposable lids', par_count: 6 },
    { content: 'Sake bottles', par_count: 3 },
    { content: 'Dessert cups', par_count: 4 },
    { content: 'Bento box sleeves', par_count: 5 }
  ]
});

export const load: PageServerLoad = handlers.load;
export const actions: Actions = handlers.actions;
