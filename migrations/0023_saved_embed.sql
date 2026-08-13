-- DEC-785: saved embeds -- named, listed, enable/disable-able. A disabled
-- (or deleted) row's public URL /embed/e/:embedId must 404, not silently
-- keep serving.

CREATE TABLE `embed` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`surface` text NOT NULL,
	`format` text NOT NULL,
	`options_json` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE INDEX `embed_org_id_idx` ON `embed` (`org_id`);
CREATE INDEX `embed_event_id_idx` ON `embed` (`event_id`);
