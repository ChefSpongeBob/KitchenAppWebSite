-- Scale/performance indexes for multi-tenant launch.
-- These target the hottest app/admin paths: homepage, admin dashboard,
-- scheduling, lists, docs/media, onboarding, temps, and cameras.

CREATE INDEX IF NOT EXISTS idx_business_users_business_active_role
ON business_users(business_id, is_active, role);

CREATE INDEX IF NOT EXISTS idx_business_users_user_active
ON business_users(user_id, is_active, business_id);

CREATE INDEX IF NOT EXISTS idx_todos_business_created
ON todos(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_todos_business_completed
ON todos(business_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_todo_assignments_business_user
ON todo_assignments(business_id, user_id, todo_id);

CREATE INDEX IF NOT EXISTS idx_todo_assignments_business_todo
ON todo_assignments(business_id, todo_id, user_id);

CREATE INDEX IF NOT EXISTS idx_todo_completion_log_business_completed
ON todo_completion_log(business_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_business_active_group
ON documents(business_id, is_active, section, category, title);

CREATE INDEX IF NOT EXISTS idx_documents_business_slug_active
ON documents(business_id, slug, is_active);

CREATE INDEX IF NOT EXISTS idx_documents_business_file_url
ON documents(business_id, file_url);

CREATE INDEX IF NOT EXISTS idx_recipes_business_category_title
ON recipes(business_id, category, title);

CREATE INDEX IF NOT EXISTS idx_recipes_business_created
ON recipes(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whiteboard_posts_business_votes
ON whiteboard_posts(business_id, votes DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whiteboard_posts_business_created
ON whiteboard_posts(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whiteboard_review_business_status
ON whiteboard_review(business_id, status, post_id);

CREATE INDEX IF NOT EXISTS idx_list_sections_business_domain_slug
ON list_sections(business_id, domain, slug);

CREATE INDEX IF NOT EXISTS idx_list_items_business_section_sort
ON list_items(business_id, section_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_checklist_sections_business_slug
ON checklist_sections(business_id, slug);

CREATE INDEX IF NOT EXISTS idx_checklist_items_business_section_sort
ON checklist_items(business_id, section_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_business_week_date
ON schedule_shifts(business_id, week_id, shift_date, start_time, sort_order);

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_business_user_date
ON schedule_shifts(business_id, user_id, shift_date, start_time);

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_business_date
ON schedule_shifts(business_id, shift_date, user_id);

CREATE INDEX IF NOT EXISTS idx_schedule_week_team_business_week
ON schedule_week_team(business_id, week_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_schedule_shift_offers_business_shift
ON schedule_shift_offers(business_id, shift_id, requested_by_user_id);

CREATE INDEX IF NOT EXISTS idx_user_schedule_availability_business_user
ON user_schedule_availability(business_id, user_id, weekday);

CREATE INDEX IF NOT EXISTS idx_user_schedule_time_off_business_user_status
ON user_schedule_time_off_requests(business_id, user_id, status, start_date);

CREATE INDEX IF NOT EXISTS idx_user_schedule_time_off_business_status
ON user_schedule_time_off_requests(business_id, status, start_date);

CREATE INDEX IF NOT EXISTS idx_temps_business_ts
ON temps(business_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_temps_business_sensor_ts
ON temps(business_id, sensor_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_nodes_business_sensor
ON sensor_nodes(business_id, sensor_id);

CREATE INDEX IF NOT EXISTS idx_camera_events_business_created
ON camera_events(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_camera_events_business_camera_created
ON camera_events(business_id, camera_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_camera_events_business_image
ON camera_events(business_id, image_url);

CREATE INDEX IF NOT EXISTS idx_camera_events_business_clip
ON camera_events(business_id, clip_url);

CREATE INDEX IF NOT EXISTS idx_camera_sources_business_active
ON camera_sources(business_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_camera_sources_business_camera
ON camera_sources(business_id, camera_id);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_items_business_user_status
ON employee_onboarding_items(business_id, user_id, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_items_business_file
ON employee_onboarding_items(business_id, file_url);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_items_business_source
ON employee_onboarding_items(business_id, source_file_url);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_template_business_source
ON employee_onboarding_template_items(business_id, source_file_url, is_active);
