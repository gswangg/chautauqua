# Eval findings — rebased 2026-08-15 (wave 31, task-w31-e)

Verified against `main` sha `6dbf711701e77e09e2df3f025de7aa0908a63676`
("merge task-w29-e"), derived AT THIS TASK'S OWN RUNTIME — not from this
task's own brief, where it disagreed with measurement — by running, in
order: `git rev-parse main`; `git for-each-ref refs/heads` (29 live
branches); `git merge-base --is-ancestor <ref> main` for every live
`task-w*` ref. COMPACTION per DEC-358's wave-27 amendment, not another
prepended header: the wave-27 header (428 lines, itself a compaction,
verified against `ceda66f2`) is replaced by this one. No per-item citation
below is deleted, only re-homed/compacted — dismissals are recorded, never
deleted.

**Correction to this task's own brief:** the brief asserted `main` is
`dbac66d1` and that `HEADSHOT_JOIN` (`files-library.ts:215`) still reads
`contact.headshot_url = '/headshots/' || file.id`. Both false as measured:
`main` is `6dbf7117`, two commits past `dbac66d1` (`00441d96` "merge
task-w29-b", `6dbf7117` "merge task-w29-e" — late re-merges of wave-29
lanes, landed after "scribe wave 31" `87c545f6`), and
`files-library.ts:246` now reads `eq(schema.contact.headshotFileId,
schema.file.id)` — `c50e56f3` landed the fix. Per this file's own standing
rule, a claim is trusted only against a citation re-run at THIS wave's own
runtime; the brief's claim fails that test. See TIER 0 and
RULED-NOT-IMPLEMENTED below for what the sweep actually found.

## Standing rules (still bind)

- **Targeted tests only, in-wave**; full suite only at merge-train
  batches/exit waves via `scripts/with-test-lock.sh`.
- **Items close on measured or runtime evidence, never a code read alone.**
- **docs/ precedence:** `docs/clarifications.md` overrides all;
  `decisions/DEC-*.md` binding, compile-checked via `src/decisions.ts`
  (never hand-edit); rest of `docs/` informs, doesn't override.
- **No eval gaming.** Rubric/fixtures inform what to build; product code
  never references fixture values or rubric IDs.
- **A mandate item moves tier only on a citation re-run at the moving
  wave's own runtime** — never inheriting a prior verdict or a brief's
  restated claim (DEC-069, DEC-976 wave-25 amendment).
- **IN FLIGHT is built from `.git` ref state at the writing task's own
  runtime** (DEC-069 wave-17 amendment). A branch whose tip equals its
  merge-base with `main` produced zero commits.
- **A recorded ruling is not a landed fix** (DEC-358 wave-31 amendment): a
  DEC amendment's argued file:line is a mandate, not a receipt — only a
  diff or an exercised check closes an item.
- **The vendored frame pack is `docs/design/*.dc.html`**; where a research
  render measurement conflicts with vendored `docs/design/README.md`, the
  README wins.

## TIER 0 — re-verified, already correct or already merged, do not re-file

### Closed this wave (task-w31-e, boundary `6dbf7117`)

- **`files library (page 1)` perf FAIL** (raw 484.4ms/adj 481.5ms vs 50ms
  budget, `docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md:67-84`)
  — CLOSED. `task-w29-b`'s real commit `c50e56f3` (ancestor of `main`)
  replaced the non-indexable `headshot_url` string-concat join with an
  indexed FK (`contact.headshot_file_id`, migration 0040) at all three call
  sites and rewrote `totalSizeBytes` as a SQL aggregate. PASS: raw
  17.7ms/adj 13.0ms — `docs/verification-log/task-w29-b-files-library-perf-c50e56f3.md`.
  Lands DEC-773's wave-29 "option 3" (real FK), not the wave-31 amendment's
  preferred "option 3b" (sargable substr) — both close the
  non-indexable-by-construction defect; 3b is PREFERRED not mandatory once
  3 ships correct, indexed behavior. Do not re-file as unfixed.
