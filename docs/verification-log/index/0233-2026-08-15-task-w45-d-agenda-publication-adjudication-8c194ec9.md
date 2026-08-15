## 2026-08-15 task-w45-d — agenda-publication adjudication @ 8c194ec9

QUALIFYING (advisory to the DEC-069 predicate — this scope classifies to none of the five slots)

INVALIDATED BY: src/** app/src/** migrations/** package.json

DEC-644 three-sha boundary (STEP 0 receipt, captured before any reads):
HEAD `8c194ec91ede63942022550bbced9bf3ba00f1b5`; newest first-parent
product-code-bearing sha `14da2921a5be66408057712be877bc44c19de6c4`; every
live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w44-a`,
`task-w44-b`, `task-w44-c`, `task-w44-d`, `task-w44-f`, `task-w44-g`,
`task-w45-a`, `task-w45-b`, `task-w45-c`, `task-w45-d`, `task-w68-d`,
`task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via
`git merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via
`git merge-base --is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`,
`task-w44-e`, `task-w44-i`, `task-w68-b`, `task-w68-c`, `task-w68-e`,
`task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`, `task-w72-d`,
`task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`,
`task-w72-j`.

| # | Claim | Verdict | Cite |
|---|---|---|---|
| 1 | J9 fail-loud invariant (`auto-schedule.ts:193-198`) reachability under concurrent-write race | CONFIRMED-DEFECT | `auto-schedule.ts:54,64-68,89,107,119-125,143-148,158,177-198`; `payload.ts:59-87`; `schedule.ts:406-416`; `slots.ts:45-79`; `routes/agenda.ts:93` |
| 2 | .ics stable UID + same-UID-across-producers + monotonic SEQUENCE (SPEC.md:162-169) | CONFIRMED, no defect | `mail/ics.ts:115-117`; `comms/send.ts:208-209`; `public/feeds.ts:190-201`; `public/index.tsx:390,416`; `server/repo/ics-sequence.ts:15-25,33-47,59-74` |
| 3 | cancellation (`STATUS:CANCELLED`/`METHOD:CANCEL`) on unschedule/un-approve | DELIBERATE-BY-DESIGN | `public/index.tsx:365-398,409-420,374-377`; DEC-022; SPEC.md:174-175 |

Full detail: `docs/verification-log/task-w45-d-agenda-publication-adjudication-8c194ec9.md`.

Targeted tests (DEC-644 w45): 13 files (the 9 named in the task plus
`agenda-unplaced-accounting.test.ts`, `auto-schedule-persistence.test.ts`,
`auto-schedule-breaks.test.ts`, `agenda-auto-schedule-params.test.ts`) —
`Test Files 13 passed (13)` / `Tests 153 passed (153)`. None exercises the
claim-1 race; the gap is untested, not merely under-tested.

Claim 1 is a NEW race-condition-shaped gap in code that already fixes the
prior wave-42/43 `autoSchedule320` defect (0213/0215) — `auto-schedule.ts`
now DOES split `slotted` by `isDayWithinEventRange` (:64-68) exactly as
0213 prescribed; this is not a re-file of that old defect. Suggested
wave-46 owner for claim 1: `src/server/repo/agenda/auto-schedule.ts`.

RESULT: FAIL — 1 CONFIRMED-DEFECT item remains open (claim 1).
OPEN ITEMS: 1
