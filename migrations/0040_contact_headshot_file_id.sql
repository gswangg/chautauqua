-- DEC-773 amendment (w29-b): the files library's headshot count/list queries
-- joined `contact.headshot_url = '/headshots/' || file.id` -- a
-- string-concatenation predicate no index can serve, measured as the
-- dominant cost (~460ms of the library's ~500ms page-1 read) at perf-seed
-- scale. `contact` gets a direct headshot_file_id FK, backfilled here from
-- the existing '/headshots/<fileId>' url pattern, indexed for the
-- equality join. headshot_url itself is untouched -- it stays the served
-- path (profile.ts's getHeadshotServeScope keeps its own reverse
-- headshot_url lookup, unchanged).

ALTER TABLE `contact` ADD `headshot_file_id` text;

CREATE INDEX `contact_headshot_file_id_idx` ON `contact` (`headshot_file_id`);

UPDATE `contact`
SET `headshot_file_id` = substr(`headshot_url`, length('/headshots/') + 1)
WHERE `headshot_url` LIKE '/headshots/%';
