# Eval findings — rebased 2026-08-15 (wave 41, task-w41-f)

Verified against `main` sha `b71a1358825778f0f824673794b6b626351eec33`
("merge task-w41-c"), derived AT THIS TASK'S OWN RUNTIME by running, in
order: `git rev-parse main` (loose ref wins — see trap note below);
`git log -1 --format='%H %s' HEAD` on `main`; `npm run ref-state`
(`scripts/ref-state.ts`, DEC-644) for the live-ref ancestry paragraph;
`git for-each-ref refs/heads` (30 live branches) plus
`git merge-base --is-ancestor <ref> main` for every one; and
`.git/logs/refs/heads/<branch>` for each wave-40/41 lane's creation
timestamp and commit message. **Trap reconfirmed, still live:**
`.git/packed-refs` carries a STALE `refs/heads/main` entry at
`4207460470b672176e119ed3502d08d869489509` — the loose ref
(`.git/refs/heads/main`, `b71a1358`) overrides it and is the one `git
rev-parse main` actually returns; do not read the packed line as current.
**Glob trap reconfirmed:** globbing `.git/refs/heads/*` on disk misses
packed refs entirely — use `git for-each-ref refs/heads`. `ref-state`'s
receipt, verbatim: DEC-644 three-sha boundary — HEAD
`b71a1358825778f0f824673794b6b626351eec33`; newest first-parent
product-code-bearing sha `ed5c679e59828c5600cb84b51208056f7e38a445`; every
live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w40-e`,
`task-w40-g`, `task-w41-c`, `task-w41-d`, `task-w41-e`, `task-w41-f`,
`task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an
ancestor of HEAD via `git merge-base --is-ancestor`; NON-ancestor refs
(unmerged or a different/later campaign): `mail-rich-shape-fallback`,
`task-w17-i`, `task-w41-a`, `task-w41-b`, `task-w68-b`, `task-w68-c`,
`task-w68-e`, `task-w71-a`, `task-w72-a`..`task-w72-j`.

COMPACTION per DEC-358's rebase rule: the wave-37 header (boundary
`494b6c01`) is REPLACED by this one, not prepended. No per-item citation
below is deleted, only re-homed/compacted — dismissals are recorded, never
deleted. Every "file X exists / does not exist" claim carried from the
prior header was re-globbed before being carried; none were found false
this wave: `docs/verification-log/task-w27-g-fidelity-recheck-ceda66f2.md`
re-confirmed present; `src/db/schema/embed.ts`,
`src/routes/public/saved-embed.tsx` (saved embeds) re-confirmed present;
`app/src/pages/submissions/submissions-phone-card.render.test.tsx`
(phone triage cards) re-confirmed present; `src/routes/public/cfp-steps-script.tsx`
and `app/src/pages/speakers/RosterPanel.tsx` +
`RosterPanel.render.test.tsx` (CFP 2-step wizard, roster screen)
re-confirmed present; the two "no literal under `app/src`" /
"no literal under `src/routes/public`" absence claims (`localhost:8799`,
`TBD`) re-confirmed absent (zero grep matches each).

**This wave's own addition:** wave 41 landed no product code of its own
(FROZEN per DEC-069's wave-41 amendment — every wave-41 lane writes only
under `docs/**`, `scripts/**`, `test/**`, `decisions/**`, `field-guide/**`),
but the tree it now sits on is far ahead of the wave-37 boundary this file
carried until this rebase: all six of wave 40's gate lanes
(`task-w40-a` build+test+bundle, `-b` walkthrough, `-c` perf-smoke, `-d`
spec-audit, `-e` render-sweep, `-f` exit-predicate-corpus-test) are now
MERGED ancestors of `main`, and four review-lens alarms plus the
`task-w17-i`/DEC-716 scope plus the plans-progress `total` question — all
flagged UNFALSIFIABLE or IN FLIGHT as of the wave-37 boundary — are
CLOSED this wave with fresh file:line + test citations (see DISMISSED
review-lens/instrument alarms below). Every closed TIER 0 CLOSED row
below still carries the EXERCISED check that would fail if its fix were
reverted (DEC-358 wave-37 amendment); a row whose only backing is a
code-shape citation is still labelled `UNFALSIFIABLE` and KEPT, not
deleted, with its owner re-pointed at the wave-41 lane now assigned it.

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
  merge-base with `main` produced zero commits — UNLESS it was created
  within this same wave and may still be running (DEC-069 wave-37
  amendment): check `.git/logs/refs/heads/<branch>`'s creation timestamp
  against sibling lanes before calling it dead.
- **A recorded ruling is not a landed fix** (DEC-358 wave-31 amendment): a
  DEC amendment's argued file:line is a mandate, not a receipt — only a
  diff or an exercised check closes an item.
- **A branch-local PASS is not a closure** (DEC-644 wave-35 amendment): a
  perf/sweep row moves out of FAIL only on a reading taken at a boundary
  that contains EVERY fix credited with closing it; two lanes each
  measuring their own fix with the sibling fix absent produce two PASS
  readings and zero readings of the tree that actually shipped.
