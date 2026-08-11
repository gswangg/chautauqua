# task-w25-f — triage-closure @ b2dc2c1 (detail)

Verification-only, read-only closure sweep per DEC-223/DEC-224/DEC-225.
No server started, no product code touched.

## Step 1 — sha check (DEC-223/225 re-freeze, allow-list per DEC-225)

`git diff --name-only b2dc2c103309433732bc689b933610fc7cfb3b06..HEAD`:

```
decisions/DEC-221.md
decisions/DEC-222.md
decisions/DEC-223.md
decisions/DEC-224.md
decisions/DEC-225.md
docs/verification-log/task-w24-a-build-test.md
docs/verification-log/task-w24-b-walkthrough.md
docs/verification-log/task-w24-c-perf-smoke.md
docs/verification-log/task-w24-d-render-sweep.md
docs/verification-log/task-w24-e-spec-audit.md
docs/verification-log/task-w24-f-triage-closure.md
field-guide/index.md
src/decisions.ts
```

Every path is `decisions/`, `field-guide/`, `docs/verification-log/`, or
`src/decisions.ts` (checked: only pure `export const DEC_2xx = "...";`
string-constant appends, no other lines touched). This is exactly the
DEC-225 allow-list ("late `task-w24-*` log merges are NOT drift"). The
newest code-bearing sha remains `b2dc2c1` ("merge task-w23-b"), matching
DEC-223's re-freeze. **No drift — proceeding.**

## Step 2 — docs/eval-findings.md closure sweep (one line per item)

`docs/eval-findings.md` (146 lines) re-read in full.

**Section A** (ratify + regression test):
- Admin `/admin/` redirect-loop fix — `wrangler.jsonc` `html_handling:
  "none"`; regression test `test/admin-assets-config.test.ts` present.
  CLOSED.
- `/admin/submissions` "n is not iterable" crash fix — `SubmissionsTable`
  reads the single-object `/forms` envelope; regression test
  `app/src/pages/submissions/Submissions.render.test.tsx` present.
  CLOSED.

**Section B** (P1 core-flow bugs):
- Plan-detail "Invalid time value" crash — guarded date formatting;
  `app/src/pages/review/Review.render.test.tsx` present. CLOSED.
- Reviewer queue empty despite assignments — `test/events-reviewer-
  access.test.ts` present (event-membership fix). CLOSED.
- `.ics` export always empty — `test/itinerary-roundtrip.test.ts`
  present (selection encoded into the export path). CLOSED.
- Overlapping session blocks eat pointer events — `test/overlap-
  lanes.test.ts` present (z-index/pointer-events layout fix). CLOSED.
- Speaker portal profile not reflected to organizer — `test/contact-
  profile-roundtrip.test.ts` + `test/contacts-profile-admin.test.ts`
  present. CLOSED.
- CSV import success-but-not-persisted / duplicate-instead-of-merge —
  `test/contacts-import.test.ts` present. CLOSED.
- Near-duplicate detection fails to flag dupes — covered by the same
  `test/contacts-import.test.ts` + `test/contacts.test.ts` dedupe
  assertions. CLOSED.

**Section C** (P2 backlog, fix-by-weight, not a stage-1 blocker): public
card date/room, keyword search, drill-in detail, day-switcher, headshot
wiring, admin content-edit controls, free-text scorecard criterion,
per-round scorecard, CRM bulk-email template parity, CRM multi-criteria
filter/lossy segment-from-search/metrics dashboard, task due-date TZ
display — none was implemented this campaign. Per DEC-069's four-plus-
two gate-based exit predicate (never required Section C item-by-item
completion) and the unbroken DEC-139/176/189/195/206/223 waiver chain,
this is accepted P2/optional residue, not a live open item. WAIVED
(chain-closed, not a FAIL line item).

**Section D** (optional/low, gated behind A-C+F green): CRM pipeline
kanban, contact-to-speaker push, content version history/files
library/ZIP bulk download, agenda publish action, unscheduled-panel
accept_queue filter, soft-404, a11y labels, sign-out control — none
implemented. Same DEC-139/176/189/195/206/223 waiver chain applies.
WAIVED (chain-closed, not a FAIL line item).

