-- Checklists are single created lists. Early test logic generated opening/midday/closing
-- child sections automatically; this collapses those generated sections back into one checklist.
-- D1 does not allow TEMP tables in migrations, so short-lived helper tables are created and dropped.

DROP TABLE IF EXISTS migration_0090_checklist_generated;
DROP TABLE IF EXISTS migration_0090_checklist_keep;
DROP TABLE IF EXISTS migration_0090_checklist_names;

CREATE TABLE migration_0090_checklist_generated AS
SELECT
  id,
  business_id,
  slug,
  title,
  CASE
    WHEN lower(slug) LIKE '%-opening' THEN substr(slug, 1, length(slug) - 8)
    WHEN lower(slug) LIKE '%-midday' THEN substr(slug, 1, length(slug) - 7)
    WHEN lower(slug) LIKE '%-closing' THEN substr(slug, 1, length(slug) - 8)
    ELSE slug
  END AS base_slug
FROM checklist_sections
WHERE lower(slug) LIKE '%-opening'
   OR lower(slug) LIKE '%-midday'
   OR lower(slug) LIKE '%-closing';

CREATE TABLE migration_0090_checklist_keep AS
SELECT DISTINCT
  generated.business_id,
  generated.base_slug,
  COALESCE(
    (
      SELECT exact.id
      FROM checklist_sections exact
      WHERE exact.business_id = generated.business_id
        AND exact.slug = generated.base_slug
      LIMIT 1
    ),
    (
      SELECT preferred.id
      FROM migration_0090_checklist_generated preferred
      WHERE preferred.business_id = generated.business_id
        AND preferred.base_slug = generated.base_slug
      ORDER BY
        CASE
          WHEN lower(preferred.slug) LIKE '%-opening' THEN 0
          WHEN lower(preferred.slug) LIKE '%-midday' THEN 1
          WHEN lower(preferred.slug) LIKE '%-closing' THEN 2
          ELSE 3
        END,
        preferred.slug ASC
      LIMIT 1
    )
  ) AS keeper_id
FROM migration_0090_checklist_generated generated;

CREATE TABLE migration_0090_checklist_names AS
SELECT
  keep.business_id,
  keep.base_slug,
  keep.keeper_id,
  trim(
    replace(
      replace(
        replace(section.title, ' Opening Checklist', ''),
        ' Mid Day Checklist',
        ''
      ),
      ' Closing Checklist',
      ''
    )
  ) AS base_title
FROM migration_0090_checklist_keep keep
JOIN checklist_sections section ON section.id = keep.keeper_id;

UPDATE checklist_items
SET section_id = (
  SELECT keep.keeper_id
  FROM migration_0090_checklist_generated generated
  JOIN migration_0090_checklist_keep keep
    ON keep.business_id = generated.business_id
   AND keep.base_slug = generated.base_slug
  WHERE generated.id = checklist_items.section_id
)
WHERE section_id IN (
  SELECT generated.id
  FROM migration_0090_checklist_generated generated
  JOIN migration_0090_checklist_keep keep
    ON keep.business_id = generated.business_id
   AND keep.base_slug = generated.base_slug
  WHERE generated.id <> keep.keeper_id
);

UPDATE list_item_activity_events
SET section_id = (
  SELECT keep.keeper_id
  FROM migration_0090_checklist_generated generated
  JOIN migration_0090_checklist_keep keep
    ON keep.business_id = generated.business_id
   AND keep.base_slug = generated.base_slug
  WHERE generated.id = list_item_activity_events.section_id
)
WHERE domain = 'checklists'
  AND section_id IN (
    SELECT generated.id
    FROM migration_0090_checklist_generated generated
    JOIN migration_0090_checklist_keep keep
      ON keep.business_id = generated.business_id
     AND keep.base_slug = generated.base_slug
    WHERE generated.id <> keep.keeper_id
  );

UPDATE list_submission_batches
SET
  section_id = (
    SELECT keep.keeper_id
    FROM migration_0090_checklist_generated generated
    JOIN migration_0090_checklist_keep keep
      ON keep.business_id = generated.business_id
     AND keep.base_slug = generated.base_slug
    WHERE generated.id = list_submission_batches.section_id
  ),
  section_title_snapshot = (
    SELECT
      CASE
        WHEN lower(names.base_title) LIKE '% checklist' THEN names.base_title
        ELSE names.base_title || ' Checklist'
      END
    FROM migration_0090_checklist_generated generated
    JOIN migration_0090_checklist_keep keep
      ON keep.business_id = generated.business_id
     AND keep.base_slug = generated.base_slug
    JOIN migration_0090_checklist_names names
      ON names.business_id = keep.business_id
     AND names.base_slug = keep.base_slug
    WHERE generated.id = list_submission_batches.section_id
  )
WHERE domain = 'checklists'
  AND section_id IN (
    SELECT generated.id
    FROM migration_0090_checklist_generated generated
    JOIN migration_0090_checklist_keep keep
      ON keep.business_id = generated.business_id
     AND keep.base_slug = generated.base_slug
    WHERE generated.id <> keep.keeper_id
  );

UPDATE checklist_sections
SET
  slug = (
    SELECT names.base_slug
    FROM migration_0090_checklist_names names
    WHERE names.keeper_id = checklist_sections.id
  ),
  title = (
    SELECT
      CASE
        WHEN lower(names.base_title) LIKE '% checklist' THEN names.base_title
        ELSE names.base_title || ' Checklist'
      END
    FROM migration_0090_checklist_names names
    WHERE names.keeper_id = checklist_sections.id
  ),
  updated_at = strftime('%s', 'now')
WHERE id IN (SELECT keeper_id FROM migration_0090_checklist_keep)
  AND NOT EXISTS (
    SELECT 1
    FROM checklist_sections exact
    JOIN migration_0090_checklist_names names
      ON names.base_slug = exact.slug
     AND names.business_id = exact.business_id
    WHERE exact.id <> checklist_sections.id
      AND names.keeper_id = checklist_sections.id
  );

DELETE FROM checklist_sections
WHERE id IN (
  SELECT generated.id
  FROM migration_0090_checklist_generated generated
  JOIN migration_0090_checklist_keep keep
    ON keep.business_id = generated.business_id
   AND keep.base_slug = generated.base_slug
  WHERE generated.id <> keep.keeper_id
);

DROP TABLE IF EXISTS migration_0090_checklist_names;
DROP TABLE IF EXISTS migration_0090_checklist_keep;
DROP TABLE IF EXISTS migration_0090_checklist_generated;