- **A closed TIER 0 row names its falsifying check** (DEC-358 wave-37
  amendment): a code-shape citation alone is not a closure backing; label
  it `UNFALSIFIABLE — owner: wave-38 lane` and keep it, don't delete it.
- **An absence is a measurement, not a note to carry** (DEC-358 wave-35
  amendment): a rebase re-globs every "file X does not exist" claim before
  carrying it; an existence claim that survives a rebase unre-globbed is
  DELETED rather than carried forward. Same applies to ref-existence
  claims — a `.git/packed-refs` stale entry is a live trap, not a citation.
- **The vendored frame pack is `docs/design/*.dc.html`**; where a research
  render measurement conflicts with vendored `docs/design/README.md`, the
  README wins.

## TIER 0 — re-verified, already correct or already merged, do not re-file

### Closed, carried (boundary `0db68e36`, re-verified present on `494b6c01`)

- **`files library (page 1)` perf FAIL** (raw 484.4ms/adj 481.5ms vs 50ms
  budget, `docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md:67-84`)
  — CLOSED. `task-w29-b`'s real commit `c50e56f3` (ancestor of `main`)
  replaced the non-indexable `headshot_url` string-concat join with an
  indexed FK (`contact.headshotFileId`, `src/db/schema/org.ts:72,98`) at all
  three call sites and rewrote `totalSizeBytes` as a SQL aggregate.
  FALSIFYING CHECK: `docs/verification-log/task-w36-c-perf-smoke-f5783479.md`
  — reconfirmed 3-of-3 PASS at `f5783479` (adj 16.8/12.0/15.7ms), the newest
  measurement of this row. Lands DEC-773's wave-29 "option 3" (real FK); do
  not re-file as unfixed.
- **`onboarding grid` perf FAIL** — CLOSED. `task-w29-a`, adjusted p95
  116.1ms → 23.0ms (PASS). FALSIFYING CHECK: reconfirmed 3-of-3 PASS at
  `f5783479` in `task-w36-c`'s perf-smoke run (adj 38.0/24.0/37.7ms),
  `docs/verification-log/task-w36-c-perf-smoke-f5783479.md`.
- **Render-sweep interaction-state (2/4→3/3) incl. `.chq-cfp-step-next`
  focus** — CLOSED. `task-w29-c`. FALSIFYING CHECK:
  `docs/verification-log/task-w36-e-render-sweep-f5783479.md` — the
  wave-36 `task-w36-e` fresh full-gate render-sweep run scored
  interaction-state `3/3` with zero FAIL rows at `f5783479`, third
  independent reconfirmation after `task-w29-c` and `task-w35-b`.
- **`.chq-participation-menu-caret` contrast row** — CLOSED, RELABELLED
  falsifiable this wave. `task-w29-d` (`add09a9e`, ancestor of `main`):
  `app/src/pages/speakers/speakers.css:405`, `color: inherit;` (was
  hard-coded `var(--chq-muted)`). Prior wave's caveat is RESOLVED, not
  carried as a caveat: `task-w35-b`'s wave-35 finding that the gate had NO
  contrast row for this selector was itself CLOSED by `task-w36-e`
  (`docs/verification-log/index/0188-2026-08-15-task-w35-b-render-sweep-a0b8501b.md:29-39`
  cites the gap; `docs/verification-log/task-w36-e-render-sweep-f5783479.md`
  closes it). `task-w36-e` added `NAMED_CONTRAST_SELECTOR` to
  `scripts/render-sweep-contrast.ts:43` and an in-page contrast probe to
  `scripts/render-sweep.ts`, then ran the gate: `[NAMED-PAIR
  .chq-participation-menu-caret: ... ratio=6.82 ... PASS]` on both
  `/admin/speakers` and `/admin/speakers/seed_contact_0001`, clearing WCAG
  AA's 4.5:1 minimum with margin. FALSIFYING CHECK:
  `test/render-sweep-contrast.test.ts` (asserts the `NAMED_CONTRAST_SELECTOR`
  named-pair machinery; 18/18 passed at `f5783479`) plus the gate row itself
  — this selector now has both a unit-test-backed instrument and a runtime
  gate reading, not a code-shape citation alone.

### TIER 0 OWNED — perf rows, resolved this wave

Per DEC-644's wave-35 amendment, a row closes only on a single `perf:smoke`
run timing it at a boundary containing every credited fix. **This wave finds
that run:** `task-w36-e`'s ANCESTOR check confirms `task-w36-c` (HEAD
`f5783479`) is an ancestor of every live wave-36 sibling, and `task-w36-c`'s
own perf-smoke entry (`docs/verification-log/task-w36-c-perf-smoke-f5783479.md`)
confirms both `74c6377a` (`task-w32-b`, `reviewer.ts`) and `904dd3d8`
(`task-w32-a`, `shared.ts`/`plans-progress.ts`) as proven ancestors of that
same HEAD, and times BOTH mandate rows in the same three-run sequence. This
IS the merged-boundary reading DEC-644 wave-35 required — not a brief's
restated claim, a citation re-run at this wave's own runtime.

