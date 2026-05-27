-- Remove copied checklist seed data so checklist categories only come from admin-created data.

DELETE FROM checklist_items
WHERE section_id IN (
  SELECT id
  FROM checklist_sections
  WHERE id IN (
    'checklists-sushi-prep',
    'checklists-sushi',
    'checklists-kitchen',
    'checklists-sushi-prep-opening',
    'checklists-sushi-prep-midday',
    'checklists-sushi-prep-closing',
    'checklists-sushi-opening',
    'checklists-sushi-midday',
    'checklists-sushi-closing',
    'checklists-kitchen-opening',
    'checklists-kitchen-midday',
    'checklists-kitchen-closing'
  )
  OR slug IN (
    'sushi-prep',
    'sushi',
    'kitchen',
    'sushi-prep-opening',
    'sushi-prep-midday',
    'sushi-prep-closing',
    'sushi-opening',
    'sushi-midday',
    'sushi-closing',
    'kitchen-opening',
    'kitchen-midday',
    'kitchen-closing'
  )
)
OR id LIKE 'checklists-sushi-prep-%'
OR id LIKE 'checklists-sushi-%'
OR id LIKE 'checklists-kitchen-%';

DELETE FROM checklist_sections
WHERE id IN (
    'checklists-sushi-prep',
    'checklists-sushi',
    'checklists-kitchen',
    'checklists-sushi-prep-opening',
    'checklists-sushi-prep-midday',
    'checklists-sushi-prep-closing',
    'checklists-sushi-opening',
    'checklists-sushi-midday',
    'checklists-sushi-closing',
    'checklists-kitchen-opening',
    'checklists-kitchen-midday',
    'checklists-kitchen-closing'
  )
  OR slug IN (
    'sushi-prep',
    'sushi',
    'kitchen',
    'sushi-prep-opening',
    'sushi-prep-midday',
    'sushi-prep-closing',
    'sushi-opening',
    'sushi-midday',
    'sushi-closing',
    'kitchen-opening',
    'kitchen-midday',
    'kitchen-closing'
  );