- **`onboarding grid` perf FAIL** — CLOSED. `task-w29-a`, adjusted p95
  116.1ms → 23.0ms (PASS) —
  `docs/verification-log/task-w29-a-onboarding-perf-1d274c8b.md:59-62`.
- **Render-sweep interaction-state (2/4→3/3) incl. `.chq-cfp-step-next`
  focus, and contrast (57/60→58/60)** — CLOSED. `task-w29-c`,
  `docs/verification-log/task-w29-c-render-sweep-6aa4a438.md:69-106`:
  `.chq-cfp-step-next  cfp-primary-focus  focus  PASS`; "3/3 interaction-state
  checks passed".
- **`.chq-participation-menu-caret` contrast row** — CLOSED, but NOT by
  `task-w29-c` (that receipt says it did not touch this selector; its own
  contrast pass still shows it FAIL, 2 routes, ratio 1.02). Fixed by
  `task-w29-d` (`add09a9e`, ancestor of `main`): verified in the tree at
  `app/src/pages/speakers/speakers.css:384-403`, now `color: inherit;`
  (was hard-coded `var(--chq-muted)`), DEC-830 wave-29 amendment comment
  explains inheritance from the filled `-complete` trigger reproduces
  existing colour on the four outline modifiers. Brief cited
  `event-switcher.css:61-71` — that comment documents a DIFFERENT rule
  (`.chq-eventswitcher-caret`) as the EXEMPT reference shape, not itself
  the fix; the fix is in `speakers.css`.
- **Reviewer-side perf, partial** — `task-w29-e` (`b7060152`/`09a8ba0c`,
  ancestor of `main`) parallelized the reviewer queue's 7 sequential
  post-scope reads into one `Promise.all`, reviewer-scoped
  `countEvaluationsBySubmission`, and parallelized plan-results' name-label
  batches. IMPROVEMENT, not closure: reviewer queue 66.8ms→69.7/66.6/76.1ms,
  plan results 71.8ms→60.6/74.8/61.6ms — both still FAIL 50ms —
  `docs/verification-log/task-w29-e-review-perf-b7060152.md:83-99`. Residual
  FAIL is TIER 0 OWNED below, not TIER 2.

### TIER 0 OWNED — surviving perf FAILs, assigned this wave

Baseline `docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md:67-84`
(50ms read budget; NOT yet re-measured at `6dbf7117` — `task-w29-e`'s
numbers above are the freshest evidence for the two rows it touched):

- **`reviewer queue`** 66.8ms adj (still FAIL, 66.6-76.1ms per `task-w29-e`)
  — OWNED by `task-w31-a`.
- **`plan results (page 1)`** 71.8ms adj (still FAIL, 60.6-74.8ms per
  `task-w29-e`) — OWNED by `task-w31-b`.
- `files library (page 1)` 481.5ms — CLOSED above; `task-w31-c` was its
  named owner. `task-w31-a/-b/-c` all currently point at `87c545f6`
  ("scribe wave 31") — tip carries no work yet; scope stays OWNED BY NAME
  per this task's brief until a real commit lands.

### DISMISSED review-lens/instrument alarms

- **"DEC-358 cited with no backing"** — DISMISSED, `decisions/DEC-358.md:9-11`
  carries the wave-27 compaction amendment verbatim; a decision file is its
  own backing.
- **"37 failing tests"** — DISMISSED, suite green:
  `docs/verification-log.md:3975-3977`, "Test Files 1061 passed (1061)",
  "Tests 11745 passed (11745)", bundle 69.19 kB gzip vs 300 kB budget.
- **DEC-244 "version 2" walkthrough defect** — DISMISSED, instrument bug,
  repaired, PASS twice — `docs/verification-log.md:3912-3930` (ad hoc
  `file_request` task minted+assigned same-run so no seed loop
  pre-completed it; repaired script creates both versions itself).
- **`migrations/0039_user_name.sql` untracked-file alarm** — DISMISSED,
  `docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md:15`: "all 39
  migrations (`0001`..`0039`) applied ✅" — tracked and applied.
