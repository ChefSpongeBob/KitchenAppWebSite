-- Short-lived write token used inside atomic draft batches. It prevents two
-- managers from replacing the same week from the same stale draft version.

ALTER TABLE schedule_weeks ADD COLUMN draft_write_token TEXT;
