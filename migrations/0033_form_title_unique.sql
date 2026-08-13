-- DEC-111 amendment (wave 55): form title uniqueness within an event becomes
-- a database constraint. getOrCreateFormTaskForm (src/server/repo/
-- submissions/status.ts) did a plain SELECT-then-INSERT find-or-create with
-- no backing unique index (only the non-unique form_event_id_idx existed) --
-- two concurrent accepts in the same event racing to mint the same
-- template's backing form could both miss the read and both insert, and
-- getOrCreateTask's self-heal would then attach an arbitrary one of the two
-- to the task, orphaning the other form plus its FORM_TASK_FIELD_SPECS field
-- rows. This migration first deterministically merges any pre-existing
-- (event_id, title) collision onto the oldest row (by created_at then id,
-- the "keeper"), repointing every dependent (form_field, task, submission)
-- row onto the keeper so no field row or submission answer is lost, then
-- adds the constraint.
--
-- Modeled on the wave-54 rewrite of migrations/0032_task_title_unique.sql:
-- the keeper set is recomputed via a `WITH keeper AS (...)` CTE repeated at
-- the head of each dedupe statement -- NEVER a temporary table, which D1's
-- SQL authorizer rejects with SQLITE_AUTH (see test/migration-dialect.scan.
-- test.ts and migrations/0032's wave-54 header for the full account of that
-- failure mode). Re-runnable: once no (event_id, title) collision remains,
-- every UPDATE/DELETE below matches zero rows, and the final CREATE UNIQUE
-- INDEX is the only statement that would need IF NOT EXISTS on a genuine
-- second run -- as with 0031/0032, the production runner (wrangler d1
-- migrations apply) only ever applies a given migration file once, tracked
-- in d1_migrations.

-- Step 1: repoint every losing form's form_field rows onto the keeper --
-- no field row (and thus no submission answer keyed to it) is ever deleted.
WITH keeper AS (
  SELECT DISTINCT f.event_id, f.title,
    (
      SELECT f2.id FROM `form` f2
      WHERE f2.event_id = f.event_id AND f2.title = f.title
      ORDER BY f2.created_at ASC, f2.id ASC
      LIMIT 1
    ) AS keeper_id
  FROM `form` f
)
UPDATE `form_field`
SET `form_id` = (
  SELECT k.keeper_id FROM `form` loser_f
  INNER JOIN keeper k ON k.event_id = loser_f.event_id AND k.title = loser_f.title
  WHERE loser_f.id = form_field.form_id
)
WHERE form_id IN (
  SELECT f.id FROM `form` f
  INNER JOIN keeper k ON k.event_id = f.event_id AND k.title = f.title
  WHERE f.id <> k.keeper_id
);

-- Step 2: repoint every losing form's task rows (task.form_id) onto the
-- keeper -- a 'form' kind task must keep a live backing form.
WITH keeper AS (
  SELECT DISTINCT f.event_id, f.title,
    (
      SELECT f2.id FROM `form` f2
      WHERE f2.event_id = f.event_id AND f2.title = f.title
      ORDER BY f2.created_at ASC, f2.id ASC
      LIMIT 1
    ) AS keeper_id
  FROM `form` f
)
UPDATE `task`
SET `form_id` = (
  SELECT k.keeper_id FROM `form` loser_f
  INNER JOIN keeper k ON k.event_id = loser_f.event_id AND k.title = loser_f.title
  WHERE loser_f.id = task.form_id
)
WHERE form_id IN (
  SELECT f.id FROM `form` f
  INNER JOIN keeper k ON k.event_id = f.event_id AND k.title = f.title
  WHERE f.id <> k.keeper_id
);

-- Step 3: repoint every losing form's submission rows (submission.form_id)
-- onto the keeper -- a submitted answer must stay attached to a live form.
WITH keeper AS (
  SELECT DISTINCT f.event_id, f.title,
    (
      SELECT f2.id FROM `form` f2
      WHERE f2.event_id = f.event_id AND f2.title = f.title
      ORDER BY f2.created_at ASC, f2.id ASC
      LIMIT 1
    ) AS keeper_id
  FROM `form` f
)
UPDATE `submission`
SET `form_id` = (
  SELECT k.keeper_id FROM `form` loser_f
  INNER JOIN keeper k ON k.event_id = loser_f.event_id AND k.title = loser_f.title
  WHERE loser_f.id = submission.form_id
)
WHERE form_id IN (
  SELECT f.id FROM `form` f
  INNER JOIN keeper k ON k.event_id = f.event_id AND k.title = f.title
  WHERE f.id <> k.keeper_id
);

-- Step 4: every losing form's dependents have all been repointed onto the
-- keeper (steps 1-3) -- delete the losing form rows.
WITH keeper AS (
  SELECT DISTINCT f.event_id, f.title,
    (
      SELECT f2.id FROM `form` f2
      WHERE f2.event_id = f.event_id AND f2.title = f.title
      ORDER BY f2.created_at ASC, f2.id ASC
      LIMIT 1
    ) AS keeper_id
  FROM `form` f
)
DELETE FROM `form`
WHERE id IN (
  SELECT f.id FROM `form` f
  INNER JOIN keeper k ON k.event_id = f.event_id AND k.title = f.title
  WHERE f.id <> k.keeper_id
);

CREATE UNIQUE INDEX `form_event_id_title_idx` ON `form` (`event_id`, `title`);
