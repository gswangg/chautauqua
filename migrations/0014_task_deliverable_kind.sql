-- DEC-240 (task w1-d): task.deliverable_kind lets a kind='file_request'
-- task specify which content-pipeline file kind ('presentation'|'poster'|
-- 'handout') its uploads should land as, so portal uploads join the same
-- Files library / worklist counts as submission deliverables instead of
-- always landing as 'handout' with no submission link (supersedes DEC-029).
-- Nullable; only meaningful when task.kind = 'file_request'.
ALTER TABLE `task` ADD `deliverable_kind` text;