- **"routes lacking `requireOrganizer`"** — DISMISSED, mount-guarded: admin
  sub-apps are guarded at the mount point, not re-declared per route, and
  several handlers additionally carry inline `c.var.auth.role` checks a
  route-signature grep for the literal string does not recognize — grepping
  under-reports the guarded surface by construction.

### RULED-NOT-IMPLEMENTED (DEC-358 wave-31 amendment)

Sweep result at `6dbf7117`: the seed item the wave-31 amendment named
(`task-w29-b` "zero commits") is now STALE (see correction above and TIER 0
— `c50e56f3` landed after that amendment's own measurement). Checked
`task-w29-e`'s scope the same way per this task's brief: also not a case
for this tier — it carries two real commits (`b7060152`, `09a8ba0c`), both
ancestors of `main`, and its target files changed exactly as its receipt
describes; its perf rows remain open as a measured-IMPROVEMENT FAIL (TIER 0
OWNED above), not a not-implemented ruling. No item currently qualifies for
this tier at this boundary — every DEC amendment this sweep checked
(DEC-773 wave-29/31, DEC-830 wave-29) has a landed, ref-verified fix.
Section kept (empty) so a future wave files into it rather than
re-deriving the header, and so "checked, none found" is itself a citation.

### DISMISSED-VERIFIED-CLOSED (carried, wave 24-29 boundaries, not re-checked this wave beyond ref presence)

- **`task-w29-f` "speakers toolbar right-cluster"** — VOID,
  DISMISSED-VERIFIED-CLOSED. The wave-28 gate quoted
  `docs/design/README.md:350` under the heading `:343` "Public filter bar —
  one idiom, four surfaces" (PUBLIC surfaces per `:345`), then searched the
  admin onboarding-grid toolbar — irrelevant, never named by that quote.
  The named controls are already built PUBLIC-side: `SpeakerViewToggle`
  (`src/routes/public/speakers.tsx:20-58`, `aria-current="page"`) and
  `TrackFacetSelect` (`:72-103`); verified by
  `test/public-speakers-filter-bar.render.test.ts`. Do not re-file; do not
  touch `app/src/pages/speakers/**` on this basis.
- `src/routes/tasks.ts` onboarding-grid status refuses unrecognised tokens
  — `src/routes/tasks.ts:164-209` (DEC-340 wave-18 amendment).
- `countEvaluationsBySubmission` caps `MAX_PLAN_SUBMISSION_SCAN + 1` —
  `src/server/repo/review/evaluations.ts:158-200`.
- `isSubmissionInReviewerScope` shares `resolveReviewerSubmissions`'s cap —
  `src/server/repo/review/submissions.ts:396-407` vs `:241-252`.
- `clearSessionCookie` appends `Secure` like `buildSessionCookie` —
  `src/auth/cookies.ts:31-42` vs `:26-28`.
- Public sessions LIST hydrates speakers via `visibleParticipantConditions()`
  — `src/server/repo/public/sessions.ts:405-417`.
- `isSlugTaken` has no `orgId` predicate, DELIBERATE (`/e/:slug` global
  namespace) — `src/server/repo/events.ts:141-147`.
- Seeded dates relative to one seed clock — `scripts/seed.ts:261-278`
  (DEC-591). Saved embeds exist — `src/db/schema/embed.ts`,
  `src/routes/public/saved-embed.tsx`. Per-person reminder scope on send
  and preview — `src/routes/tasks.ts:564-613` (DEC-694). EMB session-card
  speaker title/company — `src/routes/public/cards.tsx:102-116`. Reviewer
  multi-track scope renders a list, never "All tracks" —
  `src/domain/evaluation/progress.ts:39` (DEC-845). Accepted speakers keep
  editing past close — `src/domain/edit-lock.ts:22` (DEC-041, see CFP-16
  below). `npm run deploy` exists — `package.json:21`. Comms preview `.ics`
  chip formats in event's own timezone —
  `app/src/pages/comms/icsChip.ts:18-19` (DEC-494). Settings edit-view field
  widths are tokens — `app/src/pages/settings/settings.css:17-22`
  (DEC-896). `/account/password` has real Cancel + 820 bare-page column —
  `src/routes/account.tsx:139-144`. Overview §01 skips-last-hour caption —
  `app/src/pages/Overview.tsx:325`. Pipeline fit score + rationale —
  `src/domain/pipeline-fit.ts`. Portal edit-toggles —
  `app/src/pages/settings/PortalSettingsPanel.tsx:306`. Phone agenda
  N-aware clash caption — `app/src/pages/agenda/PhoneAgenda.tsx:186`.
  Phone agenda "Place here anyway" — `:167-176,199-208`. Phone-block
  override assertion — `app/src/phone-block-visibility.test.ts:186-205`.
  Phone password fixed footer + Cancel — `src/routes/auth.css.ts:318-336`.
  Comms phone landing — `app/src/phone-block-visibility.test.ts:109-121`
  (DEC-621). Home footer media rule —
  `src/routes/public/home.css.ts:72-76`.

### DO-NOT-RE-FILE (carried, waves 14-23, not re-checked this wave beyond ref presence)

Bulk-email two-stage dedupe (`src/routes/api/contacts/bulk-email.ts:214-250`,
DEC-238); `createUser` insert-then-select onConflictDoNothing
(`src/server/repo/users.ts:106-124`, DEC-552); breaks validation
accumulates, DEC-022 cross-check reached (`src/routes/api/breaks.ts:130-166`);
`send.ts`'s unconditional `bumpIcsSequences` — RULED DELIBERATE
(`src/routes/comms/send.ts:243-258`); `MAX_PARTICIPANTS_PER_SUBMISSION`
binds all four participant-writer doors
(`src/routes/api/submissions.ts:598`, `src/server/repo/portal-edit.ts:487`,
`src/routes/api/contacts/import.ts:194`,
`src/server/repo/import/sessionboard.ts:622`,
`src/server/repo/participants.ts:105,191`); mail envelope via
`addressValue` (`src/mail/email-binding.ts:236-240`); `answerFieldRoleCondition`
missing event join — DISMISSED, DEC-592 wave-18 amendment
(`src/server/repo/form-roles.ts:16`); `countEvaluationsBySubmission`'s
whole-plan map — DISMISSED, DEC-449; duplicate `trackIds` deduped on both
write doors (`src/routes/api/submissions.ts:131`,
`src/routes/public/submit-body.ts:75-79`, DEC-598); reviewer plan window on
lone-submission read + file authz (`src/routes/review/reviewer.ts:288`,
`src/server/repo/files-authz.ts:185-209`, DEC-018); saved-view cap
predicate is authorship not visibility (`src/routes/api/views.ts:87`,
`src/server/repo/views.ts:137-143`, DEC-422); `task-w14-d` AUTH_CSS
`.chq-field-invalid` cascade
(`app/src/components/error-states.css:31`, DEC-124 wave-14 amendment);
`task-w15-c/d` `updateEvent` slug guard (`src/server/repo/events.ts:224-259`,
DEC-111); `task-w15-d` sessionboard participant cap
(`src/server/repo/import/sessionboard.ts:620-627`, DEC-604); `task-w15-b`
send.ts intra-batch collapse (`src/routes/comms/send.ts:125-138`, DEC-238);
`task-w8-c` review round name+window
(`app/src/pages/review/ReviewerQueue.tsx:31,508`); `task-w8-d` compose
step-1 slot+footer
(`app/src/pages/comms/ComposeWizard.tsx:713-716,1226-1230`); `task-w8-b`
Submissions→Comms `?ids=` handoff
(`app/src/pages/submissions/BulkActionBar.tsx:77`); `task-w8-e` Comms
History pager (`app/src/pages/comms/HistoryTab.tsx:42-160`); `task-w10-b`
MERGED; `task-w17-b` perf-seed/perf-smoke harness bugs MERGED (`956fe263`);
`task-w23-e` frame-citation quoting audit MERGED (`c0fe6948`);
`task-w18-b/c/d/e/f/g` (reviewer-scope, compose defaults, History Export,
files-library table-layout, templates Delete, ENVELOPE_ALLOWLIST) all
MERGED between `956fe263` and `39ac22d0`; `task-w23-f` MERGED via
`f519f562` (DEC-902 column contract + DEC-937 review phone label).

### Verification-log walkthrough items (docs/verification-log.md:3468-3478) — all FOUR fixed, harness-side

Script bugs, not product defects: (1) `scripts/walkthrough/speaker.ts:459-467`
now asserts `chq-portal-flag-done` (DEC-366 froze "Done"/"To do"); (2)
`scripts/walkthrough/public.ts:437` now asserts
`id="chq-pub-filter-trackId"` (DEC-919 wave-40); (3)
`scripts/walkthrough/data.ts:492-497` show-flow header now includes
trailing `kind` (DEC-022 wave-66); (4)
`scripts/walkthrough/scale.ts:393-407` `readMailboxCount` now threads an
authenticated organizer cookie jar (DEC-546). Not independently re-run this
task (DOCS ONLY) — the exercised PASS/FAIL receipt is `task-w27-g`'s scope.

### Render-sweep items closed in the tree (carried, quoted)

- `/portal/tasks` measure fix — `src/routes/portal/portal.css.ts:417-430`
  (`min-width: 0` on `.chq-measure`, DEC-253 wave-25 amendment).
- `/admin/submissions` filterbar 44px floor —
  `app/src/pages/submissions/submissions.css:557-564` (DEC-253/DEC-367).

## IN FLIGHT — owned by a branch, do not re-file

Ref-measured at THIS task's own runtime against `6dbf7117` (29 refs total):

- **NO `task-w30-*` refs exist.** All eight wave-30 lanes (`a`-`g` + a
  merge-repair) are fully merged, branches deleted —
  `merge task-w30-a`..`merge task-w30-g` plus "merge repair (wave-30
  train)" all present on `main`'s first-parent line. Nothing wave-30 is
  open; do not re-file wave-30 scope (DEC-069 wave-17 amendment, now
  provably true rather than inherited).
