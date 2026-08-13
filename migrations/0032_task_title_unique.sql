-- DEC-111 amendment (wave 48): task title uniqueness within an event becomes
-- a database constraint (was JS-only, enforced by a getOrCreateTask read
-- followed by an insert that a concurrent acceptance could race, minting a
-- duplicate "Confirm participation" task row). First deterministically merge
-- any pre-existing (event_id, title) collision onto the oldest row (by
-- created_at then id, the "keeper"), reassigning task_assignment rows so no
-- distinct (task, contact) pair is lost and a 'complete' status on either
-- side of the merge survives, then add the constraint. Re-runnable, like
-- migrations/0031_segment_name_unique.sql.

CREATE TEMP TABLE `_task_dedupe_keeper` AS
SELECT DISTINCT t.event_id, t.title,
  (
    SELECT t2.id FROM `task` t2
    WHERE t2.event_id = t.event_id AND t2.title = t.title
    ORDER BY t2.created_at ASC, t2.id ASC
    LIMIT 1
  ) AS keeper_id
FROM `task` t;

-- Step 1: for a keeper's (task, contact) pair that is not yet 'complete',
-- promote it to 'complete' when a losing duplicate task's row for the same
-- contact already is -- a merge must never regress a speaker's completed
-- status back to pending.
UPDATE `task_assignment`
SET `status` = 'complete',
    `completed_at` = (
      SELECT loser.completed_at FROM `task_assignment` loser
      INNER JOIN `task` loser_t ON loser_t.id = loser.task_id
      INNER JOIN `_task_dedupe_keeper` k ON k.event_id = loser_t.event_id AND k.title = loser_t.title
      WHERE k.keeper_id = task_assignment.task_id
        AND loser.contact_id = task_assignment.contact_id
        AND loser.status = 'complete'
        AND loser.task_id <> task_assignment.task_id
      LIMIT 1
    ),
    `completed_by` = (
      SELECT loser.completed_by FROM `task_assignment` loser
      INNER JOIN `task` loser_t ON loser_t.id = loser.task_id
      INNER JOIN `_task_dedupe_keeper` k ON k.event_id = loser_t.event_id AND k.title = loser_t.title
      WHERE k.keeper_id = task_assignment.task_id
        AND loser.contact_id = task_assignment.contact_id
        AND loser.status = 'complete'
        AND loser.task_id <> task_assignment.task_id
      LIMIT 1
    )
WHERE task_assignment.task_id IN (SELECT keeper_id FROM `_task_dedupe_keeper`)
  AND task_assignment.status <> 'complete'
  AND EXISTS (
    SELECT 1 FROM `task_assignment` loser
    INNER JOIN `task` loser_t ON loser_t.id = loser.task_id
    INNER JOIN `_task_dedupe_keeper` k ON k.event_id = loser_t.event_id AND k.title = loser_t.title
    WHERE k.keeper_id = task_assignment.task_id
      AND loser.contact_id = task_assignment.contact_id
      AND loser.status = 'complete'
      AND loser.task_id <> task_assignment.task_id
  );

-- Step 2: a losing duplicate task's assignment row for a (contact) already
-- covered by the keeper (task_assignment_task_id_contact_id_idx is UNIQUE,
-- so the keeper can only ever hold one row per contact) is now redundant --
-- its 'complete' status, if any, was already merged onto the keeper above --
-- delete it.
DELETE FROM `task_assignment`
WHERE task_id IN (
  SELECT t.id FROM `task` t
  INNER JOIN `_task_dedupe_keeper` k ON k.event_id = t.event_id AND k.title = t.title
  WHERE t.id <> k.keeper_id
)
AND EXISTS (
  SELECT 1 FROM `task_assignment` keeper
  INNER JOIN `task` loser_t ON loser_t.id = task_assignment.task_id
  INNER JOIN `_task_dedupe_keeper` k ON k.event_id = loser_t.event_id AND k.title = loser_t.title
  WHERE keeper.task_id = k.keeper_id
    AND keeper.contact_id = task_assignment.contact_id
);

-- Step 3: every remaining losing-task assignment row is for a (contact) the
-- keeper does not yet cover -- re-point it onto the keeper instead of
-- dropping it, so that distinct (contact) assignment is preserved.
UPDATE `task_assignment`
SET `task_id` = (
  SELECT k.keeper_id FROM `task` loser_t
  INNER JOIN `_task_dedupe_keeper` k ON k.event_id = loser_t.event_id AND k.title = loser_t.title
  WHERE loser_t.id = task_assignment.task_id
)
WHERE task_id IN (
  SELECT t.id FROM `task` t
  INNER JOIN `_task_dedupe_keeper` k ON k.event_id = t.event_id AND k.title = t.title
  WHERE t.id <> k.keeper_id
);

-- Step 4: every losing task row's assignments have all been merged onto the
-- keeper (step 3) or dropped as redundant duplicates (step 2) -- delete the
-- losing task rows.
DELETE FROM `task`
WHERE id IN (
  SELECT t.id FROM `task` t
  INNER JOIN `_task_dedupe_keeper` k ON k.event_id = t.event_id AND k.title = t.title
  WHERE t.id <> k.keeper_id
);

DROP TABLE `_task_dedupe_keeper`;

CREATE UNIQUE INDEX `task_event_id_title_idx` ON `task` (`event_id`, `title`);
