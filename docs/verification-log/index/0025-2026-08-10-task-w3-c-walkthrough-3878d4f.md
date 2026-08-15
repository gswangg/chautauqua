## 2026-08-10 task-w3-c — walkthrough @ 3878d4f

Full detail: docs/verification-log/task-w3-c-walkthrough.md

DEC-069 J1-J12 walkthrough gate (DEC-077 log-only lane; NO code/product/
test/script/config changes made — this run is grep/log-only per the
code freeze). Newest code-bearing main short-sha per DEC-091: `3878d4f`
("merge task-w2-d"). Areas ran in required order producer -> review ->
speaker -> public -> data -> scale: producer/review/speaker/public/data
all PASS; scale FAILED at step 6 (DEC-086/089 purge-refresh probe) —
the speaker portal-edit POST (`/portal/submissions/:id/edit`) returned
HTTP 400 instead of the expected 302 redirect. Steps 1-5 of scale all
PASS.

OPEN ITEMS: step6 of the walkthrough "scale" area (DEC-086/089
purge-refresh probe) fails with 400 on the speaker portal-edit POST at
`3878d4f`. Per DEC-077 this lane made no code changes to investigate or
fix the 400's root cause; a follow-up task should reproduce
`scripts/walkthrough/scale.ts`'s step 6 in isolation against a running
dev server to get the JSON/HTML error detail and determine whether the
defect is in the walkthrough script's form-field construction or in the
`/portal/submissions/:id/edit` handler itself.

RESULT: FAIL — walkthrough scale area step6 (DEC-083 purge-refresh
probe via speaker portal-edit) returns 400 instead of 302 at `3878d4f`;
producer/review/speaker/public/data areas and scale steps 1-5 all PASS.

