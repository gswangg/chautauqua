-- DEC-337 (task w18-e): composite indexes this wave's rewritten queries read
-- through (email log by event ordered by sent_at, submission list by event
-- ordered by created_at, contacts list by org sorted by last/first name).
-- Names match src/db/schema.ts exactly.
CREATE INDEX IF NOT EXISTS `email_log_event_id_sent_at_idx` ON `email_log`(`event_id`, `sent_at`);
CREATE INDEX IF NOT EXISTS `submission_event_id_created_at_idx` ON `submission`(`event_id`, `created_at`);
CREATE INDEX IF NOT EXISTS `contact_org_id_last_name_first_name_idx` ON `contact`(`org_id`, `last_name`, `first_name`);
