DELETE FROM checklist_items
WHERE section_id IN (
  SELECT id
  FROM checklist_sections
  WHERE slug IN ('sushi-prep', 'sushi', 'kitchen')
)
AND content IN ('Opening', 'Mid Day', 'Closing');
