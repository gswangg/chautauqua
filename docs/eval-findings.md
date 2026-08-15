# Eval findings — rebased 2026-08-15 (wave 17)

Verified against `main` sha `9b21309c7240cfb6622dcea0f15ebe981060dcd6` (merge
task-w16-a — this wave's own planning boundary). Every citation below was
either re-cited against this sha directly or, where noted, inherited from a
prior wave's own re-verification against its own boundary sha and not
re-derived this wave. The prior generation of this file (1,505 lines, written
against `chautauqua-research/design-frames-v7/v8/v9` — a pack not vendored in
this repo, plus a long series of dead gate-N fleet/sbek verdicts and snapshot
shas) is archived verbatim, never deleted, at
`docs/mandates/findings-archive-2026-08-15.md`. Line references inside the
archive do not resolve against the current tree; nothing there is
authoritative until someone re-verifies it and moves it into a tier below.

## Standing rules (still bind)

- **Targeted tests only, in-wave.** Workers run only the tests for what they
  touch. The full suite runs on merge-train batches and at verification/exit
  waves, via `scripts/with-test-lock.sh` — never ad hoc inside a task wave.
- **Items close on measured or runtime evidence, never on a code read.** A
  file:line citation proves intent, not behavior. An item may enter a tier
  below only if it was re-verified against current `main` with a cited
  file:line (or, for behavior claims, an exercised check).
- **The vendored frame pack is `docs/design/*.dc.html`.** Where a test
  contradicts the vendored design copy there, the test is wrong, not the
  frame.
- **docs/ precedence per `docs/README.md`**: `docs/clarifications.md`
  overrides all; `decisions/DEC-*.md` is binding and compile-checked via
  `src/decisions.ts` (never hand-edit that file directly); the rest of
  `docs/` (brief, sessionboard-reference, eval-rubric, fixtures) informs but
  does not override.
- **No eval gaming.** `docs/eval-rubric/` and `docs/fixtures/` inform what to
  build; product code never references fixture values, persona names, or
  rubric IDs. Fixture data lives only in the seed script.
- **The vendored `docs/design/*.dc.html` pack outranks a research-repo render
  measurement.** Where a fleet/sbek report cites a pixel value from a
  `chautauqua-research` render and `docs/design/README.md` states a
  different rule for the same surface, the vendored README rule wins — it is
  the spec the swarm is building against, the research render is a prior
  gate's snapshot of a prior draft. See TIER 1 item 3 below (`12-home`) for
  a worked example.
- **A mandate item moves tier only on a citation against current `main`.**
  Not on a code read of an old diff, not on inheriting a prior wave's
  verdict, and not on a task brief's restated claim — re-run the check
  (`git merge-base --is-ancestor`, `grep`/read the live file) and cite
  file:line or ref-state before changing an item's tier. A brief that
  asserts a branch is unmerged or a symbol doesn't exist is a claim to
  re-verify, not a fact to propagate (see the `task-w8-c`/`task-w8-d`
  correction below — the swarm has now gotten this wrong in both
  directions across two waves).
- **A verification lane's branch that equals its base measured nothing, and
  IN FLIGHT is written from `.git` ref state, never from a wave note**
  (DEC-069 wave-17 amendment). Two branches this wave (`task-w16-c`,
  `task-w16-d`) each pointed at `c557cff9` — main's own parent at their
  branch-point — meaning zero commits were ever made on them: their intended
  gates (walkthrough, perf-smoke) never ran, and a wave note claiming they
  "completed" or "found nothing" would have been reporting on an empty diff,
  not a real check. The corollary: the IN FLIGHT section of this file is
  built by walking `git for-each-ref` / `git merge-base --is-ancestor`
  against the boundary sha in this file's own header, never copied forward
  from a previous wave's prose describing what it believed was merged.

## TIER 0 — re-verified, already correct, do not re-file

These three families recur across the archived history as open/uncertain
findings. Each was re-checked against current `main` this wave and is closed;
re-filing any of them without new runtime evidence is a regression of this
triage, not a fresh finding.

- **Seeded dates are already relative to one seed clock** —
  `scripts/seed.ts:261-278` (`SEED_NOW`, DEC-591): `SEED_NOW` defaults to
  `Date.now()`, is overridable via `CHQ_SEED_NOW` for deterministic test
  runs (throws loudly on an unparseable override, no silent fallback), and
  every seeded instant (`BASE_TS`, etc.) is an offset from it — a seed run
  today does not emit rows dated years in the past or future.
- **Saved embeds exist** — `src/db/schema/embed.ts` (schema) and
  `src/routes/public/saved-embed.tsx` (public render route) are both present
  and wired; the capability is built, not a gap.
- **Per-person reminder scope exists on both send and preview** —
  `src/routes/tasks.ts:564-613`: the send route (`/remind`) and the preview
  route (`/remind/preview`) both accept an optional `contactIds` array
  (DEC-694) that scopes the reminder to exactly those contacts, identically
  on both endpoints, falling back to "every outstanding contact" only when
  omitted.

### DO-NOT-RE-FILE (wave 17, re-verified against `main 9b21309c`)

Each item below was cited by the planner directly against this wave's
boundary sha and landed here without re-derivation. Filing any of these
again without new runtime evidence is a regression of this triage:

- **Bulk-email two-stage dedupe** — `src/routes/api/contacts/bulk-email.ts:214-250`
  (DEC-238 wave-14): the collapse-then-window shape is in place and closed.
- **`createUser` insert-then-select with `onConflictDoNothing`** —
  `src/server/repo/users.ts:106-124` (DEC-552 wave-14).
- **Breaks validation accumulates instead of throwing** —
  `src/routes/api/breaks.ts:130-166`, via `collectBoundedText`/
  `collectBoundedOptionalText`, with the DEC-022 midnight cross-check still
  reached at `:162` (i.e. accumulation doesn't short-circuit the later
  cross-field check).
- **`send.ts`'s unconditional `bumpIcsSequences`** —
  `src/routes/comms/send.ts:243-258` — RULED DELIBERATE in-code; re-filing
  this as a defect is a regression of this triage, not a fresh finding.
- **`MAX_PARTICIPANTS_PER_SUBMISSION` now binds all FOUR participant-writer
  doors** — `src/routes/api/submissions.ts:598`,
  `src/server/repo/portal-edit.ts:487`,
  `src/routes/api/contacts/import.ts:194`,
  `src/server/repo/import/sessionboard.ts:622` — plus the repo-level
  pre-write guards at `src/server/repo/participants.ts:105` and `:191`. The
  "two of four doors" finding (previously carried in this file / the field
  guide) is CLOSED — all four are now covered.
- **Mail envelope goes through `addressValue`** —
  `src/mail/email-binding.ts:236-240`, guarded by
  `test/mail-envelope-address.test.ts`.

### Re-verified this wave (w9-e, 2026-08-15) — moved out of TIER 1 item 4

Each closed on a STRUCTURAL citation (file:line read against current `main`);
none of these were exercised (no test run this wave — docs-only task).

- **EMB session-card speaker title/company** (was TIER 1 item 1) — STRUCTURAL:
  `src/routes/public/cards.tsx:102-116` `SpeakerNames`/`speakerIdentityClause`
  already renders `Name · Title, Company` in the muted register, and
  `src/server/repo/public/sessions.ts` already selects `job_title`/`company`.
  This item was NOT in this wave's assigned citation list but was found
  closed while cross-checking the IN FLIGHT block (below) — closing it here
  rather than leaving a stale open item standing on a false premise.
- **Reviewer multi-track scope renders a list, never "All tracks"** —
  STRUCTURAL: `src/domain/evaluation/progress.ts:39` (`resolveReviewerScopeTrackIds`,
  DEC-845) returns `[]` only when genuinely unrestricted, else every
  restricted track id named; `src/routes/review/reviewer.ts:99-101` builds
  `scopeTrackName` from `formatReviewerScopeLabel`, which joins every track
  name with `·` — never truncates to a count.
- **Accepted speakers keep editing past close** — STRUCTURAL:
  `src/domain/edit-lock.ts:22` `canEditSubmission` returns
  `status === "accepted" || !isFormClosed(...)` — the accepted branch never
  gates on the close date (DEC-041 forfeit reversal, see TIER 1 note below).
- **`npm run deploy` exists** — STRUCTURAL: `package.json:21`
  (`"deploy": "wrangler d1 migrations apply chautauqua --remote && wrangler deploy"`).
- **Comms preview `.ics` chip formats in the event's own timezone** —
  STRUCTURAL: `app/src/pages/comms/icsChip.ts:18-19` `formatLocal` calls
  `formatDateTimeInZone(iso, timeZone)` (DEC-494) — never the viewer's
  ambient zone.
- **Settings edit-view field widths are tokens (dates 200, seats 110)** —
  STRUCTURAL: `app/src/pages/settings/settings.css:17-22`
  (`--chq-field-w-date: 200px`, `--chq-field-w-seats: 110px`, DEC-896
  amendment) — the only widths a settings edit field can render at.
- **`/account/password` has a real Cancel control and the bare page is a
  real 820 column** — STRUCTURAL: `src/routes/account.tsx:139-144` renders
  `<a class="chq-btn chq-btn-secondary chq-auth-cancel" href={props.backHref}>Cancel</a>`;
  `src/routes/auth.css.ts:318-336` scopes the fixed-footer/scrollable-stack
  treatment to `.chq-bare-page:has(.chq-auth-fields)` (wave 48 amendment).
- **Overview §01 carries "Skips anyone reminded in the last hour"** —
  STRUCTURAL: `app/src/pages/Overview.tsx:325`.
- **Pipeline fit score + rationale exist** — STRUCTURAL:
  `src/domain/pipeline-fit.ts` present and exporting the fit computation.
- **Portal "what speakers may edit" toggles exist** — STRUCTURAL:
  `app/src/pages/settings/PortalSettingsPanel.tsx:306` (`What speakers may
  edit` section header) plus the toggle rows beneath it.

### Mobile / phone items re-verified this wave — leave in the phone queue below, cited

These stay in the "Mobile / phone queue" section per the task's instruction
(built items, but the queue as a whole is not being promoted) — cited here
so the next mobile-lane sweep doesn't re-derive them:

- **Phone agenda N-aware clash caption** — STRUCTURAL:
  `app/src/pages/agenda/PhoneAgenda.tsx:186` (`{countOf(slot.sessions.length,
  'session')} in this slot`).
- **Phone agenda occupied-slot "Place here anyway" path** — STRUCTURAL:
  `app/src/pages/agenda/PhoneAgenda.tsx:167-176` (free-slot branch) and
  `:199-208` (clash-slot branch), both gated on `armed`.
- **Phone-block override assertion exercises the override side, not just
  the base** — STRUCTURAL: `app/src/phone-block-visibility.test.ts:186-205`
  asserts every non-exempt selector's top-level `display:none` is switched
  back on inside a phone media query.
- **Phone password screen's fixed footer + Cancel** — STRUCTURAL:
  `src/routes/auth.css.ts:318-336` (same citation as the desktop item above
  — the phone-width media query scopes the fixed-footer/Cancel-visible
  treatment to `.chq-bare-page:has(.chq-auth-fields)`, and `.chq-auth-cancel
  { display: inline-flex; }` at line 335 is the phone-only Cancel reveal).
- **Comms phone landing** — STRUCTURAL:
  `app/src/phone-block-visibility.test.ts:109-121`, the
  `.chq-comms-phone-landing` entry in `NO_PHONE_RULE_OK` (DEC-621) — its
  phone-width visibility rule lives on the co-applied
  `.chq-comms-phone-landing-show` class, exempted with a reasoned entry.
- **Home footer media rule** — STRUCTURAL: `src/routes/public/home.css.ts:72-76`
  (`@media (max-width: 700px)` block reflowing `.chq-home-header`,
  `.chq-home-body`, `.chq-home-hero h1`, `.chq-home-footer`).

## IN FLIGHT — owned by a branch, do not re-file

### REF TRUTH, rewritten this wave (w17-e, 2026-08-15) against boundary `main 9b21309c`

Per the new standing rule above, this block is built from `.git` ref state
(`git for-each-ref refs/heads`, `git merge-base --is-ancestor <ref>
9b21309c`) at this wave's own boundary sha, not inherited from a prior
wave's prose:

- **`task-w14-d` and `task-w15-a`/`-b`/`-c`/`-d`/`-e`/`-f` are ALL MERGED** —
  merge commits are present in `main`'s reflog and the source branches'
  refs are deleted post-merge (the standard pattern for a landed lane in
  this repo). The wave-16 field-guide note that read these as "all
  UNMERGED" was FALSE at the time it was read and must not be repeated —
  see the wave-16 rewrite below (kept for its citations, corrected here)
  for the specific file:line evidence of each merge.
- **`task-w16-a` is MERGED** — it is this wave's own boundary commit:
  `main`'s tip at `9b21309c` IS "merge task-w16-a" (`git show -s 9b21309c`:
  `Merge: c557cff9 8cc08b91`). The wave-16 rewrite below, which read
  `task-w16-a` as "confirmed UNMERGED," was accurate at ITS OWN boundary
  (`c557cff9`, 8 commits earlier) but is now stale — the mail-envelope-
  `addressValue` test-coverage item it was tracking is CLOSED, see the
  DO-NOT-RE-FILE block in TIER 0 above.