**Section E** (seed enrichment, required for grading): accepted session
+ onboarding tasks + file-request task with due dates; uploaded
deliverable with a second version + comment thread; headshots on
several speakers; near-duplicate contacts retained — `test/
seed.test.ts` present and covers these fixtures. CLOSED.

**Section F** (two permanent gates): serial browser render-sweep gate —
`scripts/render-sweep.ts` / `scripts/render-sweep-lib.ts` +
`test/render-sweep-lib.test.ts` present, wired as the DEC-069
render-sweep gate lane (confirmed by `task-w20-d`/`task-w21-c` and
re-confirmed unchanged by this sha check). CLOSED. Parallel-safe
component-render smoke tests — the `app/src/**/*.render.test.tsx` suite
(17 files: App, Agenda, Comms, BulkEmailModal, ContactsApp x2,
PipelineBoard, ContentApp, FilesLibrary, FormsPage, Overview, Review,
Scorecard, Settings, Speakers, SubmissionDetailPage, Submissions)
present. CLOSED.

No live, undispositioned open item remains in `docs/eval-findings.md`.

## Step 3 — OPEN ITEM #1 of task-w24-a-build-test.md

`docs/verification-log/task-w24-a-build-test.md` OPEN ITEM #1: "Sha
drift: `main` has code-bearing commits past the DEC-222 FROZEN
`0a263d2`... Planner must reconcile... before a build+test gate can
run." — CLOSED by DEC-223 (re-freezes LITERAL `b2dc2c103309433732bc68
9b933610fc7cfb3b06`, the exact sha `task-w24-a` found drift against,
verified sane) and DEC-224 (voids the entire w24 battery so no stale
gate result is load-bearing). The reconciliation this item asked for
has occurred; no further action needed.

## Step 4 — external review-lens findings (verify each stale/closed on tree)

- **eval-PUT IDOR** — `src/routes/review.ts:617-625` (existence-hiding
  `getSubmissionSummaryInEvent` check for every role, DEC-211) + the
  `2af5277` merge-train fix mocking `getSubmissionSummaryInEvent` in the
  PUT-evaluations test fakes, both present and unchanged since (`git
  log --oneline -- src/routes/review.ts` shows no commits after
  `b2dc2c1`). FIXED — confirmed stale/closed.
- **Speaker kind-gate bypass** — `src/routes/tasks.ts:273-289` (DEC-214:
  owning speaker gated on `responseJson`/`fileId` presence for
  `form`/`file_request` kinds before allowing `complete`). FIXED —
  confirmed present, unchanged.
- **Rating-less scorecard 500** — `src/domain/evaluation.ts:78-85`
  (DEC-212: `criteria.length === 0` short-circuits `aggregateSubmission`
  to `{count, average: 0, perCriterion: {}}` instead of hitting
  `computeWeightedScore`'s empty-list throw). FIXED — confirmed present,
  unchanged.
- **roundCriteria freeze gap** — `src/routes/review.ts:301-311` (DEC-213:
  a `roundCriteria` PATCH is rejected if it would change the *resolved*
  criteria of any round that already has evaluations, independent of
  the whole-plan criteria/scale guard). FIXED — confirmed present,
  unchanged.
- **Email unique-index case race** — DEC-216 explicitly DECLINES a
  schema migration for stage 1: app-level `lower()` normalization at
  the write boundary (`users.ts:57`) plus the existing raw unique index
  are accepted as sufficient because every write path normalizes before
  insert, so two concurrent creates of the same address collide on the
  raw index too; case-variant duplicates can only predate normalization,
  which cannot exist in stage-1's migrate+seed lifecycle. DECLINED per
  DEC-216 — not a live open item.
- **Temp-password process gap** — DEC-215 adds `POST /api/v1/users/:id/
  reset-password` (organizer-only, own-org, csrfJson, revokes sessions,
  one-time password in the JSON response, never emailed); DEC-220
  clarifies no self-target guard is needed; the PlanEditor roster gets a
  per-row "Reset password" button (`app/src/pages/review/
  PlanEditor.tsx:189,539-546` plus the `resettingUserId` in-flight guard
  from `f5ff947`); `test/users-reset-password.test.ts` (354 lines)
  covers the endpoint. CLOSED by DEC-215/DEC-220 — confirmed present,
  unchanged.

All six external review-lens findings are stale/closed on the tree.

## Step 5 — task-w* ref-closure report (REPORT ONLY, nothing changed)

`git branch -a` / `git for-each-ref refs/heads` in this worktree lists
only `main`, `tmp-main-check`, and `task-w25-a`..`task-w25-f` — every
`task-w24-*` local branch ref has already been deleted (post-merge
worktree cleanup by those workers' harness runs). Their commits remain
reachable from `main`'s first-parent history via six merge commits:

- `merge task-w24-a` (`80dc009`) — MERGED. Carries `3adb523` (FAIL-stop
  build+test log only). Zero-commit-dead is inapplicable (it did carry
  its own log commit), but per Step 1's diff the merge introduced only
  `docs/verification-log/task-w24-a-build-test.md` + `src/decisions.ts`
  appends — non-code-bearing.
- `merge task-w24-b` (`04350dd`) — MERGED. Carries `0a8eb56` (FAIL-stop
  walkthrough log). Non-code-bearing (log + decisions.ts only).
- `merge task-w24-c` (`e591034`) — MERGED. Carries `7dcbe65` ("perf-smoke
  gate PASS @ 0a263d2"). Non-code-bearing (log + decisions.ts only) —
  its PASS verdict is against the superseded `0a263d2` freeze and is
  VOIDed by DEC-224 regardless of merge status.
- `merge task-w24-d` (`bfc8099`) — MERGED. Carries `40b1d14` (FAIL-stop
  render-sweep log). Non-code-bearing.
- `merge task-w24-e` (`e92f8b4`) — MERGED. Carries `121f398` (FAIL-stop
  spec-audit log). Non-code-bearing.
- `merge task-w24-f` (`c36a77c`) — MERGED. Carries `fa2ae17`
  (triage-closure FAIL log). Non-code-bearing.

This differs from the task brief's stated expectation (task-w24-c/f
zero-commit dead, task-w24-b/d/e unmerged stale-log lanes to be
dropped): by the time this worktree was created, all six `task-w24-*`
lanes had in fact already been merged into `main` (visible in the
first-parent log walked in Step 1) and their local branch refs deleted.
The substance of DEC-224's accounting rule is unaffected either way —
every one of the six merges is confirmed non-code-bearing (Step 1's
allow-list diff), so per DEC-224 ("stray task-w24-* log merges
allow-listed non-code-bearing, never drift") none of them counts as
drift regardless of whether they are merged, dropped, or dead. No
other `task-w*` branch (w1-w23, or any other w24/w25 letter) has a
surviving local ref in this repository. This is a report-only finding;
nothing was changed.

## Step 6 — own build/test spot-check

`([ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund
--silent) && npm run build` — clean (dual `tsc --noEmit` + `vite
build`). `npx vitest run test/users-reset-password.test.ts test/review-idor.test.ts
test/review-results-ratingless.test.ts test/review-rounds.test.ts
--silent` (spot-check of the review-lens areas touched in Step 4) — all
pass. No server started.

## Conclusion

Sha check: no drift, `b2dc2c1` re-freeze holds. `docs/eval-findings.md`:
every Section A/B/E/F item CLOSED with a present regression-test file;
every Section C/D item WAIVED by the unbroken DEC-069/139/176/189/195/
206/223 chain — no live open item. `task-w24-a`'s OPEN ITEM #1: CLOSED
by DEC-223/DEC-224. All six external review-lens findings: five FIXED
and one (email case race) DECLINED-by-DEC-216 — all confirmed
stale/closed on the tree, zero remaining live findings. `task-w*`
ref-closure: all six `task-w24-*` lanes merged and confirmed
non-code-bearing (report only, DEC-224 accounting unaffected).

OPEN ITEMS: 0

RESULT: PASS
