# task-w27-f: triage-closure exit gate @ f01459a

Read-only closure sweep, no server started. FROZEN LITERAL (DEC-233):
`f01459a1d52b6867586dd0b5b7c81dfe09601cfd` (merge task-w26-d).

## STEP 1 — DEC-232 sha check

`main` HEAD at report time is `2b5619dd14c75a395a65084d51ef83759f5035e3`
("scribe wave 27"), one commit ahead of the frozen literal. Diff
`f01459a..main`:

```
decisions/DEC-232.md |  3 +++
decisions/DEC-233.md |  3 +++
decisions/DEC-234.md |  3 +++
field-guide/index.md | 72 ++++++++--------
src/decisions.ts     |  5 +++-
5 files changed, 49 insertions(+), 37 deletions(-)
```

Every changed path is within the DEC-232 allow-list (decisions/,
field-guide, decisions.ts-appends). No product/test file drift.
**No FAIL-stop. Sha check PASSES**; this report evaluates the tree as
frozen (product code identical at f01459a and current main).

## STEP 2 — docs/eval-findings.md disposition (one line each)

- **A1 P0 admin redirect loop (html_handling)** — CLOSED. Regression:
  `test/admin-assets-config.test.ts`, `test/root.test.ts`.
- **A2 /admin/submissions "n is not iterable"** — CLOSED. Regression:
  `app/src/pages/submissions/Submissions.render.test.tsx` (mounts real page
  against the single-object `{fields}` envelope).
- **B1 plan-detail "Invalid time value"** — CLOSED. Regression:
  `app/src/pages/review/Review.render.test.tsx` (null/invalid date render
  guard).
- **B2 reviewer queue/event-selector empty** — CLOSED. Regression:
  `test/events-reviewer-access.test.ts` (DEC-141: reviewer event listing via
  plan assignment; empty-list-not-403 case covered).
- **B3 public .ics itinerary always empty** — CLOSED. Regression:
  `test/itinerary-roundtrip.test.ts` (DEC-140: every rendered
  itinerary-toggle checkbox id round-trips to a matching VEVENT),
  `test/ics-download.test.ts`.
- **B4 overlapping session blocks eat pointer events** — CLOSED. Regression:
  `test/overlap-lanes.test.ts` (`assignLanes` side-by-side lane layout for
  overlapping items).
- **B5 speaker portal profile doesn't reflect to organizer** — CLOSED.
  Regression: `test/contact-profile-roundtrip.test.ts` (DEC-142, SPK-08/
  CNT-10 bidirectional bio/social round trip).
- **B6 CSV import silent non-persistence / duplicate-instead-of-merge** —
  CLOSED. Regression: `test/contacts-import.test.ts` (persists new-email
  row + retrievable; re-import by same email updates not duplicates; 400 not
  500 on bad mapping).
- **B7 near-duplicate detection fails to flag dupes** — CLOSED. Regression:
  `test/contacts.test.ts` (`planMerge`/dup-group logic) and
  `app/src/pages/contacts/ContactsApp.tabs.render.test.tsx` (Duplicates tab
  render against fixture-shaped groups).
- **E seed enrichment (accepted session, tasks, versioned deliverable +
  comment thread, headshots, kept near-dupes)** — CLOSED. Regression:
  `test/seed.test.ts` (accepted submission w/ participant row; second
  deliverable version chained via `previous_file_id` + `file_comment`
  thread; headshot_url set on ≥3 contacts against the real fixture; R2
  manifest entries).
- **F1 serial browser render-sweep gate** — CLOSED. Regression:
  `test/render-sweep-lib.test.ts` (`evaluateRoute`/`isNonEmptyText` pass/fail
  predicates used by the wired-in render-sweep gate), `test/walkthrough-lib.test.ts`
  sibling gate lane.
