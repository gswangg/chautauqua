-- DEC-612: External record identity is one namespaced external_ref column
-- per imported table, unique inside its own owner scope. Value is always
-- "<source>:<their id>" (never a bare id); nullable so hand-created rows
-- are untouched -- SQLite treats NULLs as distinct in a unique index.

ALTER TABLE `contact` ADD COLUMN `external_ref` text;
ALTER TABLE `submission` ADD COLUMN `external_ref` text;
ALTER TABLE `track` ADD COLUMN `external_ref` text;

CREATE UNIQUE INDEX `contact_org_id_external_ref_idx` ON `contact` (`org_id`, `external_ref`);
CREATE UNIQUE INDEX `submission_event_id_external_ref_idx` ON `submission` (`event_id`, `external_ref`);
CREATE UNIQUE INDEX `track_event_id_external_ref_idx` ON `track` (`event_id`, `external_ref`);
