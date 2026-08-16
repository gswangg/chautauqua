-- DEC-818 amendment (wave-47): insertFile (src/server/repo/files-versions.ts)
-- computed versionNo = pred.versionNo + 1 in JS off a read-then-write SELECT
-- with no transaction, and the only index on file.previous_file_id was a
-- plain (non-unique) btree — two concurrent re-uploads onto the same chain
-- head could both mint version N. The chain invariant is "at most one row
-- may name a given predecessor"; encode that directly instead of trying to
-- serialize the numbering. Partial so multiple chain roots
-- (previous_file_id IS NULL) don't collide with each other.
DROP INDEX `file_previous_file_id_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `file_previous_file_id_unique` ON `file` (`previous_file_id`) WHERE `previous_file_id` IS NOT NULL;