- **`plan results (page 1)`** — CLOSED. `task-w36-c`'s run at `f5783479`:
  3 of 3 PASS (adj 30.6/19.5/25.7ms) vs the 50ms budget, with both credited
  fixes (`74c6377a`, `904dd3d8`) proven ancestors of the reading boundary —
  the exact joint-boundary reading DEC-644 wave-35 demanded. FALSIFYING
  CHECK: `docs/verification-log/task-w36-c-perf-smoke-f5783479.md`
  ("plan results (page 1)" row).
- **`reviewer queue`** — STAYS OPEN, now a REGRESSION finding rather than an
  ownership gap. `task-w36-c`'s run at the SAME joint boundary (`f5783479`,
  both `74c6377a` and `904dd3d8` ancestors): run1 raw 54.2/adj 51.5ms FAIL,
  run2 raw 36.5/adj 34.1ms PASS, run3 raw 58.5/adj 55.3ms FAIL — 1 of 3 PASS
  vs the 50ms budget, markedly less stable than `task-w35-a`'s earlier 3-of-3
  PASS at the same fix set. This is now a joint-boundary reading (the
  ownership question DEC-644 wave-35 raised is answered: the boundary
  exists, and at it the row FAILs), not a missing-reading gap. FINDING
  (logged by `task-w36-c`, not fixed): `src/routes/review/reviewer.ts`'s
  `GET /api/v1/review/plans/:id/queue` handler now straddles the 50ms
  budget line. OWNED BY NAME by no lane; next wave should re-measure or
  investigate the straddle, not re-file the ownership question as unsettled
  — it is settled (FAIL, not "no reading yet"). Deleted this wave: the
  `task-w35-a` OWNED-BY-NAME line — superseded by the joint reading above.
  **Wave-41 rebase note: STAYS OPEN, not graded from prose this task.**
  `docs/verification-log/task-w40-c-perf-smoke-2e99b272.md` shows a newer
  3-of-3 PASS at `2e99b272` (raw 25.4/25.4/27.1ms, adj 22.9/23.0/24.8ms),
  a visible improvement over the 1-of-3 PASS above — but this rebase task
  is docs-only and does not itself own the closing verdict; per this
  task's own instruction, ownership of the closing measurement for this
  row stays with wave-40's perf-smoke lane (`task-w40-c`), which is the
  one that ran it. Whether `2e99b272` constitutes the DEC-644 joint
  boundary (every credited fix an ancestor) is for that lane's own report
  to state, not this file.

### DISMISSED review-lens/instrument alarms

- **Bare-email login-account budget locks the real owner out** — DISMISSED
  this wave, FIXED in-tree. `src/routes/auth-helpers.ts:69`
  (`AUTH_ACCOUNT_RATE_LIMIT_MAX`) + `src/routes/auth-login.tsx:79-135`
  (DEC-072 wave-38 amendment): the bare-email `login-account` bucket is now
  a SOFT failure budget, not an admission gate — exhausting it forces a
  WRONG password to 429 instead of 401, while the CORRECT password still
  succeeds, so a stranger who merely knows the victim's address can no
  longer lock the real owner out with no unlock path. Re-read directly at
  `b71a1358`; not a code-shape guess.
- **`api/users.ts` routes reachable without a cookie session** — DISMISSED
  this wave, FIXED in-tree. `src/routes/api/users.ts:67,138,168` — the
  list, create, reset-password and role-patch handlers all carry
  `requireCookieSession` alongside `requireOrganizer`/`csrfJson`.
  FALSIFYING CHECK: `test/users-bearer-containment.test.ts`,
  `test/credential-route-cookie-session.scan.test.ts` (a scan-lock, so a
  future route added without the guard fails it too, not just these four).
- **Task-reminder due-day label drifts from the shared helper** —
  DISMISSED this wave, FIXED in-tree.
  `src/server/repo/tasks/reminders.ts:29,148` imports and calls the shared
  `effectiveAssignmentDueDayLabel` (`src/domain/task-due.ts`) rather than
  a local recompute. FALSIFYING CHECK: `test/task-due.test.ts`.
- **`rule-match.ts` silently resolves an unknown rule op** — DISMISSED
  this wave, FIXED in-tree. `src/forms/rule-match.ts:145` throws
  `Error('unknown rule op: ' + rule.op)` rather than falling through to a
  default. FALSIFYING CHECK: `test/forms-rule-match.test.ts`.
