-- DEC-157 (task w3-a): CRM sourcing pipeline (CRM-07/08). Adds org-scoped
-- pipeline_entry (one row per contact enrolled into the pipeline, fixed
-- five-stage enum 'identified' | 'contacted' | 'interested' | 'confirmed' |
-- 'declined') and pipeline_activity (the append-only 'move'/'note' feed that
-- doubles as both stage history and the notes composer's backing store, per
-- CRM-08's acceptance of "a general activity feed that includes the
-- moves"). Append-only per DEC-015; follows the 0005_w4_segment/
-- 0009_review_rounds convention of a plain ALTER/CREATE file without a
-- fresh meta/NNNN_snapshot.json.
CREATE TABLE `pipeline_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`stage` text NOT NULL DEFAULT 'identified',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pipeline_entry_org_id_contact_id_idx` ON `pipeline_entry` (`org_id`,`contact_id`);
--> statement-breakpoint
CREATE INDEX `pipeline_entry_org_id_idx` ON `pipeline_entry` (`org_id`);
--> statement-breakpoint
CREATE TABLE `pipeline_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text,
	`from_stage` text,
	`to_stage` text,
	`author_user_id` text NOT NULL,
	`author_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pipeline_activity_entry_id_idx` ON `pipeline_activity` (`entry_id`);
