-- Multi-portal (docs/design/multi-portal): rule-based portals matched per
-- participation, a shared item library, sponsor companies with tiered
-- entitlements, sponsor-designed sessions, event-level roles, and an
-- append-only audit log.

-- Portals ------------------------------------------------------------------

CREATE TABLE `portal` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL,
  `name` text NOT NULL,
  `note` text,
  `rule_json` text NOT NULL,
  `field_permissions_json` text NOT NULL DEFAULT '{}',
  `capabilities_json` text NOT NULL DEFAULT '{}',
  `notify_on_join` integer NOT NULL DEFAULT 1,
  `template` text,
  `position` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE INDEX `portal_event_id_idx` ON `portal` (`event_id`);

CREATE TABLE `portal_item` (
  `id` text PRIMARY KEY NOT NULL,
  `portal_id` text NOT NULL,
  `task_id` text,
  `resource_id` text,
  `system_kind` text,
  `display_name` text,
  `deadline_kind` text NOT NULL DEFAULT 'none',
  `due_date` integer,
  `relative_days` integer,
  `required` integer NOT NULL DEFAULT 0,
  `grace_days` integer NOT NULL DEFAULT 0,
  `allow_edit_after_submit` integer NOT NULL DEFAULT 0,
  `view_only_when_done` integer NOT NULL DEFAULT 0,
  `position` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE INDEX `portal_item_portal_id_idx` ON `portal_item` (`portal_id`);
CREATE INDEX `portal_item_task_id_idx` ON `portal_item` (`task_id`);
CREATE INDEX `portal_item_resource_id_idx` ON `portal_item` (`resource_id`);

CREATE TABLE `portal_membership` (
  `id` text PRIMARY KEY NOT NULL,
  `portal_id` text NOT NULL,
  `event_id` text NOT NULL,
  `participation_key` text NOT NULL,
  `contact_id` text NOT NULL,
  `joined_at` integer NOT NULL,
  `activated_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `portal_membership_portal_id_participation_key_idx` ON `portal_membership` (`portal_id`, `participation_key`);
CREATE INDEX `portal_membership_event_id_idx` ON `portal_membership` (`event_id`);
CREATE INDEX `portal_membership_contact_id_idx` ON `portal_membership` (`contact_id`);

CREATE TABLE `portal_notification` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL,
  `contact_id` text NOT NULL,
  `task_ids_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `sent_at` integer
);
CREATE INDEX `portal_notification_event_id_sent_at_idx` ON `portal_notification` (`event_id`, `sent_at`);

CREATE TABLE `event_role` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL,
  `contact_id` text NOT NULL,
  `role` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `event_role_event_id_contact_id_role_idx` ON `event_role` (`event_id`, `contact_id`, `role`);
CREATE INDEX `event_role_contact_id_idx` ON `event_role` (`contact_id`);

-- Sponsors -----------------------------------------------------------------

CREATE TABLE `sponsor_company` (
  `id` text PRIMARY KEY NOT NULL,
  `org_id` text NOT NULL,
  `name` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE INDEX `sponsor_company_org_id_idx` ON `sponsor_company` (`org_id`);

CREATE TABLE `sponsor_tier` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL,
  `name` text NOT NULL,
  `position` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE INDEX `sponsor_tier_event_id_idx` ON `sponsor_tier` (`event_id`);

CREATE TABLE `sponsorship` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL,
  `company_id` text NOT NULL,
  `tier_id` text,
  `status` text NOT NULL DEFAULT 'active',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `sponsorship_event_id_company_id_idx` ON `sponsorship` (`event_id`, `company_id`);
CREATE INDEX `sponsorship_tier_id_idx` ON `sponsorship` (`tier_id`);

-- A tier row (tier_id set) is in every sponsor of that tier; a sponsorship
-- row (sponsorship_id set) is a per-sponsor extra.
CREATE TABLE `sponsor_entitlement` (
  `id` text PRIMARY KEY NOT NULL,
  `tier_id` text,
  `sponsorship_id` text,
  `count` integer NOT NULL DEFAULT 1,
  `format` text NOT NULL,
  `minutes` integer,
  `position` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE INDEX `sponsor_entitlement_tier_id_idx` ON `sponsor_entitlement` (`tier_id`);
CREATE INDEX `sponsor_entitlement_sponsorship_id_idx` ON `sponsor_entitlement` (`sponsorship_id`);

CREATE TABLE `sponsor_contact` (
  `id` text PRIMARY KEY NOT NULL,
  `sponsorship_id` text NOT NULL,
  `event_id` text NOT NULL,
  `contact_id` text NOT NULL,
  `status` text NOT NULL DEFAULT 'joined',
  `is_primary` integer NOT NULL DEFAULT 0,
  `invited_by_contact_id` text,
  `invited_at` integer,
  `joined_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `sponsor_contact_sponsorship_id_contact_id_idx` ON `sponsor_contact` (`sponsorship_id`, `contact_id`);
CREATE INDEX `sponsor_contact_contact_id_idx` ON `sponsor_contact` (`contact_id`);
CREATE INDEX `sponsor_contact_event_id_idx` ON `sponsor_contact` (`event_id`);

CREATE TABLE `sponsor_session` (
  `id` text PRIMARY KEY NOT NULL,
  `sponsorship_id` text NOT NULL,
  `event_id` text NOT NULL,
  `entitlement_id` text NOT NULL,
  `title` text NOT NULL DEFAULT '',
  `abstract` text,
  `status` text NOT NULL DEFAULT 'draft',
  `last_note` text,
  `last_note_at` integer,
  `last_note_by` text,
  `decline_reason` text,
  `submission_id` text,
  `created_by_contact_id` text,
  `submitted_at` integer,
  `submit_count` integer NOT NULL DEFAULT 0,
  `decided_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE INDEX `sponsor_session_sponsorship_id_idx` ON `sponsor_session` (`sponsorship_id`);
CREATE INDEX `sponsor_session_event_id_status_idx` ON `sponsor_session` (`event_id`, `status`);

CREATE TABLE `sponsor_session_speaker` (
  `id` text PRIMARY KEY NOT NULL,
  `sponsor_session_id` text NOT NULL,
  `contact_id` text NOT NULL,
  `position` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `sponsor_session_speaker_session_id_contact_id_idx` ON `sponsor_session_speaker` (`sponsor_session_id`, `contact_id`);
CREATE INDEX `sponsor_session_speaker_contact_id_idx` ON `sponsor_session_speaker` (`contact_id`);

-- Audit --------------------------------------------------------------------

CREATE TABLE `audit_event` (
  `id` text PRIMARY KEY NOT NULL,
  `org_id` text NOT NULL,
  `event_id` text,
  `actor_user_id` text,
  `actor_contact_id` text,
  `actor_label` text NOT NULL,
  `action` text NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text NOT NULL,
  `subject_contact_id` text,
  `details_json` text,
  `created_at` integer NOT NULL
);
CREATE INDEX `audit_event_event_id_created_at_idx` ON `audit_event` (`event_id`, `created_at`);
CREATE INDEX `audit_event_target_id_target_type_idx` ON `audit_event` (`target_id`, `target_type`);
CREATE INDEX `audit_event_org_id_created_at_idx` ON `audit_event` (`org_id`, `created_at`);
CREATE INDEX `audit_event_actor_user_id_idx` ON `audit_event` (`actor_user_id`);
CREATE INDEX `audit_event_actor_contact_id_idx` ON `audit_event` (`actor_contact_id`);
CREATE INDEX `audit_event_subject_contact_id_idx` ON `audit_event` (`subject_contact_id`);

CREATE INDEX `portal_notification_contact_id_idx` ON `portal_notification` (`contact_id`);
CREATE INDEX `sponsorship_company_id_idx` ON `sponsorship` (`company_id`);
CREATE INDEX `sponsor_contact_invited_by_contact_id_idx` ON `sponsor_contact` (`invited_by_contact_id`);
CREATE INDEX `sponsor_session_entitlement_id_idx` ON `sponsor_session` (`entitlement_id`);
CREATE INDEX `sponsor_session_submission_id_idx` ON `sponsor_session` (`submission_id`);
CREATE INDEX `sponsor_session_created_by_contact_id_idx` ON `sponsor_session` (`created_by_contact_id`);

-- Existing tables ------------------------------------------------------------

-- Library items: who an item is about, and file-request limits.
ALTER TABLE `task` ADD COLUMN `scope` text NOT NULL DEFAULT 'person';
ALTER TABLE `task` ADD COLUMN `accepted_types_json` text;
ALTER TABLE `task` ADD COLUMN `max_size_mb` integer;
ALTER TABLE `task` ADD COLUMN `max_files` integer;

-- Assignments: one per (task, person, scope). scope_key is '' for items
-- about the person, or the participation key for items about a session or
-- sponsor company. Rows that predate portals are 'direct'.
ALTER TABLE `task_assignment` ADD COLUMN `scope_key` text NOT NULL DEFAULT '';
ALTER TABLE `task_assignment` ADD COLUMN `source` text NOT NULL DEFAULT 'direct';
ALTER TABLE `task_assignment` ADD COLUMN `detached_at` integer;
ALTER TABLE `task_assignment` ADD COLUMN `due_date` integer;
ALTER TABLE `task_assignment` ADD COLUMN `required` integer;
ALTER TABLE `task_assignment` ADD COLUMN `reopened_until` integer;
DROP INDEX `task_assignment_task_id_contact_id_idx`;
CREATE UNIQUE INDEX `task_assignment_task_id_contact_id_scope_key_idx` ON `task_assignment` (`task_id`, `contact_id`, `scope_key`);

-- How a session arrived: 'cfp' | 'organizer' | 'sponsor' | 'import'.
ALTER TABLE `submission` ADD COLUMN `origin` text NOT NULL DEFAULT 'cfp';
-- backfill: imported sessions carry an external ref; the rest without a CFP
-- form were created by organizers
UPDATE `submission` SET `origin` = 'import' WHERE `external_ref` IS NOT NULL;
UPDATE `submission` SET `origin` = 'organizer' WHERE `form_id` IS NULL AND `external_ref` IS NULL;

-- 'everyone' keeps today's event-wide visibility; 'portal' shows a
-- resource only to participations whose portals include it.
ALTER TABLE `resource` ADD COLUMN `visibility` text NOT NULL DEFAULT 'everyone';

-- Invitations to speak: the organizer's message, the reply-by date, who
-- sent it, and the invitee's optional note when declining.
ALTER TABLE `participant` ADD COLUMN `invitation_message` text;
ALTER TABLE `participant` ADD COLUMN `reply_by` integer;
ALTER TABLE `participant` ADD COLUMN `invited_by_user_id` text;
ALTER TABLE `participant` ADD COLUMN `decline_note` text;
ALTER TABLE `participant` ADD COLUMN `invitation_token_hash` text;
CREATE INDEX `participant_invitation_token_hash_idx` ON `participant` (`invitation_token_hash`);
CREATE INDEX `participant_invited_by_user_id_idx` ON `participant` (`invited_by_user_id`);

-- Every event starts with one portal, Profile basics. It covers accepted
-- sessions and active sponsorships, keeps today's field permissions (the
-- profile fields editable, nothing else asked) and today's abilities (edit the submission,
-- add co-presenters), and holds no items, so nobody's portal changes.
INSERT INTO `portal` (`id`, `event_id`, `name`, `note`, `rule_json`, `field_permissions_json`, `capabilities_json`, `notify_on_join`, `template`, `position`, `created_at`, `updated_at`)
SELECT
  lower(hex(randomblob(10))),
  `event`.`id`,
  'Profile basics',
  NULL,
  '{"groups":[{"conditions":[{"field":"session_status","op":"is","values":["accepted"]}]},{"conditions":[{"field":"kind","op":"is","values":["company"]},{"field":"sponsorship_status","op":"is","values":["active"]}]}]}',
  '{}',
  '{"editSubmission":true,"addCoPresenters":true}',
  1,
  'profile_basics',
  0,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `event`;