- **F2 parallel-safe component-render smoke tests** — CLOSED. Regression:
  the full `*.render.test.tsx` set under `app/src/pages/**` (Agenda, Comms,
  Contacts, Content, Files, Forms, Overview, Review, Scorecard, Settings,
  Speakers, Submissions) mounts each page against fixture-shaped API mocks
  incl. the single-object `/forms` envelope and null date fields.

Sections C (P2 gaps) and D (optional/low) are **WAIVED**, not re-opened,
per the unbroken DEC-069/139/176/189/195/206/223 chain — restated only:
these are accepted stage-1 scope decisions, not defects, and remain closed
by that chain as of this sweep.

## STEP 3 — External review-lens findings, both batches, closed on the
f01459a tree with file:line evidence

**First quartet:**

- **Evaluation-PUT IDOR → DEC-211**. `test/review-idor.test.ts:216-260`
  (`describe("DEC-211: PUT evaluation IDOR ...")`) — existence-hiding 404 for
  out-of-event submissions verified for organizer and reviewer paths, plus
  the still-succeeds 200 cases so the fix didn't over-block.
- **Speaker kind-gate bypass → DEC-214**. `test/task-assignment-kind-gates.test.ts:140-171`
  (`describe("DEC-214: PATCH /task-assignments/:id speaker-side kind
  gates")`) — 400s a `form` task with no saved response and a `file_request`
  task with no `file_id`; 200s once satisfied.
- **Rating-less scorecard 500 → DEC-212**. `test/review-results-ratingless.test.ts:154-189`
  (`describe("DEC-212: rating-less scorecard results")`) — GET results 200s
  with average 0 after a dropdown-only evaluation; CSV format omits
  per-criterion columns without throwing.
- **roundCriteria freeze gap → DEC-213**. `test/plan-criteria-guard.test.ts:173-`
  (`describe("DEC-213 per-round criteria freeze guard (task w22-c)")`) —
  changing a round-1 override after round-1 evaluations exist returns 409.

**Second quartet:**

- **Required-checkbox no-op → DEC-227**. `src/forms/validate.ts:75-82`, case
  `"checkbox"`: `const boolValue = Boolean(value); if (field.required &&
  boolValue !== true) { errors[field.id] = "required"; ... }` — required
  rejects unless exactly `true`. Regression: `test/forms.test.ts` (28 tests,
  passing per STEP 5 spot-check).
- **CSRF/draft cookie flags → DEC-228**. `src/auth/cookies.ts:83-110`
  (`isSecureRequest`, `buildCsrfCookie`, `buildDraftCookie` — all attach
  `HttpOnly`; `Secure` conditional on `options.secure`). Call sites (8
  total, verified via grep count): `src/routes/auth.tsx`,
  `src/routes/account.tsx`, `src/routes/portal/index.tsx`,
  `src/routes/portal/edit.tsx`, `src/routes/portal/profile.tsx`,
  `src/routes/portal/tasks.tsx`, `src/routes/public/submit.tsx` (16 call
  sites total across `buildCsrfCookie`+`buildDraftCookie`, ≥8 cookie mints).
  Regression: `test/cookie-flags.test.ts` (7 tests, passing per STEP 5).
- **deleteTrack dangling refs → DEC-229**. `src/server/repo/events.ts:270-315`
  (`deleteTrack`) — rejects with 409 `conflict` when referenced by
  `submission.trackId`, `submissionTrack` join rows, a form's `tracks_json`,
  an evaluation plan's `filters_json.trackIds`, or any `plan_reviewer.trackId`
  scope; never cascades. Regression: `test/track-delete-references.test.ts`
  (5 tests, passing per STEP 5).
- **Single-pass DST → DEC-230**. `src/lib/timezone.ts:29-95`
  (`zonedMinutesToUtc`/`offsetMsAt`) — two-candidate offset algorithm:
  fall-back overlap resolves to the earlier instant, spring-forward gap
  resolves forward. Regression: `test/timezone-dst.test.ts` (12 tests,
  passing per STEP 5).