- **`task-w31-a`, `task-w31-b`, `task-w31-c`** — all three tips equal
  `87c545f6`, their own merge-base with `main`: PRODUCED NOTHING as
  measured. OWNED BY NAME per this task's brief (see TIER 0 OWNED above),
  zero commits so far.
- **`task-w31-d`** — tip `4297b6d4`, real commits ("perf-smoke: resolve
  plan/reviewer fixtures from PERF_PROFILE (DEC-644 w31)" +
  verification-log receipt). UNMERGED. OWNED, not further triaged (DOCS
  ONLY scope this task).
- **`task-w17-i`** (`7b78d8b6`) — STILL UNMERGED, unchanged across many
  waves: "Sign-in page names the event and its open CFP (DEC-716)." Very
  stale; needs a fresh boundary before re-attempt.
- **Every other live ref** — `mail-rich-shape-fallback`, `manual-qa`,
  `task-custodian-w68-4`, `task-w68-b/c/d/e`, `task-w71-a/c/d/e`,
  `task-w72-a`-`j` — all UNMERGED but belong to waves numbered ahead of
  wave 31 (68/71/72), a different/later campaign. Flagged, not triaged.

### TIER-1 pointer — `task-w27-g` owns fidelity-recheck verdicts, cite as OWNED

Carried unresolved from wave 27: the expected
`docs/verification-log/task-w27-g-fidelity-recheck-*.md` does not exist;
the file actually present is `task-w27-g-stage1-ledger.md` (325 lines,
stage-1 completion accounting, NOT a TIER-1 fidelity walk). Not re-checked
this task; next TIER-1 touch should re-glob rather than trust either note.

