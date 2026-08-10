# task-w3-f — triage-closure gate detail

Newest code-bearing main short-sha per DEC-091: `2887db0` ("Add DEC-089
walkthrough area \"scale\"..."), skipping the bookkeeping-only commits
that follow it on main (`3878d4f` merge, `f9a33fd` scribe wave 3 —
decisions/field-guide/src/decisions.ts constant table only, `31fa021`
task-w3-a barrier — docs/verification-log.md only, `1c75d92` merge).

Item-by-item re-verification of every remaining docs/eval-findings.md entry:

- **Item 2 (at-most-once acceptance)** — CLOSED. DEC-079 landed:
  `src/server/repo/submissions/status.ts:104-142` (`updateSubmissionStatuses`)
  now runs `runAcceptancePlanning` BEFORE the row's status/`acceptedAt` UPDATE
  for a firing row (see the function doc comment at line ~99 and the
  `if (result.fireAcceptance)` block at line ~123-142); if planning throws,
  the row stays un-accepted so a retry re-fires. `fireAcceptance` trigger
  unchanged at `src/domain/status.ts:53-58`
  (`enteringAcceptedFirstTime = next === "accepted" && current.acceptedAt === null`).
  `void DEC_079;` reference present at `src/server/repo/submissions/status.ts:17`.

- **Item 3 (unchunked public inArray)** — CLOSED. DEC-080 landed:
  `src/lib/chunk.ts:1-13` defines `ID_CHUNK_SIZE=90`/`chunkIds`.
  `src/server/repo/public.ts` imports `chunkIds` (line 13) and batches every
  formerly-unbounded `inArray` — `hydrateSessions`-family batches at lines
  157, 178, 210, 286 (the one remaining unchunked `inArray` at line ~405 is
  over `roomIds`, an event-bounded small set, annotated "DEC-078 bounded-list
  exemption"). `src/lib/itinerary.ts:11` adds `MAX_ITINERARY_IDS = 300`;
  `src/routes/public.tsx:580-582` enforces it with a 400 on the
  `/e/:slug/schedule.ics?ids=` route. `src/server/repo/comms.ts` (`loadIcsScheduleData`)
  also imports `chunkIds` (line 11) and batches at lines 137, 155, 232, 244.

- **Item 4 (per-reviewer full scans)** — CLOSED. DEC-081 landed:
  `src/domain/evaluation.ts:289` (`resolveAssignments`, pure, set-based).
  `src/server/repo/review.ts`: `resolveReviewerSubmissions` (line 344-353)
  now does one plan-filtered load + pure `resolveAssignments`, not a
  per-reviewer scan; `isSubmissionInReviewerScope` (line 358+) does a
  targeted single-submission-scoped query instead of a full-set load;
  `countEvaluationsForSubmission` (line 563+) does a targeted `count(*)`.
  `src/routes/review.ts`: the `/progress` handler (line 271-291) and
  `/remind` handler (line 343-360+) each call `listPlanFilteredSubmissions`
  ONCE (not once per reviewer) then run pure `resolveAssignments`; the
  evaluation PUT handler (line 494-522) uses `isSubmissionInReviewerScope`
  (line 505) and `countEvaluationsForSubmission` (line 518) — no full scans
  on the hot keystroke path.

- **Item 5 (rounds dead knob)** — CLOSED. DEC-082/DEC-087 landed: migration
  `migrations/0009_review_rounds.sql` adds `evaluation_plan.current_round`
  (default 1). `src/server/repo/review.ts:153-166` implements
  `advancePlanRound`, capped at `plan.rounds` (409 once
  `current_round === rounds`). `src/routes/review.ts:226`
  (`POST /api/v1/plans/:id/advance-round`) wires it; the evaluation PUT at
  `src/routes/review.ts:515` now reads `const round = plan.currentRound`
  (no longer hardcoded to 1); `repo.listEvaluationsForPlan` takes a
  required `round` arg (three-arg form per DEC-087) used at
  `src/routes/review.ts:277, 308, 348, 438`. Tests: `test/rounds.test.ts`,
  `test/review-rounds.test.ts` both present and passing.

- **Narrowing note: DEC-022** — CLOSED, superseded by DEC-083. Real
  purge-on-publish edge caching now lands in `src/server/pubcache.ts:1-9`
  ("J10 / DEC-083: real purge-on-publish edge caching for public surfaces.
  Supersedes DEC-022's 'no purge machinery' sentence"), registered once in
  `createBaseApp` per the module's line-115 comment.

- **Narrowing note: DEC-059** — CLOSED, superseded by DEC-084.
  `src/lib/image-dims.ts:1,10` adds a server-side headshot dimension gate
  (`MAX_HEADSHOT_EDGE_PX = 2048`) amending DEC-059's client-canvas-only
  scope; `test/image-dims.test.ts` (10 tests) passes.

- **Narrowing note: DEC-054** — CLOSED, upheld by DEC-085 (decisions/DEC-085.md
  present in-tree; no further code action required per the task's own
  framing).

- **Narrowing note: DEC-061** — CLOSED, sanctioned by SPEC §10's own
  "only after J1-J12 are green" gate (no code action; listed for
  completeness per the task's own framing).

- **Minor note: submittedAt≡createdAt** — CLOSED, ruled correct under
  DEC-014/DEC-085 (no code action per the task's own framing).

- **Minor note: accentColor hex validation** — CLOSED, verified at both
  write paths: `src/routes/api/portal-config.ts:99-100` and
  `src/routes/api/events.ts:87-88` both call `isValidHexColor` server-side;
  client-side mirror at `app/src/pages/settings/formState.ts:62-63`
  (`isValidHexColorOrEmpty`), covered by
  `app/src/pages/settings/formState.test.ts:74-81`.

All ten entries verified in-tree and pruned from docs/eval-findings.md.
`npm run build` and `npm test` green at this worktree (branched from
`1c75d92`, which is `2887db0` plus only bookkeeping/merge commits):
94 test files, 971 tests passed, 0 failed.

OPEN ITEMS: 0

RESULT: PASS