- **`task-w16-b` (ref `6aed4fe0`) and `task-w16-e` (ref `bdaf3997`) have real
  commits and are UNMERGED as of `9b21309c`** — still owned, do not re-file
  their scopes: `task-w16-b` is a findings-rewrite lane (it produced the
  wave-16 version of this very file, at ITS boundary `c557cff9`), and
  `task-w16-e` is a spec-audit lane (`DEC-063: spec-audit gate for J1-J12,
  §5 invariants, §6 security`). Neither branch's scope should be
  re-launched as a fresh task while these refs are still live and unmerged
  at this boundary.
- **`task-w16-c` and `task-w16-d` each point at `c557cff9`, which is `main`'s
  own PARENT at this boundary** — both produced ZERO commits (branch tip ==
  branch base), so their intended gates (walkthrough and perf-smoke) NEVER
  RAN, and their scope was UNOWNED until this wave. `task-w17-a` and
  `task-w17-b` now hold that scope (walkthrough gate, perf-smoke gate,
  respectively) — do not treat `task-w16-c`/`task-w16-d` as having verified
  anything.
- **`task-w16-f` never got a ref this wave** — no branch by that name exists
  at this boundary; its scope (per the field-guide note) belongs to
  whichever wave actually opened a ref for it, not `task-w16-c`/`-d`'s
  empty-branch pattern above.

