CREATE TABLE `api_token` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_token_token_hash_idx` ON `api_token` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `api_token_org_id_idx` ON `api_token` (`org_id`);
