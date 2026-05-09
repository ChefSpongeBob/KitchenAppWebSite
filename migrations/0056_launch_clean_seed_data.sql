-- Launch cleanup for Crimini.
-- Keeps schema and app logic intact while removing copied seed data
-- from the original restaurant app before production initialization.

DELETE FROM documents
WHERE id IN ('doc-about', 'doc-handbook', 'doc-sop', 'doc-handbook-pdf')
   OR slug IN ('about', 'handbook', 'sop');

DELETE FROM whiteboard_posts
WHERE id IN ('idea-late-night', 'idea-sauce-kits', 'idea-mango-crab');

DELETE FROM list_items
WHERE section_id IN (
  SELECT id
  FROM list_sections
  WHERE (
      domain = 'inventory'
      AND (
        id IN ('inventory-foh', 'inventory-kitchen', 'inventory-sushi')
        OR slug IN ('foh', 'kitchen', 'sushi')
      )
    )
    OR (
      domain = 'orders'
      AND (
        id IN ('orders-sysco', 'orders-sfotw', 'orders-order1', 'orders-order2', 'orders-order3')
        OR slug IN ('sysco', 'sfotw', 'order1', 'order2', 'order3')
      )
    )
    OR (
      domain = 'preplists'
      AND (
        id IN ('preplists-sushi', 'preplists-veg', 'preplists-kitchen', 'preplists-fish')
        OR slug IN ('sushi', 'veg', 'kitchen', 'fish')
      )
    )
)
OR id LIKE 'inventory-foh-%'
OR id LIKE 'inventory-kitchen-%'
OR id LIKE 'inventory-sushi-%'
OR id LIKE 'orders-sysco-%'
OR id LIKE 'orders-sfotw-%'
OR id LIKE 'orders-order1-%'
OR id LIKE 'orders-order2-%'
OR id LIKE 'orders-order3-%'
OR id LIKE 'pli-sushi-%'
OR id LIKE 'pli-veg-%'
OR id LIKE 'pli-kitchen-%'
OR id LIKE 'pli-fish-%';

DELETE FROM list_sections
WHERE (
    domain = 'inventory'
    AND (
      id IN ('inventory-foh', 'inventory-kitchen', 'inventory-sushi')
      OR slug IN ('foh', 'kitchen', 'sushi')
    )
  )
  OR (
    domain = 'orders'
    AND (
      id IN ('orders-sysco', 'orders-sfotw', 'orders-order1', 'orders-order2', 'orders-order3')
      OR slug IN ('sysco', 'sfotw', 'order1', 'order2', 'order3')
    )
  )
  OR (
    domain = 'preplists'
    AND (
      id IN ('preplists-sushi', 'preplists-veg', 'preplists-kitchen', 'preplists-fish')
      OR slug IN ('sushi', 'veg', 'kitchen', 'fish')
    )
  );

DELETE FROM schedule_departments
WHERE id IN ('schedule-department-sushi', 'schedule-department-kitchen')
   OR name IN ('Sushi', 'Kitchen');

DELETE FROM user_schedule_departments
WHERE department IN ('Sushi', 'Kitchen');
