CREATE TABLE `submission_track` (
	`submission_id` text NOT NULL,
	`track_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`submission_id`, `track_id`)
);
--> statement-breakpoint
CREATE INDEX `submission_track_submission_id_idx` ON `submission_track` (`submission_id`);--> statement-breakpoint
CREATE INDEX `submission_track_track_id_idx` ON `submission_track` (`track_id`);--> statement-breakpoint
ALTER TABLE `form` ADD `tracks_json` text;