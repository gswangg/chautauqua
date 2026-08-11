-- DEC-267 (task w4-c): close the "index on every FK" gap task-w2-e's battery
-- flagged as OPEN ITEM 1. One CREATE INDEX per *_id column that wasn't yet
-- the first column of any index -- names match src/db/schema.ts exactly.
CREATE INDEX IF NOT EXISTS `plan_reviewer_track_id_idx` ON `plan_reviewer`(`track_id`);
CREATE INDEX IF NOT EXISTS `task_assignment_file_id_idx` ON `task_assignment`(`file_id`);
CREATE INDEX IF NOT EXISTS `file_uploaded_by_contact_id_idx` ON `file`(`uploaded_by_contact_id`);
CREATE INDEX IF NOT EXISTS `file_comment_author_contact_id_idx` ON `file_comment`(`author_contact_id`);
CREATE INDEX IF NOT EXISTS `file_comment_author_user_id_idx` ON `file_comment`(`author_user_id`);
CREATE INDEX IF NOT EXISTS `api_token_created_by_user_id_idx` ON `api_token`(`created_by_user_id`);
CREATE INDEX IF NOT EXISTS `pipeline_entry_contact_id_idx` ON `pipeline_entry`(`contact_id`);
CREATE INDEX IF NOT EXISTS `pipeline_activity_author_user_id_idx` ON `pipeline_activity`(`author_user_id`);
CREATE INDEX IF NOT EXISTS `submission_revision_editor_user_id_idx` ON `submission_revision`(`editor_user_id`);
