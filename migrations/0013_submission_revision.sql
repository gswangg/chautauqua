-- DEC-158 (task w3-b): CNT-11 session content version history. Each
-- successful title/description change on a submission (organizer PATCH
-- /submissions/:id or the portal-edit locked-field sync) appends a
-- POST-edit snapshot row here; restore is a normal update through the same
-- write path (so it appends its own row too). Append-only per DEC-015.
CREATE TABLE `submission_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`editor_user_id` text,
	`editor_name` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submission_revision_submission_id_idx` ON `submission_revision` (`submission_id`);