### Wave-16 rewrite (2026-08-15, boundary `main c557cff9`) — citations kept, status corrected above

The wave-16 brief's REF TRUTH ("task-w14-d and task-w15-a/-b/-c/-d/-e are all
unmerged as of planning, main `c0b14342`") was accurate at planning time and
was stale by the time that wave ran — the merge train advanced 8 commits past
that boundary first. The wave-16 task re-ran the check against its own
boundary (`c557cff9`) and found:
`git for-each-ref refs/heads` listed only `task-w15-b`, `task-w15-e`,
`task-w16-a`, and that task's own `task-w16-b` in the w14–w16 range (`task-
w14-d`, `task-w15-a`, `task-w15-c`, `task-w15-d` had no ref at all — deleted
post-merge, same pattern documented below for `task-w8-a`/`task-w10-b`).
`git merge-base --is-ancestor <ref> main` was run against every ref that
still existed at that boundary:

- **`task-w14-d`, `task-w15-a`, `task-w15-b`, `task-w15-c`, `task-w15-d`,
  `task-w15-e` — ALL SIX MERGED (confirmed again at this wave's later
  boundary `9b21309c`, see REF TRUTH above).** No branch in the w14–w15
  range that the wave-16 brief named was still in flight. Confirmed by
  symbol citation, not just ref-ancestry, for the three the brief
  specifically doubted:
  - `task-w14-d` (AUTH_CSS `.chq-field-invalid` cascade) — MERGED
    (`c15b8ca3` "merge task-w14-d"). `app/src/components/error-states.css:31`
    and `src/views/error-states.css.ts:46` both now read
    `.chq-field-invalid.chq-field-invalid` (doubled to specificity `(0,2,0)`,
    DEC-124 wave-14 amendment) instead of the single-class `(0,1,0)` that lost
    to `theme.ts`'s base `input[type=...], select, textarea` group's
    `(0,1,1)`. `test/error-invalid-outranks-base.test.ts` (149 lines, added
    by this merge) computes CSS specificity arithmetic and asserts the doubled
    class outranks every base-group arm — this is item 11 of TIER 1 item 3
    below, now CLOSED.
  - `task-w15-c`/`task-w15-d` (`updateEvent` slug guard) — MERGED
    (`64b49a63` "merge task-w15-d"). `src/server/repo/events.ts:224-259`
    `updateEvent` now wraps its `UPDATE` in try/catch and calls
    `isUniqueViolation(err, "event.slug")` at line 250 to translate a raced
    `UNIQUE constraint failed` into the same `slug: "Already in use"` refusal
    the route's pre-check raises (DEC-111 amendment, findings wave 15) — the
    brief's "still no slug guard" claim no longer holds.
  - `task-w15-d` (`sessionboard.ts` participant cap) — MERGED (same
    `64b49a63`). `src/server/repo/import/sessionboard.ts:620-627` now checks
    `currentCount >= MAX_PARTICIPANTS_PER_SUBMISSION` per row and pushes an
    over-cap participant into the `skipped` channel with a named reason
    (DEC-604 wave-15 amendment) — the brief's "no participant cap" claim no
    longer holds.
  - `task-w15-b` (send.ts intra-batch collapse) — MERGED (`144e6e67` "merge
    task-w15-b"). `src/routes/comms/send.ts:125-138` now runs a
    `seenInBatch`/`dedupeKey` stage BEFORE `loadRecentlySent` (DEC-238
    wave-15 amendment, mirrors `bulk-email.ts`'s two-stage shape) — the
    window query no longer runs without an intra-batch collapse first.
- **`task-w15-f` never existed as a ref that wave** — no branch by that name
  was in `refs/heads` at boundary `c557cff9` (the merge-log entries reading
  "merge task-w15-f" belong to an unrelated, much older recurring
  generic-audit lane name reused many times across this repo's history —
  e.g. `f577a756` "task-w15-f: DEC-196 spec-audit", `8fdd49fa` "task-w15-f:
  triage-closure gate", both pre-dating that wave by a wide margin — not
  that wave's mail-envelope scope). The mail-envelope-`addressValue` scope
  for wave 16 was `task-w16-a` (`8cc08b91` "task-w16-a: add named
  mail-envelope-address test file (DEC-499 amendment wave 16)"), branched
  from `main c557cff9` and, at THAT boundary, confirmed UNMERGED — this is
  the status now SUPERSEDED per the REF TRUTH block above: `task-w16-a` is
  merged as of `9b21309c` and the item is CLOSED (see DO-NOT-RE-FILE in
  TIER 0). Note the underlying fix this test exercises
  (`src/mail/email-binding.ts`, "envelope from/to skipped addressValue at the
  messageFactory boundary") already landed on `main` in an earlier, unrelated
  wave (`152757d9`) — `task-w16-a` added coverage, not a re-fix of a live
  gap.

### Carried forward from wave 12 (still true, not re-checked this wave beyond ref presence)

- **`task-w8-c`** (review round name + window) — MERGED. `roundLabel`/
  `roundMeta` DO exist in `main`'s `app/src/pages/review/ReviewerQueue.tsx`:
  `import { roundLabel } from '../../../../src/domain/evaluation';` at line 31,
  used at line 508 (`roundLabel(routeEnvelope.planName,
  routeEnvelope.currentRound, routeEnvelope.roundMeta)`). The plan-scoped
  queue header subtitle is built and live.
- **`task-w8-d`** (compose step-1 slot column + footer) — MERGED.
  `app/src/pages/comms/ComposeWizard.tsx:713-716` renders the slot column
  (`s.slot ? formatDayLabel(...)+clockHHMM(...) : "No slot yet"`); the
  footer row is present at `:1226-1230`
  (`chq-comms-send-report-footer[-note|-actions]`).
- **`task-w8-b`** (Submissions→Comms `?ids=` handoff + ComposeWizard
  entry-effects landing rule) — MERGED (`git merge-base --is-ancestor
  task-w8-b main` succeeds; commit `6b5ae238` "merge task-w8-b" is in
  `main`'s history). STRUCTURAL: `app/src/pages/submissions/BulkActionBar.tsx:77`
  links to `/comms?tab=compose&ids=${emailIds.join(',')}`.
- **`task-w8-e`** (Comms History pager) — MERGED (commit `508c0152` "merge
  task-w8-e" is in `main`'s history). STRUCTURAL:
  `app/src/pages/comms/HistoryTab.tsx:42-160` renders `page`/`perPage` state
  wired to a real pager (prev/next, `paginationSummary`).
- **`task-w8-a`** as named in an earlier wave's brief (public session-card
  speaker title/company, EMB-01/09) — no branch by that name currently
  exists (the `task-w8-a` name is reused from an earlier, unrelated wave's
  submission-detail-page task, already merged and gone). The EMB-01/09 work
  itself is done on `main` — see the TIER 0 closure above.
- **`task-w10-b`** — has a ref (`git for-each-ref refs/heads` lists it) AND
  is MERGED (`git merge-base --is-ancestor task-w10-b main` succeeds;
  `main`'s current tip commit is literally `988d8be0 merge task-w10-b`).
  This corrects the field guide's carried note ("w10-b DEAD, no ref, no
  merge") — that was accurate when written but is stale now. Flagging
  explicitly because this wave's brief tells `task-w12-d` to adopt
  `task-w10-b`'s scope "under a verify-or-implement guard": the verify path
  should find the work already done and skip re-implementation, not treat
  the lane as dead and rebuild it.
- Every other `task-w*` ref present in the worktree today (`task-w12-a/b/c`,
  `task-w17-i`, `task-w68-*`, `task-w71-*`, `task-w72-*`, `mail-rich-shape-
  fallback`, `manual-qa`, `task-custodian-w68-4`) is either already merged
  (`task-w12-a/b`, `task-w68-d`, `task-w71-c/d/e`) or belongs to waves ahead
  of/adjacent to this one and outside this task's w8–w11 scope — not
  re-triaged here; do not read their presence as evidence either way about
  the w8–w11 claims above.

### DISMISSED review-lens claims (wave 16)

Four reviewer-lens findings re-verified as ALREADY CORRECT against boundary
`main c557cff9` — filing any of these again without new runtime evidence is
a regression of this triage, not a fresh finding:

- **Duplicate `trackIds` ARE deduped on both write doors.**
  `src/routes/api/submissions.ts:131` — `const trackIds =
  Array.from(new Set(raw as string[]))` before the `MAX_SUBMISSION_TRACK_IDS`
  cap check (DEC-598 wave-10 amendment, dedupe runs BEFORE the cap so a
  repeated id can't inflate someone past it). `src/routes/public/submit-
  body.ts:75-79` `extractTrackIds` does the same:
  `Array.from(new Set(list))` before returning.
- **The reviewer plan window IS enforced on the lone submission read.**
  `src/routes/review/reviewer.ts:288` — `if (auth.role !== "organizer" &&
  !isPlanOpen(plan.openDate, plan.closeDate, Date.now(), plan.timezone))
  throw new ApiError("conflict", ...)`, same gate the queue and score `PUT`
  already apply (DEC-018 wave-10 amendment). It is also enforced on file
  authz: `src/server/repo/files-authz.ts:185-209`
  `reviewerCanAccessSubmissionFile` filters `candidatePlans` on
  `isPlanOpen(p.openDate, p.closeDate, now, p.timezone)` before a download is
  authorised.
- **The saved-view cap predicate IS authorship, not visibility.**
  `src/routes/api/views.ts:87` calls `countSavedViewsCreatedBy(c.var.db,
  eventId, auth.userId)` before the create-cap check, and that function
  (`src/server/repo/views.ts:137-143`) counts only rows where
  `createdByUserId` equals the caller — explicitly NOT
  `visibleToViewer`/shared rows authored by other organisers (DEC-422
  wave-10 amendment: counting shared rows here would let a handful of
  colleagues who like `shared: true` permanently lock everyone else in the
  org out of creating a view).

## ⚠ GATE-8 FINAL FLEET (2026-08-15 ~09:30, measured on c0b14342 — fix-now lane)

**P0 · COMPOSE STEP-2 DEAD-END (NEW REGRESSION, measured):** editing the compose BODY
leaves "Next: preview" enabled but non-functional — click registers, wizard never
advances, zero message. Unedited body advances fine. Eval scenarios EDIT the body; the
final run is executing against this build. Isolation incomplete (edit-vs-unknown-merge-
field confound; ready-to-run matrix at chautauqua-research/fidelity-gate8/g8-07/r18.mjs).
FIX FIRST — a post-run hotfix deploy is planned the moment scoring completes.
**P1 · compose default recipient filter pre-checks Accepted AND Declined** — the shortest
path sends "accepted" mail to declined talks. Frame: single-select pills defaulting to
Accepted.
**P1 · files-library column allocation half-fix regressed the visual:** SESSION/VERSION/
SIZE now exact (190/108/92) but FILE gets 127px while the ACTIONS column absorbs 923px
(auto-table remainder goes to the LAST unwidthed column — content.css:818's assumption is
false). One-line fix: table-layout:fixed + width on FILE (or width:1px on actions).
**P1 · templates rows' four per-row buttons make Delete UNREACHABLE** (elementFromPoint
hits the editor) — frame gives rows NO actions (they live in the editor panel); fix is
subtractive. · History tab still missing chrome (heads/chips/Export/H1) · content-status
band not full-bleed ((vw-1440)/2-34 gap; padding half fixed, margin half not) ·
content-detail still chq-measure-table (ContentApp.tsx:313) vs 1180/32.
Settings: dates 200px CLOSED, add-track CLOSED + 2 more; 8 remain (fidelity-gate8/
09-settings.md). **Process note:** gate-7 fleet agents wrote probes but never their
report.md files — gate-8 reports ARE on disk under chautauqua-research/fidelity-gate8/.

## TIER 1 — re-verified open items (orchestrator promotion, 2026-08-15 morning)

The gate-7 evidence is NOT archive-stale — it was MEASURED TODAY against boundary
ea2a5543 (a few waves behind current main): the sbek run at
killmysaas-evals/runs/2026-08-15T07-46-32/report.json (89.0 composite) and the six
fleet reports at chautauqua-research/fidelity-gate7/pair*/report.md. Note on lineage:
the vendored docs/design/*.dc.html IS the v9 pack — the research repo's
design-frames-v9 PNGs are renders of these exact files; distrust of "v9" is
misplaced.

1. **⚡ Compose-flow turn diet**: CFP-04/16 cannot_judge AGAIN today — both CFP
   scenarios capped with the compose steps eating the budget before the
   close-the-call step. Fewer clicks per compose step, default-forward selections.
   (Step-4 anatomy + dedupe landed post-boundary, and the `?ids=` handoff/step-1
   slot-column structural fixes are w8-b/w8-d, both now MERGED — see the IN
   FLIGHT correction above — the DIET half itself, beyond those structural
   fixes, remains open.) **Carried forward, owned this wave**: `task-w12-c`
   is taking the compose-diet half of this item this wave (`compose: turn
   diet — step 2 arrives composed, Enter advances 1-3`, DEC-967, commit
   `647a61b4`) — a future planner should verify against `task-w12-c`'s
   landed state before re-filing this item as untouched.
2. **CNT-S3 session-edit loop**: capped at the session-edit step again today
   (CNT-10 cannot_judge) — cheapen edit-save-reload on the admin session
   detail. **Carried forward, not owned this wave** — no branch in this
   wave's set (`task-w12-a/b/c/d/e`) claims this item; still open for a
   future wave.
3. **Gate-7 fleet remaining MAJORs** (measured `2026-08-15` morning against
   boundary `ea2a5543`, per-pair detail in `fidelity-gate7/pair*/report.md`).
   Walked sub-item by sub-item against current `main` + the vendored
   `docs/design/*.dc.html`/README pack. Nothing is deleted — a closed item
   keeps its citation so the next wave doesn't re-derive it:

   - **12-home chrome at 46px gutters + 732 body** — SUPERSEDED-BY-VENDORED-
     PACK. The `46px`/`732` figures are a `chautauqua-research` render
     measurement of a prior draft, not the current spec. The vendored pack
     states, and current `main` implements, a different rule: `docs/design/
     README.md:407-417` (`## Widths`) fixes Home in the "Reading measure"
     class at **820px, centred**, and `docs/design/README.md:78` fixes
     "Desktop frame padding `26–34px`" generally. `src/routes/public/
     home.css.ts:21` implements exactly this —
     `padding-inline: max(34px, calc((100% - 820px) / 2))` — 820px content
     measure, 34px minimum gutter, both inside the vendored 26-34px/820px
     range. This item does not re-open on the research-repo number; it
     would only re-open on a citation that `home.css.ts` deviates from the
     README rule, which it does not.
   - **07 comms step-1 SLOT/footer** — CLOSED (see IN FLIGHT above:
     `task-w8-d` MERGED; `ComposeWizard.tsx:713-716` slot column,
     `:1226-1230` footer). The remaining two clauses of this sub-item —
     "templates-grid overlap" and "history-tab chrome" — were NOT
     independently re-verified this wave (no citation found or refuted in
     the time budget); VERIFIED-OPEN, carried forward split from the
     now-closed slot/footer clause so a future wave doesn't have to re-walk
     the whole "07" bundle to find the two still-open clauses.
   - **05 files-library column swap + orphan row** — CLOSED (re-verified
     wave 16). `app/src/pages/content/FilesLibrary.tsx:252-253` renders the
     `<thead>` in `File`, `Session`, `Version`, `Size` order (the swap the
     fleet report wanted); `:340` renders the orphan row's stated text —
     `<span className="chq-content-file-no-session">No session — speaker
     headshot</span>` — for a headshot row with no submission to drill into;
     the wave-41 five-column amendment (FILE / SESSION / VERSION / SIZE /
     Download) is documented in the section's own header comment at `:52`.
     **Split from this item and left VERIFIED-OPEN, not re-checked wave
     16**: "upload-reject modal" anatomy/fidelity (an `UploadRejectedModal.tsx`
     component exists at `app/src/pages/content/UploadRejectedModal.tsx` so
     bare presence is not a gap, but the fleet complaint was about anatomy,
     not existence, and that was not re-measured) and "content-detail
     1180/32 container".
   - **04 participation panel 420 + speaker-detail grid/theads + reminders
     modal (prints localhost:8799) + write-failed banner anatomy + search
     excluded from hasActiveNarrowing** — SPLIT this wave (w17-e, boundary
     `9b21309c`):
     - **"search excluded from hasActiveNarrowing" — CLOSED.**
       `app/src/pages/speakers/OnboardingGrid.tsx:128-135`
       `hasActiveNarrowing` reads `filters.q.trim()` as one of its five
       narrowing predicates (DEC-678 amendment, w3-d, comment at `:121-127`
       explains why: `q` can empty the roster on its own, so a search miss
       must render the FILTERED empty state, not the fresh one), and the
       "filtered" empty-state escape link at `:375`
       (`clearNarrowingFacets`) resets `q` along with every other predicate.
     - **"reminders modal prints localhost:8799" — CLOSED, with a caveat.**
       No `localhost:<port>` literal exists in any application SOURCE file
       under `app/src` (no component, no reminders-modal module hardcodes a
       dev host:port string). The ONE `localhost:<port>` string anywhere
       under `app/src` is `app/src/pages/forms/FormsPage.render.test.tsx:140`
       — a test assertion on the FORMS page's public-submit-link footer
       (`Public link · <host/path> · Copy`, item 51/gate-3), asserting the
       value the component renders from the actual computed public URL in
       the test environment, not a hardcoded literal in the component
       itself. This is a different surface (Forms footer, not the reminders
       modal) and a different kind (test's expected-value string, not a
       component-source literal) than the gate-7 "reminders modal prints
       localhost:8799" complaint — closing the specific complaint, not
       asserting the substring never appears anywhere in the tree.
     - Remaining sub-clauses — "participation panel 420", "speaker-detail
       grid/theads", "write-failed banner anatomy" — NOT re-checked this
       wave beyond the earlier keyword grep that found no `420px
       participation-panel` rule under that name (`app/src/pages/comms/
       comms.css:444` is an unrelated `min-height: 420px` on a different
       component). Carried forward VERIFIED-OPEN, split from the now-closed
       clauses above.
   - **CLASS 1 admin measure 1372@114 + topbar 59 (everywhere)** — CLOSED
     (re-verified wave 16, same SUPERSEDED-BY-VENDORED-PACK pattern as
     "12-home" above). `docs/design/README.md:407-417` (`## Widths`) states
     the Table-measure rule that governs every admin list surface: **1440px,
     centred**; `:78` sets "Desktop frame padding `26–34px`" generally; `:419`
     ("Chrome is always full bleed") establishes that the 1372@114 figure —
     a `chautauqua-research` render measurement of a *container's inner
     content box* at a specific viewport, not a rule name — is not itself a
     spec target. `app/src/styles.css:109-111` declares the ONE set of shared
     tokens every admin table page consumes: `--chq-measure: 820px;
     --chq-measure-wide: 1180px; --chq-measure-table: 1440px;` (DEC-744/
     DEC-989 shared-measure tokens, comment at `:104-108`). This is gated,
     not just declared: `app/src/page-measure.test.ts` enumerates every CSS
     file and every page's `chq-page...` container class (readdirSync, no
     hand-listed manifest, DEC-808) and asserts each resolves to one of these
     three tokens. `page-measure.test.ts`'s own header comment documents the
     lineage of the `1372@114` figure directly: `// DEC-744/DEC-808/DEC-989:
     subscreens hugged the left edge of a 1372px desktop frame because each
     page hand-copied its own px max-width clamp ... v6 (DEC-989) replaces
     the single --chq-measure clamp with three` — a 1440px table-measure
     container with the vendored 34px inner padding, measured at a 1600px
     viewport, IS `1372@114` (a 1440 max-width container inset by 34px on
     each edge inside a 1600px frame lands its content box at that figure);
     the fleet report's number is a correct render measurement of the
     CURRENT three-token rule already implementing the vendored pack, not
     evidence of a gap against it. This item does not re-open on the
     research-repo number; it would only
     re-open on a citation that a live admin page deviates from the three
     README-vendored tokens, which `page-measure.test.ts` continuously
     guards against.
   - **11 AUTH_CSS .chq-field-invalid cascade inert** — CLOSED (`task-w14-d`
     MERGED, confirmed again this wave against boundary `9b21309c` — see IN
     FLIGHT REF TRUTH above). `app/src/components/error-states.css:31` and
     `src/views/error-states.css.ts:46` both now use
     `.chq-field-invalid.chq-field-invalid` (specificity `(0,2,0)`, DEC-124
     wave-14 amendment), which outranks `theme.ts`'s base
     `input[type=...], select, textarea` group (`(0,1,1)`) regardless of
     source order — the single-class selector that used to lose the cascade
     is gone from both stylesheets. `test/error-invalid-outranks-base.test.ts`
     computes CSS specificity arithmetic on both files and fails if the
     selector ever reverts to a single class.
   - **02 SESSION DETAILS label-left grid + participant chips** — CLOSED
     (re-verified wave 16). `app/src/pages/submissions/
     SubmissionDetailPage.tsx:1197-1205` renders "Session details" as a real
     always-rendered fourth numbered section (DEC-900 wave-25 amendment,
     comment at `:1197`); its fields column
     (`.chq-detail-session-details-fields`) is a label-left definition grid —
     `app/src/pages/submissions/detail.css:247-249`:
     `grid-template-columns: 150px 1fr`. Participants render as a real
     table, not chips-only prose: `:1413`
     `<table className="chq-table chq-participants-table"
     id="submission-participants-table">`, with per-row role/visible/invite-
     status actions (`PARTICIPANT_ROLE_OPTIONS`, imported `:36`). **Split
     from this item, folded into "03 FORM ANSWERS stacked" below.**
   - **03 duplicated results head + FORM ANSWERS stacked + plan-editor
     draft footer**: the "FORM ANSWERS stacked" clause is CLOSED (re-verified
     wave 16, same file as "02" above) —
     `app/src/pages/submissions/SubmissionDetailPage.tsx:1101` renders a
     "Form answers" section as a `<dl className="chq-answers-list">` of
     `dt`/`dd` pairs per field (`:1106-1127`), not stacked `h3` sub-headings;
     the section sits directly after Abstract per the DEC-908 main-column
     order (comment at `:1008`). The "duplicated results head" clause
     (`app/src/pages/review/ResultsTable.tsx`, one `<table>`/`<thead>` found
     at `:375-376` — no second `<thead>` in the file, but the fleet
     complaint's exact shape was not otherwise re-derived) and "plan-editor
     draft footer" (`app/src/pages/review/PlanEditor.tsx`, not re-checked)
     stay VERIFIED-OPEN, not re-checked wave 16.
   - **09 Add-track tertiary + CFP-edit intro/description binding +
     saved-embed single-card anatomy**, **10 active-filter ink chip + TBD
     room on public (ruling A25) + speakers toolbar right-cluster +
     underlined initials + blue avatars** — the "TBD room on public (ruling
     A25)" clause of item 10 is CLOSED this wave (boundary `9b21309c`): no
     `TBD` or `No room yet` string exists anywhere under `src/routes/public`
     (`git grep -n "TBD" -- src/routes/public` and `git grep -n "No room
     yet" -- src/routes/public` both return no matches). Note, carried from
     a prior wave, on a DIFFERENT surface: `PhoneAgenda.tsx:34,42` still has
     a `TBD` string fallback for room name on the ADMIN phone agenda (not
     the public surface this sub-item names), and
     `Agenda.render.test.tsx:366-368` asserts the desktop agenda never
     renders literal "TBD" — neither is evidence for or against the
     public-surface closure just recorded. The rest of item 9 and the rest
     of item 10 (active-filter ink chip, speakers toolbar right-cluster,
     underlined initials, blue avatars, Add-track tertiary, CFP-edit
     intro/description binding, saved-embed single-card anatomy) were NOT
     re-checked against current `main` this wave; carried forward unchanged
     as VERIFIED-OPEN. Per the standing rule, none of these may move tier on
     inheritance alone — the next wave that touches any of them needs its
     own file:line or exercised citation.

**CFP-16 is a RECORDED DELIBERATE FORFEIT** (DEC-041 findings-wave-6 amendment):
accepted speakers keep editing past close per docs/clarifications.md:39 (swyx,
highest precedence) + SPEC.md:297-298 + the portal edit frame. The orchestrator's
close-gate change was correctly reverted by the swarm. Eval accounting: CFP-16
joins ABS-14 as a deliberate forfeit (~0.5-1.1 composite ceded); the eval kit is
self-check tooling and does not outrank the customer's clarification.

## TIER 2 — unverified, candidate for re-check

The archive at `docs/mandates/findings-archive-2026-08-15.md` holds the full
prior mandate. Nothing in it should be treated as live until re-verified.
Highest-value places to start a fresh sweep (structural, likely still true,
but NOT re-checked this wave so they stay unpromoted):

- Mailer implementation and MIME-construction status (archive: "MAILER —
  USER DECISION, EVIDENCE BAR, MIME, STATUS" section) — last status was
  "REVERT LANDED, one open runtime question," gated on an orchestrator prod
  deploy the swarm cannot itself trigger.
- Design-fidelity gap classes against the currently-vendored `docs/design/
  *.dc.html` pack (settings edit-view anatomy, public register widths,
  error-vocabulary states) — the archive's classes were real defects against
  v7/v8/v9; whether they still hold against the current vendored pack and
  current `main` needs fresh measurement, not inheritance.
- The "SKIP LIST" (archive, near the end) of things not to build (AI-
  evaluation claims, nested per-round remodel, participant-level custom
  fields, per-file share links + ZIP grouping dialog, separate CRM analytics
  page, deadline extensions, contract/COI task kinds) is a standing
  negative constraint worth re-affirming even though it's archived — it
  costs nothing to keep honoring and nothing here should be built on the
  strength of an eval script alone.

## Mobile / phone queue (carried forward, own lane)

Desktop-fidelity work was the swarm's priority lane in the prior generation;
mobile work was explicitly deferred until a desktop gate that never
formally closed before the reboot. Carrying the queue forward unverified,
as its own section, per the archive's "Mobile queue (NEXT ROUND)" note:

- Phone agenda: enumerate all `chq-phone-*` classes in the media-query
  override (base `display:none`, restored only under the phone breakpoint)
  and fix `phone-block-visibility.test.ts` to assert the override side, not
  just the base — DONE, cited above (STRUCTURAL:
  `app/src/phone-block-visibility.test.ts:186-205`); N-aware clash caption —
  DONE, cited above (STRUCTURAL: `app/src/pages/agenda/PhoneAgenda.tsx:186`);
  occupied-slot "place anyway" path — DONE, cited above (STRUCTURAL:
  `app/src/pages/agenda/PhoneAgenda.tsx:167-176,199-208`).
- Phone shells: bottom fixed tab bar + inset scroll, 44px targets
  everywhere, phone landing/content parity (Comms landing content — DONE,
  cited above via the `NO_PHONE_RULE_OK` `.chq-comms-phone-landing` entry;
  phone password screen's fixed footer + Cancel — DONE, cited above
  (STRUCTURAL: `src/routes/auth.css.ts:318-336`), Home footer media rule —
  DONE, cited above (STRUCTURAL: `src/routes/public/home.css.ts:72-76`)).
  Two more items closed wave 16 (w16-b):
  - **Settings subscreens are URL state, not path routes — DELIBERATE, not
    a gap.** `app/src/pages/Settings.tsx:13-30` (DEC-728): the desktop rail
    is a static one-document scroll (no drill, no route change); below
    700px the rail becomes a full-width list and picking a section swaps in
    just that panel, driven by one piece of component state kept IN SYNC
    with the `?section=<key>&edit=1` URL param each panel's own DEC-728
    summary/edit drill already writes (`SummarySection.tsx`) — bookmarkable
    and Back-safe without ever minting a distinct `/settings/<section>`
    route. This is a documented design decision to close, not an open
    fidelity gap.
  - **Phone submissions triage cards exist.**
    `app/src/pages/submissions/submissions-phone-card.render.test.tsx`
    (DEC-610, task w14-h) renders the phone card and asserts both
    `chq-submissions-table-clone-cell` (always present) and
    `chq-submissions-table-custom` (each toggled-on custom column) are live
    class hooks, not dead selectors.
  Still open/unverified, NOT re-checked this wave: CFP 2-step wizard, roster
  screen.
- Governing principle (affirmed, still binds): mobile is additive reflow —
  a mobile change must never move a desktop pixel (scan-lock). Phone
  grammar (action bars, sheets, stacking, 44px targets) is a legitimate
  translation of desktop affordances, not something to strip in the name of
  minimalism; but a surface that has ONLY a phone frame never lets desktop
  be inferred as "phone anatomy scaled up" — desktop derives from the width
  system + affordance grammar, and any gap goes to the design-standard
  brief, not to improvisation.
- None of the above was re-measured against current `main` this wave; treat
  every item here as a starting point for the next mobile-lane sweep, not a
  closed inventory.
