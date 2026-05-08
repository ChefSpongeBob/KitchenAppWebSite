-- Remove copied/seeded prep-list categories so prep lists only come from admin-created data.

DELETE FROM list_items
WHERE section_id IN (
  SELECT id
  FROM list_sections
  WHERE domain = 'preplists'
    AND (
      id IN ('preplists-sushi', 'preplists-veg', 'preplists-kitchen', 'preplists-fish')
      OR slug IN ('sushi', 'veg', 'kitchen', 'fish')
    )
);

DELETE FROM list_sections
WHERE domain = 'preplists'
  AND (
    id IN ('preplists-sushi', 'preplists-veg', 'preplists-kitchen', 'preplists-fish')
    OR slug IN ('sushi', 'veg', 'kitchen', 'fish')
  );