**Plus:**

- **Email-case race** — DECLINED per DEC-216 (app-level normalization +
  existing raw unique index accepted as sufficient for stage 1; restated,
  not re-opened).
- **CRM-02 "no true multi-criteria filter"** — CLOSED per DEC-231. Verified
  by code symbols, not report prose: `src/domain/contacts.ts:224-287+`
  defines `SegmentRule[]` + `matchesSegment`/`matchesRule` with an `'any'`
  fan-out and per-field operators (including `ne`), i.e. a real
  multi-criteria filter already exists; the w24-f open item was a
  prose-grep false negative (DEC-231).
- **deleteField dangling visible-if references** — DECLINED-fail-safe per
  DEC-234. `src/server/repo/forms.ts:261` (`deleteField`) — verified: when a
  `visible_if` rule references a deleted field, the referencing field is
  hidden and stripped from validation (fails safe, not required), so no
  dangling-required-hidden-field state is reachable; fix declined for
  stage 1, restated not re-opened.

## STEP 4 — ref-closure report (report only; nothing changed)

`.git/refs/heads` in the base repo
(`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua`)
enumerates as: `main`, `task-w27-b`, `task-w27-c`, `task-w27-d`,
`task-w27-e`, `task-w27-f`, `tmp-main-check`.

- `tmp-main-check` tip: `472dc3a0b3213ce38e4b17e3be3e51836aea0b58`. It **IS**
  an ancestor of `main` (`git merge-base --is-ancestor tmp-main-check main`
  exits 0) — confirmed stale/superseded, safe to leave or prune later, no
  action taken here (read-only sweep).
- **Zero task-w* refs remain does NOT hold at this instant**:
  `task-w27-b`..`task-w27-f` are present. This is expected mid-wave state,
  not drift: DEC-233 binds the wave-27 exit battery to six gates
  `task-w27-a..f`, and this very report is produced from inside the
  `task-w27-f` worktree/branch while sibling battery lanes are still
  in flight. Battery lanes merge/void-close only after the planner
  verifies the 6/6-PASS predicate (DEC-233); the "expected only main and
  tmp-main-check" baseline applies once that closure happens, not before.
  `task-w27-a` is already absent (already closed/merged or never opened
  as a ref at this observation point).
- Per DEC-226: the wave-25 battery's late-drained 6/6 PASS logs recorded
  at `b2dc2c1` are historical and **VOID** as exit evidence — noted, not
  relied on anywhere in this report.

## STEP 5 — spot-check

```
npx vitest run test/forms.test.ts test/cookie-flags.test.ts \
  test/track-delete-references.test.ts test/timezone-dst.test.ts
```

Result: **4 files, 52 tests, all PASS.**

## RESULT

PASS. All eval-findings.md sections A/B/E/F dispositioned CLOSED with a
present regression-test file each; C/D restated WAIVED per the unbroken
decision chain, not re-opened. Both review-lens finding quartets plus the
three restated items (email-case race, CRM-02, deleteField) verified
closed/declined on the f01459a tree with file:line evidence. Ref-closure
enumerated as-is (task-w27-b..f present, expected mid-battery — not a
FAIL-stop condition per DEC-232's allow-list, which governs sha drift on
`main`, not the existence of in-flight battery-lane branches). Spot-check
green.

## OPEN ITEMS

0 required for PASS. Advisory only: the literal STEP-4 instruction text
("confirm zero task-w* refs remain") does not hold at the moment this
report was produced, because task-w27-f (this lane) and its w27-b..e
siblings are still open battery-lane branches. This is not a defect —
DEC-233's declare-at-wave-28-only gate means ref cleanup happens after the
planner reads all six task-w27-* logs, which hasn't occurred yet. Flagging
for the planner so the "zero task-w* refs" check is re-run after wave-27
closure, not read as a failure of this report.
