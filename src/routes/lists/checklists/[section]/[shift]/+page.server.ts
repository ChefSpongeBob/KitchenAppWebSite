import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createChecklistPage } from '$lib/server/checklists';

const ALLOWED_SHIFTS = new Set(['opening', 'midday', 'closing']);

function toTitle(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function handlersFor(section: string, shift: string) {
  if (!ALLOWED_SHIFTS.has(shift)) {
    throw error(404, 'Checklist shift not found.');
  }

  const sectionSlug = `${section}-${shift}`;
  const title = `${toTitle(section)} ${toTitle(shift)}`;

  return createChecklistPage(sectionSlug, title, {
    subtitle: 'Work through the checklist and reset when needed.',
    resetLabel: 'Reset Checklist',
    defaults: []
  });
}

function requireParam(value: string | undefined, label: string) {
  if (!value) {
    throw error(404, `Checklist ${label} not found.`);
  }
  return value;
}

export const load: PageServerLoad = async (event) => {
  const section = requireParam(event.params.section, 'section');
  const shift = requireParam(event.params.shift, 'shift');
  return handlersFor(section, shift).load(event);
};

export const actions: Actions = {
  toggle_checked: async (event) => {
    const section = requireParam(event.params.section, 'section');
    const shift = requireParam(event.params.shift, 'shift');
    return handlersFor(section, shift).actions.toggle_checked(event);
  },
  reset_checklist: async (event) => {
    const section = requireParam(event.params.section, 'section');
    const shift = requireParam(event.params.shift, 'shift');
    return handlersFor(section, shift).actions.reset_checklist(event);
  }
};
