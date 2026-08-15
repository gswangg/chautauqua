## task-w31-d: perf-smoke profile-resolved plan/reviewer fixtures (DEC-644 w31, DEC-645)
Tip `9119a01a`. PERF_PLAN_ID/PERF_REVIEWER_EMAIL/PERF_REVIEWER_PASSWORD now
resolve from PERF_PROFILE via perf-seed-lib's perfPlanId/perfReviewerEmail
(default byte-identical, asserted by test); deleted isDefaultProfile/
DEFAULT_ONLY_CHECK_NAMES/skippedChecks outright — every check runs on
every profile. vitest test/perf-smoke.test.ts 80/80 green; build green.
Live proof port 8897, `--profile=aie`: "rating PUT" PASS; "reviewer queue"
and "plan results (page 1)" newly FAIL at aie scale — logged findings per
DEC-347(3), owned by w31-b (src/routes/review/reviewer.ts) / w31-c
(src/routes/review/shared.ts), not this lane's scope. SOLE OWNER of both
touched files (no overlap declared). Detail:
docs/verification-log/task-w31-d-perf-profile-fixtures-9119a01a.md.

INVALIDATED BY: scripts/perf-smoke.ts, test/perf-smoke.test.ts, scripts/perf-seed-lib.ts

