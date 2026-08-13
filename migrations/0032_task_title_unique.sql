-- DEC-111 amendment (wave 48): task title uniqueness within an event becomes
-- a database constraint (was JS-only, enforced by a getOrCreateTask read
-- followed by an insert that a concurrent acceptance could race, minting a
-- duplicate "Confirm participation" task row). First deterministically merge
-- any pre-existing (event_id, title) collision onto the oldest row (by
-- created_at then id, the "keeper"), reassigning task_assignment rows so no
-- distinct (task, contact) pair is lost and a 'complete' status on either
-- side of the merge survives, then add the constraint. Re-runnable, like
-- migrations/0031_segment_name_unique.sql.
--
-- DEC-111 amendment (wave 54): this migration originally computed the
-- keeper set once into `CREATE TEMP TABLE _task_dedupe_keeper`. D1's SQL
-- authorizer rejects ALL temporary objects (SQLITE_AUTH) -- node:sqlite and
-- better-sqlite3 (used by test/task-title-unique.test.ts) silently accept
-- CREATE TEMP TABLE, so the migration test stayed green while this
-- migration failed on its very first statement against real D1 and was
-- never recorded in d1_migrations. That meant `task_event_id_title_idx`
-- existed in no deployed database, and every accept-a-submission call that
-- hit getOrCreateTask's onConflictDoNothing({ target: [eventId, title] })
-- once a same-titled task already existed 500'd with D1_ERROR: ON CONFLICT
-- clause does not match any PRIMARY KEY or UNIQUE constraint. Rewritten in
-- place (not renumbered -- a migration that never applied was never
-- recorded, so a new number would misstate history) to recompute the same
-- keeper set via a `WITH keeper AS (...)` CTE repeated at the head of each
-- of the four dedupe statements instead of a temp table. Semantics are
-- unchanged; test/task-title-unique.test.ts (run against node:sqlite) is
-- the proof of equivalence.

-- Step 1: for a keeper's (task, contact) pair that is not yet 'complete',
-- promote it to 'complete' when a losing duplicate task's row for the same
-- contact already is -- a merge must never regress a speaker's completed
-- status back to pending.
WITH keeper AS (
  SELECT DISTINCT t.event_id, t.title,
    (
      SELECT t2.id FROM `task` t2
      WHERE t2.event_id = t.event_id AND t2.title = t.title
      ORDER BY t2.created_at ASC, t2.id ASC
      LIMIT 1
    ) AS keeper_id
  FROM `task` t
)
UPDATE `task_assignment`
SET `status` = 'complete',
    `completed_at` = (
      SELECT loser.completed_at FROM `task_assignment` loser
      INNER JOIN `task` loser_t ON loser_t.id = loser.task_id
      INNER JOIN keeper k ON k.event_id = loser_t.event_id AND k.title = loser_t.title
      WHERE k.keeper_id = task_assignment.task_id
        AND loser.contact_id = task_assignment.contact_id
        AND loser.status = 'complete'
        AND loser.task_id <> task_assignment.task_id
      LIMIT 1
    ),
    `completed_by` = (
      SELECT loser.completed_by FROM `task_assignment` loser
      INNER JOIN `task` loser_t ON loser_t.id = loser.task_id
      INNER JOIN keeper k ON k.event_id = loser_t.event_id AND k.title = loser_t.title
      WHERE k.keeper_id = task_assignment.task_id
        AND loser.contact_id = task_assignment.contact_id
        AND loser.status = 'complete'
        AND loser.task_id <> task_assignment.task_id
      LIMIT 1
    )
WHERE task_assignment.task_id IN (SELECT keeper_id FROM keeper)
  AND task_assignment.status <> 'complete'
  AND EXISTS (
    SELECT 1 FROM `task_assignment` loser
    INNER JOIN `task` loser_t ON loser_t.id = loser.task_id
    INNER JOIN keeper k ON k.event_id = loser_t.event_id AND k.title = loser_t.title
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
WITH keeper AS (
  SELECT DISTINCT t.event_id, t.title,
    (
      SELECT t2.id FROM `task` t2
      WHERE t2.event_id = t.event_id AND t2.title = t.title
      ORDER BY t2.created_at ASC, t2.id ASC
      LIMIT 1
    ) AS keeper_id
  FROM `task` t
)
DELETE FROM `task_assignment`
WHERE task_id IN (
  SELECT t.id FROM `task` t
  INNER JOIN keeper k ON k.event_id = t.event_id AND k.title = t.title
  WHERE t.id <> k.keeper_id
)
AND EXISTS (
  SELECT 1 FROM `task_assignment` keeper_ta
  INNER JOIN `task` loser_t ON loser_t.id = task_assignment.task_id
  INNER JOIN keeper k ON k.event_id = loser_t.event_id AND k.title = loser_t.title
  WHERE keeper_ta.task_id = k.keeper_id
    AND keeper_ta.contact_id = task_assignment.contact_id
);

-- Step 3: every remaining losing-task assignment row is for a (contact) the
-- keeper does not yet cover -- re-point it onto the keeper instead of
-- dropping it, so that distinct (contact) assignment is preserved.
WITH keeper AS (
  SELECT DISTINCT t.event_id, t.title,
    (
      SELECT t2.id FROM `task` t2
      WHERE t2.event_id = t.event_id AND t2.title = t.title
      ORDER BY t2.created_at ASC, t2.id ASC
      LIMIT 1
    ) AS keeper_id
  FROM `task` t
)
UPDATE `task_assignment`
SET `task_id` = (
  SELECT k.keeper_id FROM `task` loser_t
  INNER JOIN keeper k ON k.event_id = loser_t.event_id AND k.title = loser_t.title
  WHERE loser_t.id = task_assignment.task_id
)
WHERE task_id IN (
  SELECT t.id FROM `task` t
  INNER JOIN keeper k ON k.event_id = t.event_id AND k.title = t.title
  WHERE t.id <> k.keeper_id
);

-- Step 4: every losing task row's assignments have all been merged onto the
-- keeper (step 3) or dropped as redundant duplicates (step 2) -- delete the
-- losing task rows.
WITH keeper AS (
  SELECT DISTINCT t.event_id, t.title,
    (
      SELECT t2.id FROM `task` t2
      WHERE t2.event_id = t.event_id AND t2.title = t.title
      ORDER BY t2.created_at ASC, t2.id ASC
      LIMIT 1
    ) AS keeper_id
  FROM `task` t
)
DELETE FROM `task`
WHERE id IN (
  SELECT t.id FROM `task` t
  INNER JOIN keeper k ON k.event_id = t.event_id AND k.title = t.title
  WHERE t.id <> k.keeper_id
);

CREATE UNIQUE INDEX `task_event_id_title_idx` ON `task` (`event_id`, `title`);
