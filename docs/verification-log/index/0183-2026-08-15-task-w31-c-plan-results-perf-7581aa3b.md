## QUALIFYING (task-w31-c)

Plan results (DEC-338/DEC-347 wave-31 amendments), tip `7581aa3b`: collapsed
buildResults' (src/routes/review/shared.ts) 5-deep sequential waterfall
into two Promise.all waves + added migrations/0042_review_results_indexes.sql
(evaluation plan_id/round/submission_id/id composite, EXPLAIN QUERY PLAN
confirms selection). Full receipt: docs/verification-log/task-w31-c-plan-
results-perf-7581aa3b.md. BEFORE (main 87c545f6) adjusted p95 68.7ms; AFTER
two runs 89.5ms/72.7ms -- inconclusive under acknowledged concurrent
sibling-lane wrangler-dev load (task-w29-b :8892, main checkout :8799,
unrelated sandbox :8878, all live during measurement). Mechanism verified
independently: EXPLAIN QUERY PLAN + a concurrency unit test (max in-flight
>1). Declared overlap with lanes a/b/d at this file's tail per instructions.

INVALIDATED BY: src/routes/review/shared.ts, src/db/schema/review.ts, migrations/0042_review_results_indexes.sql

MERGE NOTE (merge train, `merge task-w31-c`): migration 0042's
`evaluation_plan_id_round_submission_id_id_idx` is column-for-column
IDENTICAL to migration 0041's `evaluation_plan_round_submission_idx`
(task-w31-b) — both are `evaluation (plan_id, round, submission_id, id)`,
differing only in name. DEC-347's wave-31 amendment pre-assigned the
migration NUMBERS (0041 reviewer-queue, 0042 plan-results) to avoid a
filename collision, but did not anticipate that both lanes would need the
same composite index; the two lanes independently diagnosed the same missing
index from two different endpoints. Both were kept at merge (each is a
sanctioned, receipted migration and both apply cleanly — SQLite permits
duplicate-column indexes under distinct names), so this is correct but
redundant: two identical b-trees maintained on every evaluation write. NOT
resolved here, because dropping one is a design call about which name
survives and would invalidate a landed lane's receipt. FLAGGED for a
follow-up lane to collapse to one index.

