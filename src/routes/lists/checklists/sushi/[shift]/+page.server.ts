import type { Actions, PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createChecklistPage } from '$lib/server/checklists';

const config = {
  opening: {
    slug: 'sushi-opening',
    title: 'Sushi Opening Checklist',
    defaults: [{ content: 'Turn Lights On' }]
  },
  midday: {
    slug: 'sushi-midday',
    title: 'Sushi Mid Day Checklist',
    defaults: [{ content: 'Take Out Trash' }]
  },
  closing: {
    slug: 'sushi-closing',
    title: 'Sushi Closing Checklist',
    defaults: [{ content: 'Turn Lights Off' }]
  }
} as const;

function getHandlers(shift: string) {
  const entry = config[shift as keyof typeof config];
  if (!entry) throw error(404, 'Checklist not found');
  return createChecklistPage(entry.slug, entry.title, {
    subtitle: 'Work through the checklist and reset when needed.',
    resetLabel: 'Reset Checklist',
    defaults: [...entry.defaults]
  });
}

export const load: PageServerLoad = async (event) => {
  return getHandlers(event.params.shift).load(event);
};

export const actions: Actions = {
  toggle_checked: async (event) => {
    return getHandlers(event.params.shift).actions.toggle_checked(event);
  },
  reset_checklist: async (event) => {
    return getHandlers(event.params.shift).actions.reset_checklist(event);
  }
};
