-- DEC-338 (wave-31 amendment): the plan-results endpoint's evaluation read
-- (listEvaluationScoresForPlan, src/server/repo/review/evaluations.ts)
-- filters WHERE plan_id = ? AND round = ? and orders BY submission_id, id --
-- `evaluation_plan_id_idx` only covers plan_id, so round-filtering and the
-- whole ORDER BY fell to a scan + temp sort over every evaluation row for
-- the plan (up to MAX_PLAN_EVALUATION_SCAN = 50000). This composite index
-- covers both the WHERE and the ORDER BY directly off the index.
CREATE INDEX `evaluation_plan_id_round_submission_id_id_idx` ON `evaluation` (`plan_id`, `round`, `submission_id`, `id`);
