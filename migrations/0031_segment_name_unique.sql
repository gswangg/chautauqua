-- DEC-809 amendment (wave 38): segment name uniqueness becomes a database
-- constraint (was JS-only, enforced by a findSegmentByNameForOrg read
-- followed by an insert-or-patch that a concurrent writer could race).
-- First deterministically de-collide any pre-existing (org_id, name)
-- collisions, keeping the oldest row's name and suffixing every other row
-- in the group with its rank (ordered by created_at then id so the result
-- is stable and this migration is re-runnable), then add the constraint.

UPDATE `segment`
SET `name` = `name` || ' (' || (
  SELECT COUNT(*)
  FROM `segment` s2
  WHERE s2.org_id = segment.org_id
    AND s2.name = segment.name
    AND (s2.created_at < segment.created_at OR (s2.created_at = segment.created_at AND s2.id < segment.id))
) || ')'
WHERE (
  SELECT COUNT(*)
  FROM `segment` s2
  WHERE s2.org_id = segment.org_id
    AND s2.name = segment.name
    AND (s2.created_at < segment.created_at OR (s2.created_at = segment.created_at AND s2.id < segment.id))
) > 0;

CREATE UNIQUE INDEX `segment_org_id_name_idx` ON `segment` (`org_id`, `name`);
