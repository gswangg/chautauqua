## 2026-08-10 task-w11-d — perf-smoke @ 3b7ed3d

Full detail: docs/verification-log/task-w11-d-perf-smoke.md

DEC-069 perf-smoke gate, log-only lane (DEC-077): no product/test/
script/config changes made in this task; the run below surfaced a real
defect, recorded as `RESULT: FAIL` per this lane's own rule rather than
fixed in-place.

OPEN ITEMS: 1 — `scripts/perf-seed.ts`'s `criteria_json` literal (line
~269) is missing the `kind: "rating"` field required by
`src/domain/evaluation.ts`'s `EvaluationCriterionDef` (`RatingCriterionDef
| DropdownCriterionDef` union), causing every `rating PUT` perf-smoke
check to fail 400 with "criterion \"overall\" has no options defined".
The w7-c/w8-b `overview.ts` OPEN ITEM is CLOSED (see above); this is a
new, distinct OPEN ITEM. A future code-bearing wave must add `kind:
"rating"` to the seeded criterion and re-run perf-smoke to close the
DEC-069 predicate.

RESULT: FAIL — perf-smoke gate scope is not green at the newest
code-bearing sha `3b7ed3d` (`event overview`/DEC-104 chunking now
confirmed fixed, closing the w7-c/w8-b OPEN ITEM; a new, distinct
`scripts/perf-seed.ts` criteria-schema defect blocks the `rating PUT`
check and all subsequent timed checks from running).

