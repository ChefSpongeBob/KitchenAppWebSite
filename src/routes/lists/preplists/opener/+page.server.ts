import type { Actions, PageServerLoad } from './$types';
import { createPreplistPage } from '$lib/server/preplist';

const handlers = createPreplistPage('fish', 'Fish Opener Prep');

export const load: PageServerLoad = handlers.load;
export const actions: Actions = handlers.actions;
