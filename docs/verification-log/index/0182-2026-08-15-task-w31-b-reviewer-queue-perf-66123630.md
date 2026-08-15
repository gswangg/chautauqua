## 2026-08-15 task-w31-b — reviewer queue TIER-0 perf (DEC-338/DEC-347 wave-31 amendments) @ 66123630

Full receipt: docs/verification-log/task-w31-b-reviewer-queue-perf-66123630.md.
Boundary `66123630` off `main` `87c545f6`. Collapsed the queue's 11
sequential D1 reads into 2 dependency-ordered `Promise.all` waves
(DEC-338); added migrations/0041_evaluation_plan_round_submission_idx.sql
(number pre-assigned by DEC-347). Envelope/order/numbers pinned unchanged;
concurrency proven behaviourally (instrumented fake Db, max in-flight >
1), never a grep. One-session before/after: adjusted p95 78.0ms -> 56.3ms
(28% reduction, still over the 50ms budget at this noisy-machine
measurement) — DELTA is this lane's grade per DEC-347. DECLARED OVERLAP
with lanes a/c/d and w31-c (src/db/schema/review.ts, additive index only).

INVALIDATED BY: src/routes/review/reviewer.ts, src/server/repo/review/**, migrations/**