## TIER 1 — open items (gate-7 evidence, boundary `ea2a5543`; not re-derived this wave)

1. Compose-flow turn diet — structural fixes MERGED
   (`task-w8-b`/`task-w8-d`); diet half `task-w12-c`/`647a61b4`/DEC-967 —
   verify landed state before re-filing.
2. CNT-S3 session-edit loop — not owned by any wave-27+ lane.
3. Gate-7 fleet MARJORs, walked sub-item by sub-item (nothing deleted):
   12-home chrome — CLOSED, SUPERSEDED-BY-VENDORED-PACK
   (`docs/design/README.md:407-417`, `src/routes/public/home.css.ts:21`).
   07 comms step-1 SLOT/footer — CLOSED (`task-w8-d`); templates-grid
   overlap/history-tab chrome sub-clauses VERIFIED-OPEN (History-tab owned
   by `task-w18-f`'s Export door, `src/routes/api/exports.ts:120-147` —
   verify landed UI before re-filing). 05 files-library column swap +
   orphan row — CLOSED (`app/src/pages/content/FilesLibrary.tsx:252-253,340`);
   upload-reject modal / content-detail container sub-clauses
   VERIFIED-OPEN. 04 participation/speaker-detail — "search excluded from
   hasActiveNarrowing" CLOSED
   (`app/src/pages/speakers/OnboardingGrid.tsx:128-135`, DEC-678);
   "reminders modal localhost:8799" CLOSED (no literal under `app/src`);
   remaining sub-clauses VERIFIED-OPEN-NOT-RECHECKED. CLASS 1 admin measure
   — CLOSED, SUPERSEDED-BY-VENDORED-PACK (`app/src/styles.css:109-111`,
   DEC-744/989). 11 AUTH_CSS cascade — CLOSED (`task-w14-d`). 02 SESSION
   DETAILS label-left grid — CLOSED
   (`app/src/pages/submissions/SubmissionDetailPage.tsx:1197-1205,1413`).
   03 FORM ANSWERS stacked — CLOSED (`:1101,1106-1127`); results-head/
   plan-editor footer sub-clauses VERIFIED-OPEN-NOT-RECHECKED. 09/10 —
   "TBD room public" CLOSED (no literal under `src/routes/public`); CFP-edit
   intro/description binding — likely CLOSED via `submit-views.tsx:421-431`
   (DEC-976 wave-25 amendment), not independently re-read this task;
   remaining sub-clauses VERIFIED-OPEN-NOT-RECHECKED; "speakers toolbar
   right-cluster" moved to TIER 0 DISMISSED-VERIFIED-CLOSED (see above).

