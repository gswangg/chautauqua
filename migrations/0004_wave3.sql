ALTER TABLE `plan_reviewer` ADD `submission_id` text;--> statement-breakpoint
CREATE INDEX `plan_reviewer_submission_id_idx` ON `plan_reviewer` (`submission_id`);--> statement-breakpoint
ALTER TABLE `task_assignment` ADD `response_json` text;--> statement-breakpoint
ALTER TABLE `task_assignment` ADD `file_id` text;--> statement-breakpoint
ALTER TABLE `task_assignment` ADD `last_reminded_at` integer;