-- DEC-556: participant and task_assignment uniqueness becomes a database
-- constraint (was JS-only, enforced by a pre-check SELECT that a concurrent
-- writer could race). First delete any pre-existing duplicates so the
-- UNIQUE INDEX creation below doesn't fail on an existing violation, then
-- add the constraint.

-- participant: keep the lowest rowid per (submission_id, contact_id).
DELETE FROM `participant`
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM `participant` GROUP BY `submission_id`, `contact_id`
);

CREATE UNIQUE INDEX `participant_submission_id_contact_id_idx` ON `participant` (`submission_id`, `contact_id`);

-- task_assignment: keep any row with status='complete' for the pair, else
-- the lowest rowid per (task_id, contact_id).
DELETE FROM `task_assignment`
WHERE rowid NOT IN (
  SELECT COALESCE(
    (
      SELECT MIN(t2.rowid) FROM `task_assignment` t2
      WHERE t2.task_id = t1.task_id AND t2.contact_id = t1.contact_id AND t2.status = 'complete'
    ),
    (
      SELECT MIN(t2.rowid) FROM `task_assignment` t2
      WHERE t2.task_id = t1.task_id AND t2.contact_id = t1.contact_id
    )
  )
  FROM `task_assignment` t1
  GROUP BY t1.task_id, t1.contact_id
);

CREATE UNIQUE INDEX `task_assignment_task_id_contact_id_idx` ON `task_assignment` (`task_id`, `contact_id`);