- **`task-w17-i` (DEC-716, sign-in names the event and its open CFP)** —
  DISMISSED as an open scope, LANDED BY ANOTHER PATH. The literal
  `task-w17-i` branch (`7b78d8b6`) is still unmerged and stale, but its
  scope shipped via a different lane:
  `loadSingleEventContext` (`src/routes/auth-helpers.ts:98-106`) is
  consumed at all three `LoginPage` render sites in
  `src/routes/auth-login.tsx:50,146,169,198`. Re-read directly at
  `b71a1358`. Moved from IN FLIGHT to here — do not re-file the scope, and
  do not resurrect the `task-w17-i` branch on the strength of the old
  "OWNED BY" line.
- **Wave-39 plan-progress rewrite undercounts `total`** — DISMISSED this
  wave, review-lens question re-read and found FALSE.
  `src/routes/review/plans-progress.ts:129-131` computes
  `const total = users.length;` BEFORE `users.slice(start, start + perPage)`
  runs — `total` still reads the full reviewer set, never the paged
  slice's length. The wave-39 fan-out-kill refactor (DEC-829) did not
  change this semantic.
- **"DEC-358 cited with no backing"** — DISMISSED, `decisions/DEC-358.md:9-11`
  carries the wave-27 compaction amendment verbatim; a decision file is its
  own backing.
- **"37 failing tests"** — DISMISSED, suite green, reconfirmed at `f5783479`
  by `task-w36-a`: `docs/verification-log/task-w36-a-build-test-f5783479.md`
  — "Test Files 1084 passed (1084)", "Tests 11898 passed (11898)", bundle
  69.20 kB gzip vs 300 kB budget.
- **DEC-244 "version 2" walkthrough defect** — DISMISSED, instrument bug,
  repaired, PASS twice — `docs/verification-log.md:3912-3930` (ad hoc
  `file_request` task minted+assigned same-run so no seed loop
  pre-completed it; repaired script creates both versions itself).
- **`migrations/0039_user_name.sql` untracked-file alarm** — DISMISSED,
  `docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md:15`: "all 39
  migrations (`0001`..`0039`) applied ✅" — tracked and applied. Migration
  count reconfirmed current: `task-w36-b`'s walkthrough ran `db:migrate` to
  43 migrations at `f5783479` clean.
- **"routes lacking `requireOrganizer`"** — DISMISSED, mount-guarded: admin
  sub-apps are guarded at the mount point, not re-declared per route, and
  several handlers additionally carry inline `c.var.auth.role` checks a
  route-signature grep for the literal string does not recognize — grepping
  under-reports the guarded surface by construction.
- **"`.chq-participation-menu-caret` contrast row has no gate check"** —
  RESOLVED, not just dismissed. `task-w35-b` found the gap; `task-w36-e`
  built the gate row and closed it (see TIER 0 CLOSED entry above). Do not
  re-file.

### STALE-ON-MEASUREMENT (do not re-file — closed, re-checked this wave)

- **`.chq-review-checkbox-label` contrast** ratio 3.09 — NOT a live defect.
  Closed via DEC-426's wave-29 exemption path: an inactive-component
  disabled-token pair (`--chq-disabled` on `--chq-disabled-bg`) is exempt
  under WCAG 2.1 SC 1.4.3, recorded as `EXEMPT-BY-RULE` rather than a FAIL
  — `scripts/render-sweep-contrast.ts:77-84,112-115` (the `exempted`/
  `exemptNote` fields), asserted by `test/render-sweep-contrast.test.ts:61`.
  Reconfirmed present in `task-w36-e`'s wave-36 fresh full-gate run at
  `f5783479` (contrast `60/60`, advisory, zero FAIL rows).
- **Mobile render-sweep console-error collection** — CLOSED, DEC-253
  wave-30 amendment: `scripts/render-sweep.ts:1023-1032` attaches the same
  `console`/`pageerror` collectors to the phone-viewport pass that the
  desktop pass already had, because a phone-only component (e.g.
  `PhoneAgenda`) mounts only at 390px and the desktop pass never observed
  its errors. Not a live gap.
- **Chunked/absent-`Content-Length` `application/x-www-form-urlencoded` and
  `multipart/form-data` body refusal** — CLOSED, DEC-020 wave-30 amendment
  (body-limit ceiling): `src/server/body-limit.ts:30-55` refuses an absent
  `Content-Length` for exactly those two content-types (buffered whole
  BEFORE auth by `csrfForm`'s `c.req.parseBody()`,
  `src/server/middleware.ts:283`), leaving JSON/other bodies (read only
  inside handlers behind `requireRole`/`csrfJson`) unrestricted by design —
  not a live gap.
- **`logoUrl` XSS** — CLOSED via `safeImageSrc`
  (`src/domain/brand-url.ts:25`), applied at the portal settings read door
  (`src/server/repo/portal/data.ts:167`) — rejects non-`http(s)`/`data:`
  image sources before they reach a self-hosted branding `<img src>`. Not a
  live gap.
- **Content-note zero-recipient 400** — CLOSED, DEC-317/DEC-720 wave-30
  amendment: `src/routes/content-notes.ts:8` — zero recipients is
  deliberately not an error (the durable content-status write proceeds
  regardless of whether any recipient exists to notify). Not a live gap.
