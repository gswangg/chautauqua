# task-w42-d — content-lifecycle adjudication detail @ e01f237e

Companion detail file for
`docs/verification-log/index/0212-2026-08-15-task-w42-d-content-lifecycle-adjudication-e01f237e.md`.
The index entry carries the full adjudication text; this file records the
raw evidence trail for both claims.

## Claim 1 evidence

- decisions/DEC-020.md amendments consulted: wave 60 (line 5-7, the reopen
  itself), wave 10 (line 13-15, portal disclosure both sides of the act),
  wave 58 (line 41-43, organizer/API disclosure + `{ reopened }` return
  shape), wave 12 (line 21-23, re-read-not-snapshot rule for any UI showing
  the pill).
- src/server/repo/files-content-status.ts:96-117 `reopenContentReview` —
  one set-based idempotent UPDATE + `.returning()`, no mailer import
  anywhere in the module (grep confirms).
- src/routes/files.ts:150-243 — organizer/participant upload route;
  `contentReviewReopened` + conditional `contentStatus: 'pending'` on the
  201 body (lines 230-241).
- src/routes/portal/tasks.tsx:558-635 — speaker portal upload route;
  `ReuploadReviewNotice` pre-upload copy sourced from
  src/routes/portal/tasks/views.tsx:187-199; post-upload `?uploaded=`
  redirect param set iff `submissionId` non-null (line 630).
- SPEC.md: `grep -n -i "content.status\|reopen\|re-upload\|reupload"
  SPEC.md` → only line 147 (version-chain description, no notification
  language) and line 368 (unrelated Forge-mirror bonus item).
- docs/clarifications.md: `grep -n -i "content.status\|reopen\|producer.*notif\|notif.*producer\|content review" docs/clarifications.md` → zero
  matches.
- docs/sessionboard-reference/04-content-management.md sections 2-3: no
  reopen-on-reupload mechanic documented at all in the reference product;
  DEC-020's reopen is a Chautauqua-original design decision, not a ported
  SessionBoard behavior.
- src/server/repo/overview.ts:247-268 — Overview §03 query, exactly
  `accepted AND content_status='pending'`, the producer's existing queue
  that surfaces a reopen (organizer- or speaker-triggered) with no new
  wiring.

## Claim 2 evidence

- decisions/DEC-932.md amendment "findings wave 6" (line 5-7) — on-point
  prior ruling on the identical claim shape, DELIBERATE.
- `grep -rn "tasks/\${" app/src | grep -v test` → zero hits on
  `e01f237e`, confirming the SPA still never calls
  `POST /api/v1/tasks/:id/assign`.
- src/routes/tasks.ts:449-462 — the assign endpoint itself, confirmed
  live/reachable (organizer-only, csrfJson), not removed — it is a real
  capability the product exposes over the API even though no UI calls it.
- test/onboarding-task-backfill.test.ts — 7 tests, all green on
  `e01f237e` (`npx vitest run test/onboarding-task-backfill.test.ts`).
  Specifically the "an already-complete assignment is never UPDATEd or
  DELETEd by the back-fill pass" case (line 283-311) exercises the
  `onConflictDoNothing` preservation mechanism a selective `/assign` call's
  rows rely on to survive a later back-fill pass triggered by a different
  contact's acceptance.
- src/server/repo/tasks/crud.ts:326-329 — DEC-746's own createTask
  back-fill, the sibling mechanism on the other axis (new task -> every
  active accepted contact, no opt-out), cited in the wave-6 amendment as
  evidence the dense model is the product's stated shape, not an oversight
  local to acceptance.

## Test run

```
npx vitest run test/exit-predicate-corpus.test.ts test/verification-log-assemble.test.ts test/onboarding-task-backfill.test.ts
```
3 files, 29 tests, all PASS (18:22:00 run, Duration 1.82s).
