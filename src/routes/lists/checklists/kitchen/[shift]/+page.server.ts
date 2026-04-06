import type { Actions, PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createChecklistPage } from '$lib/server/checklists';

const config = {
  opening: {
    slug: 'kitchen-opening',
    title: 'Kitchen Opening Checklist',
    defaults: [{ content: 'Turn Lights On' }]
  },
  midday: {
    slug: 'kitchen-midday',
    title: 'Kitchen Mid Day Checklist',
    defaults: [{ content: 'Take Out Trash' }]
  },
  closing: {
    slug: 'kitchen-closing',
    title: 'Kitchen Closing Checklist',
    defaults: [
      { content: 'CHECK FOR NIGHTLY SPECIALTY TASK!' },
      { content: 'Turn all equipment off (Heat lamp, Hot line bar, steamwell, fryers, oven, salamander, etc)' },
      { content: 'Sanitize inside and sides of cook bus and 7 bus' },
      { content: 'Restock line to full capacity, consolidate product if able. FIFO!' },
      { content: 'Sanitize edges and bottoms of all containers and dividers on kitchen line' },
      { content: 'Wipe down sauces and check dates for expiration' },
      { content: 'Fill out prep list ***PULL PROTEINS***' },
      { content: 'Discard panko, rice flour, batter, and the grate tray.' },
      { content: 'Clean heat lamp thoroughly and move to top of Sushi expo rack' },
      { content: 'Wipe Toast screen and scrub/sani expo window (move all dishes)' },
      { content: 'Dump water and cooking pots and send through dish' },
      { content: 'Clear small cutting board, ladles, whisks, bowls, spatula, etc. Anything dirtied through service send through the dish pit.' },
      { content: 'Empty steamwell of water, wipe out and ice bath contents (placing the pans in a large hotel with ice as far as its able to reach up), place in walkin.' },
      { content: 'Wipe off small shelf, fill and wipe off Sesame Seeds, Chili Oil, replace salt bowl' },
      { content: 'Scrub and sanitize Salamander, change foil on inner tray' },
      { content: 'Scrub and sanitize saute side wall, fryers, doors and oven, thoroughly' },
      { content: 'Replace foil on oven crumb tray' },
      { content: 'Clean hand sink by 7 bus with scrubbie and soap' },
      { content: 'Bleach, scrub and sanitize cutting board' },
      { content: 'Sweep floors underneath busses, fryers, oven etc well. Do not use only water to clean under equipment!' },
      { content: 'Use floor cleaner water and a white ginger bucket to toss water under equipment and across all floor. Deck scrub floors including under things, squeegee well.' },
      { content: 'After floors are complete, wipe all bus faces well and resanitize.' },
      { content: 'Assist Dish Pit in completing tasks.' }
    ]
  }
} as const;

function getHandlers(shift: string) {
  const entry = config[shift as keyof typeof config];
  if (!entry) throw error(404, 'Checklist not found');
  return createChecklistPage(entry.slug, entry.title, {
    subtitle: 'Work through the checklist and reset when needed.',
    resetLabel: 'Reset Checklist',
    defaults: [...entry.defaults],
    replaceDefaults: shift === 'closing',
    infoCardTitle: shift === 'closing' ? 'Weekly Cleaning Tasks' : undefined,
    infoCardIntro: shift === 'closing' ? 'Use this as the weekly kitchen cleaning reference under the closing list.' : undefined,
    infoCardSections:
      shift === 'closing'
        ? [
            {
              title: 'Monday',
              lines: ['Pull Hood Vents down, degrease, scrub and run through dish, wipe well to dry and remove any excess buildups. Replace into Hood.']
            },
            {
              title: 'Tuesday',
              lines: ['Deep clean all kitchen busses (Cook Bus, 7, 8 and 9) emptying out and wiping all sides and bottom, door sills, insides and replacing any cooling pans (the large hotel pans or lids) with fresh ones. Dishwashers can also be used to complete this task if needed!']
            },
            {
              title: 'Wednesday',
              lines: ['Pull all busses off of the wall (minus cook bus) and fryers, sweep, scrub and squeegee floor and wall behind these.']
            },
            {
              title: 'Thursday',
              lines: ['Pull Hood Vents down, degrease, scrub and run through dish, wipe well to dry and remove any excess buildups. Replace into Hood.']
            },
            {
              title: 'Friday',
              lines: []
            },
            {
              title: 'Saturday',
              lines: []
            },
            {
              title: 'Sunday',
              lines: ['Clean Floor Grates and drains, run grates through dish washer at END OF DISH ROUNDS, empty floor drain and wipe all debris out of corners crevices and drain area.']
            }
          ]
        : undefined
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
