-- DEC-022 amendment (wave 63): the public agenda's missing "spanning quiet
-- rule" primitive. docs/design/README.md's Public agenda section specifies
-- a break as "a spanning quiet rule with their label in small caps ('Lunch ·
-- Foyer') — real programmes have them, and they explain gaps that would
-- otherwise read as missing data". `schedule_break` is deliberately its own
-- table, not a schedule_slot row with no submission — see src/server/repo/
-- breaks.ts's header for the full account of why a break never touches
-- submission/ref/speaker/track/ics machinery. Plain CREATE TABLE only (D1's
-- SQL authorizer rejects CREATE TEMP TABLE — see migrations/0032's wave-54
-- header).
CREATE TABLE `schedule_break` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`day` text NOT NULL,
	`label` text NOT NULL,
	`location` text,
	`start_min` integer NOT NULL,
	`duration_min` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `schedule_break_event_id_day_idx` ON `schedule_break` (`event_id`, `day`);