- **AUDIT.md compose recipient cap claim** — CLOSED, DEC-618: `docs/AUDIT.md`
  previously mis-stated the compose cap as `MAX_PER_PAGE=200`; the real
  cap is `MAX_COMPOSE_RECIPIENTS = 100`
  (`src/domain/compose.ts:9`, enforced at
  `src/routes/comms/compose-core.ts:107-109`). The doc was corrected, and
  `test/audit-claims.test.ts` now resolves every `METHOD /path` backtick
  span against the composed route table so a future drift fails a test
  instead of sitting silently. Not a live gap.
- **Acceptance task fan-out** (one task minted per accepted participant
  rather than one per submission) — DELIBERATE, DEC-932. Not a live gap.

### RULED-NOT-IMPLEMENTED (DEC-358 wave-31 amendment)

No item currently qualifies for this tier at this boundary (`494b6c01`) —
every DEC amendment checked across waves 29-37 (DEC-773 wave-29/31, DEC-830
wave-29, DEC-829 wave-32, DEC-644 wave-31/32/35/36/37, DEC-099 wave-35,
DEC-426 wave-36) has either a landed, ref-verified fix or, as of this wave,
a resolved joint-boundary reading (see TIER 0 OWNED above — both rows now
have a verdict, one CLOSED and one a confirmed FAIL/regression, neither is
"zero commits" or "no reading yet"). Section kept (empty) so a future wave
files into it rather than re-deriving the header, and so "checked, none
found" is itself a citation.

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
  — `src/routes/tasks.ts:164-213` (DEC-340 wave-18 amendment).
  FALSIFYING CHECK (wave-39, DEC-358): `test/onboarding-grid-query.test.ts` —
  opened and confirmed it exercises `parseOnboardingGridQuery` directly
  (not the route), asserting (a) a lone unrecognised `status` throws
  `ApiError('invalid')` with `fields.status` set, (b) a lone unrecognised
  `overdueOnly` token throws the same shape, and (c) `status: "bogus"` +
  `inviteStatus: "nope"` together throw ONE `ApiError` whose `fields` names
  BOTH `status` AND `inviteStatus` — i.e. the accumulate-both-bad-tokens
  shape at `:208-210` is covered, not just the single-bad-token case.
  Reverting the accumulate-then-throw block to a first-bad-token-wins throw
  would fail the two-bad-tokens assertion.
- `countEvaluationsBySubmission` caps `MAX_PLAN_SUBMISSION_SCAN + 1` —
  `src/server/repo/review/evaluations.ts`. FALSIFYING CHECK (wave-39,
  DEC-358): `test/review-repo-aggregates.test.ts`'s
  "refuses past MAX_PLAN_SUBMISSION_SCAN distinct submissions, in submission
  vocabulary" — builds `MAX_PLAN_SUBMISSION_SCAN + 1` distinct-submission
  fixture rows through a fake db that recovers and applies the repo
  function's actual drizzle `where` bindings, then asserts the call rejects
  with an `ApiError` whose message contains
  `"more than {cap} submissions"`. Reverting the cap check would resolve
  instead of reject.
- `isSubmissionInReviewerScope` shares `resolveReviewerSubmissions`'s cap —
  `src/server/repo/review/submissions.ts:396-407` vs `:241-252`. This claim
  was FALSE AS AN "already covered" claim: every existing call site that
  imports `isSubmissionInReviewerScope` (`review-idor.test.ts`,
  `admin-list-bounds-review.test.ts`, `eval-scorecard-caps.test.ts`, and
  others) mocks the function rather than exercising its real cap-refusal —
  a revert of the `:401-407` cap check would have passed every test in the
  tree silently before this wave. WRITTEN this wave:
  `test/tier0-falsifiability.test.ts` — asserts, against the real function
  and the real `MAX_REVIEWER_SCOPE_ROWS` constant, that (a) a plan_reviewer
  read of `MAX_REVIEWER_SCOPE_ROWS + 1` rows rejects with an `ApiError`
  naming the cap, (b) exactly-at-cap resolves without throwing. Observable
  behavior only (thrown error + message), never query shape/call order, per
  this wave's co-ownership note with task-w39-d/e.
- `clearSessionCookie` appends `Secure` like `buildSessionCookie` —
  `src/auth/cookies.ts:32-44` vs `:18-30`. FALSIFYING CHECK (wave-39,
  DEC-358): `test/cookie-flags.test.ts`'s `clearSessionCookie` describe
  block — asserts (a) `secure:false` omits `Secure` entirely, (b)
  `secure:true` appends `; Secure` as the last attribute, and (c) a direct
  attribute-name-order comparison against `buildSessionCookie({secure:true})`
  (minus the token/Max-Age value) so the two builders' Secure-placement
  can't silently drift apart. Reverting either builder to unconditionally
  omit/include `Secure` fails (a)/(b); reordering one relative to the other
  fails (c).
