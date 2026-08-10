CREATE TABLE `auth_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_session_user_id_idx` ON `auth_session` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `auth_session_token_hash_idx` ON `auth_session` (`token_hash`);--> statement-breakpoint
CREATE TABLE `contact` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`company` text,
	`title` text,
	`bio` text,
	`headshot_url` text,
	`social_links_json` text,
	`notes` text,
	`custom_fields_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_org_id_idx` ON `contact` (`org_id`);--> statement-breakpoint
CREATE INDEX `contact_email_idx` ON `contact` (`email`);--> statement-breakpoint
CREATE TABLE `email_log` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`template_id` text,
	`contact_id` text,
	`to_email` text NOT NULL,
	`subject` text NOT NULL,
	`body_text` text NOT NULL,
	`body_html` text,
	`ics_text` text,
	`provider` text DEFAULT 'dev' NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`sent_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_log_event_id_idx` ON `email_log` (`event_id`);--> statement-breakpoint
CREATE INDEX `email_log_template_id_idx` ON `email_log` (`template_id`);--> statement-breakpoint
CREATE INDEX `email_log_contact_id_idx` ON `email_log` (`contact_id`);--> statement-breakpoint
CREATE TABLE `email_template` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`body_text` text NOT NULL,
	`body_html` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_template_event_id_idx` ON `email_template` (`event_id`);--> statement-breakpoint
CREATE TABLE `evaluation` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`round` integer DEFAULT 1 NOT NULL,
	`scores_json` text NOT NULL,
	`comment` text,
	`submitted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evaluation_plan_id_idx` ON `evaluation` (`plan_id`);--> statement-breakpoint
CREATE INDEX `evaluation_submission_id_idx` ON `evaluation` (`submission_id`);--> statement-breakpoint
CREATE INDEX `evaluation_reviewer_id_idx` ON `evaluation` (`reviewer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_plan_submission_reviewer_round_idx` ON `evaluation` (`plan_id`,`submission_id`,`reviewer_id`,`round`);--> statement-breakpoint
CREATE TABLE `evaluation_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`instructions` text,
	`open_date` integer,
	`close_date` integer,
	`filters_json` text,
	`anonymized` integer DEFAULT false NOT NULL,
	`scale_json` text NOT NULL,
	`criteria_json` text NOT NULL,
	`rounds` integer DEFAULT 1 NOT NULL,
	`max_evaluations` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evaluation_plan_event_id_idx` ON `evaluation_plan` (`event_id`);--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`location` text,
	`timezone` text NOT NULL,
	`record_prefix` text DEFAULT 'SES' NOT NULL,
	`branding_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_org_id_idx` ON `event` (`org_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_slug_idx` ON `event` (`slug`);--> statement-breakpoint
CREATE TABLE `file` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`r2_key` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`content_type` text NOT NULL,
	`previous_file_id` text,
	`uploaded_by_contact_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `file_submission_id_idx` ON `file` (`submission_id`);--> statement-breakpoint
CREATE INDEX `file_previous_file_id_idx` ON `file` (`previous_file_id`);--> statement-breakpoint
CREATE TABLE `file_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`author_contact_id` text,
	`author_user_id` text,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `file_comment_file_id_idx` ON `file_comment` (`file_id`);--> statement-breakpoint
CREATE TABLE `form` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`is_default` integer DEFAULT false NOT NULL,
	`close_date` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `form_event_id_idx` ON `form` (`event_id`);--> statement-breakpoint
CREATE TABLE `form_field` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`section` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`help_text` text,
	`required` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`options_json` text,
	`rule_json` text,
	`locked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `form_field_form_id_idx` ON `form_field` (`form_id`);--> statement-breakpoint
CREATE INDEX `form_field_form_id_position_idx` ON `form_field` (`form_id`,`position`);--> statement-breakpoint
CREATE TABLE `org` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `participant` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`role` text DEFAULT 'speaker' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`invite_status` text DEFAULT 'none' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `participant_submission_id_idx` ON `participant` (`submission_id`);--> statement-breakpoint
CREATE INDEX `participant_contact_id_idx` ON `participant` (`contact_id`);--> statement-breakpoint
CREATE TABLE `plan_reviewer` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`track_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plan_reviewer_plan_id_idx` ON `plan_reviewer` (`plan_id`);--> statement-breakpoint
CREATE INDEX `plan_reviewer_user_id_idx` ON `plan_reviewer` (`user_id`);--> statement-breakpoint
CREATE TABLE `portal_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`logo_url` text,
	`accent_color` text,
	`welcome_message` text,
	`show_resources` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_settings_event_id_idx` ON `portal_settings` (`event_id`);--> statement-breakpoint
CREATE TABLE `resource` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`file_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `resource_event_id_idx` ON `resource` (`event_id`);--> statement-breakpoint
CREATE INDEX `resource_file_id_idx` ON `resource` (`file_id`);--> statement-breakpoint
CREATE TABLE `room` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`capacity` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `room_event_id_idx` ON `room` (`event_id`);--> statement-breakpoint
CREATE TABLE `schedule_slot` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`room_id` text,
	`day` text NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_slot_submission_id_idx` ON `schedule_slot` (`submission_id`);--> statement-breakpoint
CREATE INDEX `schedule_slot_room_id_idx` ON `schedule_slot` (`room_id`);--> statement-breakpoint
CREATE INDEX `schedule_slot_day_idx` ON `schedule_slot` (`day`);--> statement-breakpoint
CREATE TABLE `submission` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`form_id` text,
	`seq` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`track_id` text,
	`additional_track_ids_json` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`content_status` text DEFAULT 'pending' NOT NULL,
	`accepted_at` integer,
	`ics_sequence` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submission_event_id_idx` ON `submission` (`event_id`);--> statement-breakpoint
CREATE INDEX `submission_form_id_idx` ON `submission` (`form_id`);--> statement-breakpoint
CREATE INDEX `submission_track_id_idx` ON `submission` (`track_id`);--> statement-breakpoint
CREATE INDEX `submission_event_id_status_idx` ON `submission` (`event_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `submission_event_id_seq_idx` ON `submission` (`event_id`,`seq`);--> statement-breakpoint
CREATE TABLE `submission_answer` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`form_field_id` text NOT NULL,
	`value_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submission_answer_submission_id_idx` ON `submission_answer` (`submission_id`);--> statement-breakpoint
CREATE INDEX `submission_answer_form_field_id_idx` ON `submission_answer` (`form_field_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `submission_answer_submission_id_form_field_id_idx` ON `submission_answer` (`submission_id`,`form_field_id`);--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_date` integer,
	`required` integer DEFAULT false NOT NULL,
	`form_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_event_id_idx` ON `task` (`event_id`);--> statement-breakpoint
CREATE INDEX `task_form_id_idx` ON `task` (`form_id`);--> statement-breakpoint
CREATE TABLE `task_assignment` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` integer,
	`completed_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_assignment_task_id_idx` ON `task_assignment` (`task_id`);--> statement-breakpoint
CREATE INDEX `task_assignment_contact_id_idx` ON `task_assignment` (`contact_id`);--> statement-breakpoint
CREATE TABLE `track` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `track_event_id_idx` ON `track` (`event_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`contact_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_org_id_idx` ON `user` (`org_id`);--> statement-breakpoint
CREATE INDEX `user_contact_id_idx` ON `user` (`contact_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_idx` ON `user` (`email`);