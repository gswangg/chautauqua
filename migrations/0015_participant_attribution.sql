-- DEC-258 (task w3-f): participant.title_at_time/org_at_time snapshot the
-- contact's title/company as of participant creation. Public/exports/
-- showflow/.ics render this frozen snapshot ONLY (no fallback); CRM/portal
-- continue to read the live contact. Backfill existing rows from the
-- contact's current title/company so seeded and in-flight data renders
-- exactly as it does today.
ALTER TABLE `participant` ADD `title_at_time` text;
ALTER TABLE `participant` ADD `org_at_time` text;

UPDATE `participant`
SET
  `title_at_time` = (SELECT `title` FROM `contact` WHERE `contact`.`id` = `participant`.`contact_id`),
  `org_at_time` = (SELECT `company` FROM `contact` WHERE `contact`.`id` = `participant`.`contact_id`);