**CFP-16 — RECORDED DELIBERATE FORFEIT** (DEC-041): accepted speakers keep
editing past close per `docs/clarifications.md:39` + `SPEC.md:297-298`.
Joins ABS-14 as a deliberate forfeit (~0.5-1.1 composite ceded).

## TIER 2 — unverified, candidate for re-check

Archive: `docs/mandates/findings-archive-2026-08-15.md`. Highest-value
starting points: mailer implementation/MIME-construction status (gated on
an orchestrator prod deploy the swarm cannot itself trigger); design-fidelity
gap classes vs the vendored pack (settings edit-view anatomy, public
register widths, error-vocab states) — needs fresh measurement; the SKIP
LIST (AI-evaluation claims, nested per-round remodel, participant-level
custom fields, per-file share links + ZIP grouping dialog, separate CRM
analytics page, deadline extensions, contract/COI task kinds) — standing
negative constraint, costs nothing to keep honoring.

## Mobile / phone queue (carried forward, own lane, not re-measured this wave)

Desktop fidelity was priority; mobile deferred. Done items cited (STRUCTURAL,
listed in DISMISSED-VERIFIED-CLOSED above): phone-block-visibility override
assertion, N-aware clash caption, "place here anyway" path, Comms phone
landing, phone password fixed footer + Cancel, Home footer media rule.
Additional: Settings subscreens are URL state not path routes, DELIBERATE
(`app/src/pages/Settings.tsx:13-30`, DEC-728); Phone submissions triage
cards exist (`app/src/pages/submissions/submissions-phone-card.render.test.tsx`,
DEC-610). Still open/unverified: CFP 2-step wizard, roster screen.

**Governing principle (affirmed, still binds):** mobile is additive
reflow — a mobile change must never move a desktop pixel (scan-lock).
Phone grammar (action bars, sheets, stacking, 44px targets) is a legitimate
translation of desktop affordances; a phone-only surface never lets
desktop be inferred from it.
