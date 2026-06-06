CREATE INDEX IF NOT EXISTS idx_list_item_activity_lookup
ON list_item_activity_events(business_id, domain, item_id, occurred_at);
