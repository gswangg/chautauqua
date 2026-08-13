-- DEC-267 follow-up for DEC-904: saved_view.created_by_user_id (added by
-- 0028_saved_view_share.sql) is an FK-shaped column, and DEC-904's
-- listSavedViews predicate (`shared = 1 OR created_by_user_id = <viewer>`)
-- reads it on every list. Every *_id column must be the first column of some
-- index; 0028 is committed history and append-only (DEC-015), so the index
-- lands here. Name matches src/db/schema/org-admin.ts exactly.
CREATE INDEX IF NOT EXISTS `saved_view_created_by_user_id_idx` ON `saved_view`(`created_by_user_id`);
