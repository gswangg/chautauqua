-- CNT-01: a task carries INSTRUCTIONS end to end -- a free-text brief
-- (e.g. "16:9, under 20 MB, PDF or Keynote") distinct from the existing
-- `description` column, editable in both create and edit modes and shown
-- on the speaker's own task row. Nullable, no default, no backfill.

ALTER TABLE `task` ADD COLUMN `instructions` TEXT;
