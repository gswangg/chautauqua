-- DEC-338 (wave-31 amendment)/DEC-347 (wave-31 amendment, migration number
-- 0041 reserved to task-w31-b): the reviewer queue's four plan-scoped reads
-- (countEvaluationsBySubmission, listSubmissionIdsRatedBy,
-- listEvaluationScoresForReviewer, src/server/repo/review/evaluations.ts)
-- filter WHERE (plan_id, round) and, for the two ordered scans elsewhere in
-- this file, ORDER BY (submission_id, id) -- evaluation_plan_id_idx
-- (migrations, plan_id alone) does not cover the round predicate or the
-- submission_id/id ordering, so each of those reads still scans every round
-- of the plan. A composite index over exactly the filtered+ordered columns
-- lets the planner drive the scan from the index instead of a plan_id-only
-- lookup followed by a row-by-row round filter.

CREATE INDEX `evaluation_plan_round_submission_idx` ON `evaluation` (`plan_id`, `round`, `submission_id`, `id`);
