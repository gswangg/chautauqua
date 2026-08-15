## 2026-08-12 task-w20-f — list-envelope enumeration, stage 1 (DEC-459/466)

Full detail: `docs/verification-log/task-w20-f-list-envelope-enumeration-stage1.md`.

Log-only lane (DEC-452/453). Mechanically re-derives every `c.json({ items` list-envelope site
under `src/routes/**` (re-runnable `rg` command in the linked file) rather than inheriting
`task-w17-f`'s 20-row list, which DEC-466 found was short by three. Population: 29 mechanical
hits + 2 more (`src/routes/files.ts:166`, `:309`) added because DEC-471 — landed on `main` as a
decision doc but **not** as source at the audited sha — binds this task to reclassify them as
real DEC-013 gaps rather than the "not applicable" this task's own dispatch text originally asked
for. Every row classified BOUNDED-IN-SQL / BOUNDED-IN-JS / CAPPED-ECHO / UNBOUNDED (DEC-473's four
classes) with zero gaps; every BOUNDED-* row live-probed at 2k perf-seed scale (organizer and
reviewer sessions, `?perPage=100000`/`abc`, `?page=1e308`) and confirmed to correctly clamp
`perPage`/report true `total`. Sibling wave-20 lanes DEC-465/466/467 all confirmed landed via
`git merge-base --is-ancestor` against the audited sha; DEC-471 confirmed NOT landed, no owning
branch found, reported PENDING-OWNED per DEC-438/472.

Two findings beyond this task's original scope, both live-reproduced, neither fixed here: (1) two
genuinely unbounded list reads, `GET /api/v1/submissions/:id/files` and `GET
/api/v1/files/:fileId/comments`, per DEC-471; (2) every BOUNDED-IN-SQL row returns HTTP 500
(`SQLITE_MISMATCH`) instead of 400 on `?page=1e308` — `clampPage` treats `Number("1e308")` as a
valid finite integer and the resulting huge offset overflows D1's bind — while every BOUNDED-IN-JS
row degrades gracefully (empty slice, correct `total`, no crash).

This task's own worktree was destroyed mid-task by the same recurring out-of-band-wipe hazard
`task-w17-f` documented, and by the time it was recreated `main` had advanced two full waves past
this task's original dispatch point (`f310111` -> `bf56ba7`, "scribe wave 21" already merged).
Wave 21 as it actually ran does not cite `SPEC.md:353` anywhere in its four merged lanes, meaning
this deliverable's originally-stated consumer already closed without it — flagged as a process
risk in the linked file, not a product finding.

OPEN ITEMS: 4 (2 UNBOUNDED list-envelope sites per DEC-471, PENDING-OWNED no branch; 1
live-reproduced `page=1e308` -> HTTP 500 defect across every BOUNDED-IN-SQL row, unowned; 1
process/orphaning risk — wave 21 already closed without citing this file)

RESULT: PASS — the enumeration is population-complete, mechanically re-derivable, every row
classified with zero gaps, and every BOUNDED-* row live-confirmed at 2k scale. Open items are
findings the enumeration surfaced, not defects in the enumeration itself.

