import type { Actions, PageServerLoad } from './$types';
import { createListPage } from '$lib/server/preplist';

const handlers = createListPage('orders', 'sfotw', 'SFOTW Order', {
  subtitle: 'Track order quantities for weekly specials and rotating items.',
  valueLabel: 'Order',
  submitLabel: 'Submit Order Counts',
  resetLabel: 'Reset Order Sheet',
  adminSummaryLabel: '+ Admin Par Levels',
  defaults: [
    { content: 'Promo fish cut', par_count: 2 },
    { content: 'Seasonal garnish', par_count: 3 },
    { content: 'Limited sauce batch', par_count: 2 },
    { content: 'Feature packaging', par_count: 1 }
  ]
});

export const load: PageServerLoad = handlers.load;
export const actions: Actions = handlers.actions;