- Public sessions LIST hydrates speakers via `visibleParticipantConditions()`
  — `src/server/repo/public/sessions.ts:405-417`. FALSIFYING CHECK (wave-39,
  DEC-358): `test/public-invite-visibility.test.ts`'s "the hydrateSessions
  speaker-hydration query gates on visibleParticipantConditions()" — slices
  `hydrateSessions`'s body around its `schema.participant.submissionId,
  batch` call site and asserts the literal `visibleParticipantConditions()`
  call appears in that slice (not merely present anywhere in the file).
  Removing the call from that query's `.where(...)` (even while leaving the
  function/import elsewhere) fails this. Weaker than a runtime probe, but
  pinned to the actual call site, so a revert of THIS behavior (not just
  deletion of the function) is caught; `test/participant-invite-audience.scan.test.ts`'s
  scan-lock backs this further (a marker-less rewrite of the query fails
  that scan too), cited as supporting, not primary.
- `isSlugTaken` has no `orgId` predicate, DELIBERATE (`/e/:slug` global
  namespace) — `src/server/repo/events.ts:141-147`. DELIBERATE-BY-DESIGN,
  not a defect; falsifiability n/a.
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
  `src/routes/public/home.css.ts:72-76`. This whole block:
  UNFALSIFIABLE — owner: wave-41 lanes d/e — discharge evidence in docs/mandates/w41-falsifiability-batch-a.md and -batch-b.md (same wave, may land after this file) (batch of code-shape citations, no
  per-item exercised check named; several already have adjacent test files
  cited inline — e.g. `app/src/phone-block-visibility.test.ts` — those
  sub-items are exempt from the UNFALSIFIABLE label, the rest are not).
  Wave-39 (DEC-358) spot-checked and PULLED TWO items out of this batch as
  genuinely discharged, cheapest-first, in the time available; the rest of
  the batch is untouched and still needs the same per-item treatment:
  - **Accepted speakers keep editing past close** (`src/domain/edit-lock.ts:22`,
    DEC-041) — FALSIFYING CHECK: `test/edit-lock.test.ts` — opened and
    confirmed it directly asserts `canEditSubmission("accepted", PAST_CLOSE,
    NOW, LA)` is `true` (labelled "DEC-041 amendment, wave 6") while the
    sibling `"pending" + closed` case is `false` — the accepted-stays-open
    carve-out is exercised against its own negative control, not just
    asserted in isolation.
  - **Pipeline fit score + rationale** (`src/domain/pipeline-fit.ts`) —
    FALSIFYING CHECK: `test/pipeline-fit.test.ts` — opened and confirmed
    `sortByFit` (descending by score, null/unrated last, non-mutating) and
    `validateFitScore`/`validateRationale` (integer 1-5 or null; bounded
    text or null; throw a named `ApiError` field rather than coerce) are
    each exercised directly against the real functions, not a shape guess.
- **DEC-099 wave-35 Vary: Cookie population + fix** — `task-w35-c`
  (`beb58e29` at filing, MERGED as of this wave — `3a041507` on `main`'s
  first-parent line per `task-w36-a`/`task-w36-b`/`task-w36-c`/`task-w36-e`'s
  shared "merge task-w35-c" citation): built
  `test/public-cacheability-enumeration.test.ts`, enumerating every GET
  route under `/e/*`, `/embed/*` and `/` and asserting `Cache-Control !=
  no-store <=> Vary: Cookie`; found and fixed a real violation in
  `publicNotFound`/`publicErrorDocument`/`publicRoutes.onError`. CLOSED —
  no longer a pointer, the fix is confirmed landed and merged.
  FALSIFYING CHECK: `test/public-cacheability-enumeration.test.ts`.

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
`f519f562` (DEC-902 column contract + DEC-937 review phone label). This
whole block: UNFALSIFIABLE — owner: wave-41 lanes d/e — discharge evidence in docs/mandates/w41-falsifiability-batch-a.md and -batch-b.md (same wave, may land after this file) (not touched this wave;
time went to the higher-priority named rows above), except items that
already cite a test file inline (e.g. `test/audit-claims.test.ts`-adjacent
items elsewhere in this doc).

### Verification-log walkthrough items (docs/verification-log.md:3468-3478) — all FOUR fixed, harness-side

Script bugs, not product defects: (1) `scripts/walkthrough/speaker.ts:459-467`
now asserts `chq-portal-flag-done` (DEC-366 froze "Done"/"To do"); (2)
`scripts/walkthrough/public.ts:437` now asserts
`id="chq-pub-filter-trackId"` (DEC-919 wave-40); (3)
`scripts/walkthrough/data.ts:492-497` show-flow header now includes
trailing `kind` (DEC-022 wave-66); (4)
`scripts/walkthrough/scale.ts:393-407` `readMailboxCount` now threads an
authenticated organizer cookie jar (DEC-546). FALSIFYING CHECK: the
`task-w36-b` wave-36 walkthrough re-run at `f5783479`
(`docs/verification-log/task-w36-b-walkthrough-f5783479.md`) exercised all
six areas including `data`/`scale` PASS with zero FAIL lines — the harness
fixes are live-exercised, not merely present in source.

### Render-sweep items closed in the tree (carried, quoted)

- `/portal/tasks` measure fix — `src/routes/portal/portal.css.ts:417-430`
  (`min-width: 0` on `.chq-measure`, DEC-253 wave-25 amendment).
  DISCHARGED this wave (DEC-358): re-read the gate this task was asked to
  weigh, `scripts/render-sweep.ts`/`scripts/render-sweep-lib.ts`'s DEC-253
  mobile pass. `/portal/tasks` IS one of the entries in the BLOCKING
  `MOBILE_ROUTE_MANIFEST` (`scripts/render-sweep.ts:160`), and
  `evaluateMobileRoute` (`scripts/render-sweep-lib.ts:265-286`) fails the
  route on ANY page-level horizontal overflow
  (`document.scrollingElement.scrollWidth` / `maxElementRight` vs
  `window.innerWidth`, 1px slack). This IS a genuine falsifying check for
  THIS row specifically (not just a generic assertion of no relation): a
  reverted `min-width: 0` on `.chq-measure` is exactly the kind of
  unconstrained-flex-child overflow this assertion exists to catch on a
  narrow (390px) viewport, and the row is in the manifest that actually
  blocks the gate. Caveat: this reasons from the assertion's shape and the
  manifest membership, not from an actual booted-server run (out of scope
  for a docs-only task with no server to boot) — a wave-40 owner should take
  one real `npm run gate:render-sweep` reading to make this a runtime
  reading rather than a code-read.
- `/admin/submissions` filterbar 44px floor —
  `app/src/pages/submissions/submissions.css:557-564` (DEC-253/DEC-367).
  CORRECTION (DEC-358 wave-39): the delegating task description characterized
  the render-sweep mobile-pass floor as 40px — that's WRONG as re-read this
  wave. `scripts/render-sweep-lib.ts:258` defines
  `MIN_TAP_TARGET_PX = 44` exactly (comment at `:264` cites DEC-393), and
  `evaluateMobileRoute` (`:280-286`) fails any route whose
  `minControlHeight < MIN_TAP_TARGET_PX`. `/admin/submissions` (role
  `organizer`) is a member of `ADMIN_MOBILE_ROUTE_MANIFEST`
  (`scripts/render-sweep.ts:191-193`, filtered from `ROUTE_MANIFEST` by
  role), and `ADMIN_MOBILE_PASS_BLOCKING = true`
  (`scripts/render-sweep-lib.ts:387`) — this pass blocks the gate, it is not
  advisory. So the 44px claim is NOT rounded up from 40px — the gate's own
  constant is 44px, matching the row's claim exactly. DISCHARGED on the same
  code-read basis and same caveat as the `/portal/tasks` row above (no
  booted-server reading taken this task; a wave-40 owner should take one).

## IN FLIGHT — owned by a branch, do not re-file

Ref-measured at THIS task's own runtime against `b71a1358` (30 refs total;
`git for-each-ref refs/heads` + `npm run ref-state` +
`git merge-base --is-ancestor <ref> main` for every ref;
`.git/logs/refs/heads/<branch>` for creation timestamps):

- **NO `task-w30-*` through `task-w39-*` refs are live** — confirmed via
  `git for-each-ref refs/heads`; none of those waves' named branches exist
  as refs today (all merged, branches deleted post-merge; their content is
  on `main`'s history, not as a live named ref). Do not re-file any wave
  30-through-39 scope on the strength of an old "OWNED BY" line (DEC-069
  wave-17 amendment).
- **All six wave-40 gate lanes are MERGED** — `task-w40-a` (build+test+bundle,
  PASS, 1092 test files/12002 tests, bundle 69.20 kB gz), `task-w40-b`
  (`73150059`, walkthrough), `task-w40-c` (`d1db93f9` @ `2e99b272`,
  perf-smoke), `task-w40-d` (`852ef22d`, spec-audit), `task-w40-e`
  (`3d0f61c2`, render-sweep, advisory), `task-w40-f` (exit-predicate corpus
  test, merged via `2e99b272`) — every one confirmed an ancestor of `main`
  by `git merge-base --is-ancestor`. Content folded into TIER 0 above where
  applicable (perf rows, review-lens dismissals). No wave-40 triage-closure
  section has been written yet — `docs/verification-log/index/` has no
  `*-triage-closure-*` entry for this boundary, so DEC-069's exit predicate
  (four gate sections + a triage-closure section with `OPEN ITEMS: 0`) is
  NOT YET satisfiable at this boundary; this is an open item, not a grade.
  `task-w40-e`/`task-w40-g` (`3d0f61c2`/`2e99b272`) remain as live refs
  pointing at already-merged content — stale-but-harmless, not owned scope.
- **`task-w41-c`** (`47d3653d`, "heavy-gate lock re-entrant-safe", DEC-644
  wave-41) — ancestor of `main` (merged, `main`'s own HEAD is
  "merge task-w41-c"). MERGED.
- **`task-w41-a`** (`a52a7b0c`, "Add clarifications conformance ledger",
  DEC-518 wave-41 amendment) — real commit, NOT an ancestor of `main`
  (`ref-state` confirms). Owns the `docs/clarifications.md` two-directional
  ledger the wave-41 field-guide note flagged as missing. UNMERGED, do not
  re-file.
- **`task-w41-b`** (`5c4c981b`, "Add machine-checked exit-verdict contract
  test", DEC-099 wave-41) — real commit, NOT an ancestor of `main`. Owns
  the RESULT-token/scope-literal/em-dash corpus test the wave-41 field-guide
  note flagged as missing. UNMERGED, do not re-file.
- **`task-w41-d`** (`d7cfe08d`) — tip equals the "scribe wave 41" commit
  (zero commits of its own as of this reading), created at this task's own
  runtime per `.git/logs/refs/heads/task-w41-d` (~7 minutes before this
  reading). RUNNING, not dead (DEC-069 wave-37 amendment: a branch minutes
  old at its base is running). Assigned by this task's own delegation to
  own `docs/mandates/w41-falsifiability-batch-a.md`'s discharge evidence —
  do not claim that discharge from this file.
- **`task-w41-e`** (`b71a1358`) — tip equals `main`'s current HEAD exactly
  (zero commits of its own as of this reading), created per
  `.git/logs/refs/heads/task-w41-e` (~5 minutes before this reading).
  RUNNING, not dead, same rule as `task-w41-d`. Assigned by this task's own
  delegation to own `docs/mandates/w41-falsifiability-batch-b.md`'s
  discharge evidence — do not claim that discharge from this file.
- **`task-w41-f`** — this task itself (the eval-findings rebase you are
  reading).
- **`task-w17-i`** (`7b78d8b6`) — STILL UNMERGED, unchanged across many
  waves, but its NAMED SCOPE ("Sign-in page names the event and its open
  CFP", DEC-716) is now CLOSED-SUPERSEDED — see the DISMISSED
  review-lens/instrument alarms entry above (`loadSingleEventContext`
  landed via a different lane). The literal branch ref stays unmerged and
  stale; do not resurrect it or re-file its scope.
- **Every other live ref** — `mail-rich-shape-fallback`, `manual-qa`,
  `task-custodian-w68-4`, `task-w68-b/c/d/e`, `task-w71-a/c/d/e`,
  `task-w72-a`-`j` — `ref-state` this wave confirms `manual-qa`,
  `task-custodian-w68-4`, `task-w68-d`, `task-w71-c/d/e` ARE ancestors of
  `main` (their content already folded into history; stale live refs, not
  owned scope), while `mail-rich-shape-fallback`, `task-w68-b/c/e`,
  `task-w71-a`, `task-w72-a`-`j` are NOT ancestors — genuinely unmerged,
  but belong to waves numbered ahead of wave 41 (68/71/72), a
  different/later campaign. Flagged, not triaged.

### TIER-1 pointer — `task-w27-g` owns fidelity-recheck verdicts, cite as OWNED

Re-globbed again this wave: `ls
docs/verification-log/task-w27-g-fidelity-recheck-ceda66f2.md` — file EXISTS
(unchanged from the wave-35 correction). Not independently re-read for
content this task (DOCS ONLY rebase); next TIER-1 touch should read it
rather than trust this note.

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
DEC-610).

**Deleted this wave (DEC-358 wave-37 amendment — false claim, re-verified
against the tree):** the prior "Still open/unverified: CFP 2-step wizard,
roster screen" line. Both exist and were verified present at this wave's
runtime: `src/routes/public/cfp-steps-script.tsx` (1.9 KB) plus
`src/routes/public/submit-views.tsx`'s `data-chq-cfp-step`/`.chq-cfp-steps`
markup (`:556-567`) implement the CFP 2-step wizard; `app/src/pages/speakers/
RosterPanel.tsx` (14 KB) plus its
`app/src/pages/speakers/RosterPanel.render.test.tsx` (9.7 KB) implement and
test the roster screen. Neither is a live gap; this was a stale claim
carried forward unre-verified, the same class of defect DEC-358's wave-35
amendment named for "does not exist" file claims — an existence claim
("still open/unverified") decays exactly the same way and needed re-globbing
before being carried, and on re-globbing was found false.

**Governing principle (affirmed, still binds):** mobile is additive
reflow — a mobile change must never move a desktop pixel (scan-lock).
Phone grammar (action bars, sheets, stacking, 44px targets) is a legitimate
translation of desktop affordances; a phone-only surface never lets
desktop be inferred from it.
