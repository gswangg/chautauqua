-- DEC-271 (task w5-c): reviewer conflict-of-interest / recusal. A reviewer
-- may recuse themselves from a submission within a plan; recused submissions
-- are excluded from that reviewer's queue and scoring is blocked (409).
CREATE TABLE `review_recusal` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_recusal_plan_id_idx` ON `review_recusal` (`plan_id`);
--> statement-breakpoint
CREATE INDEX `review_recusal_submission_id_idx` ON `review_recusal` (`submission_id`);
--> statement-breakpoint
CREATE INDEX `review_recusal_user_id_idx` ON `review_recusal` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_recusal_plan_submission_user_idx` ON `review_recusal` (`plan_id`,`submission_id`,`user_id`);
