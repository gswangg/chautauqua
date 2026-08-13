-- DEC-818: a version number is an identity, not a position among the
-- survivors -- deleting a middle file version must not renumber every later
-- version (including in the audit note the delete just wrote). `file` gets
-- its own stored version_no, backfilled here from today's positional order
-- along each previous_file_id chain (root = 1, each successor = predecessor
-- + 1). This backfill is correct for every chain that has not (yet) lost a
-- link -- from this migration forward, version_no is set at INSERT time and
-- never recomputed from chain position again.

ALTER TABLE `file` ADD `version_no` integer;

-- Recursive CTE: start at every chain root (previous_file_id IS NULL) at
-- depth 1, then walk forward via previous_file_id to assign depth+1 to each
-- successor. `file`'s own previous_file_id never cycles in practice (see
-- listFileChainIds' cycle guard), so this terminates.
WITH RECURSIVE chain(id, depth) AS (
  SELECT `id`, 1 FROM `file` WHERE `previous_file_id` IS NULL
  UNION ALL
  SELECT `f`.`id`, `chain`.`depth` + 1
  FROM `file` `f`
  JOIN `chain` ON `f`.`previous_file_id` = `chain`.`id`
)
UPDATE `file`
SET `version_no` = (SELECT `chain`.`depth` FROM `chain` WHERE `chain`.`id` = `file`.`id`)
WHERE `id` IN (SELECT `id` FROM `chain`);
