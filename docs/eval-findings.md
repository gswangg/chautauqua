# Eval findings — rebased 2026-08-15 (wave 35, task-w35-f)

Verified against `main` sha `0db68e3611bac24dbd8e52b717efb329689ba460` ("merge
task-w34-a"), derived AT THIS TASK'S OWN RUNTIME — not from this task's own
brief, where it disagreed with measurement — by running, in order: `git
rev-parse main`; `git for-each-ref refs/heads` (28 live branches, none
numbered `task-w31-*`/`task-w32-*`/`task-w33-*`); `git merge-base --is-ancestor
<ref> main` for every live `task-w*` ref. **RE-VERIFY, the tree moves:** this
task's own brief named `main` as `c9532d9a` ("merge task-w34-b"); by the time
this rebase ran, "merge task-w34-a" (`0db68e36`, carrying `c6ef98d3`'s DEC-774
Promise.all collapse) had landed on top of it — one more merge than the brief
described. **Trap for the next rebase:** `.git/packed-refs` carries a STALE
`refs/heads/main` entry at `4207460470b672176e119ed3502d08d869489509` — the
loose ref (`.git/refs/heads/main`) overrides it and is the one `git
rev-parse main` actually returns; do not read the packed line as current.

COMPACTION per DEC-358's wave-35 amendment (which itself extends the wave-27
amendment): the wave-31 header (351 lines, boundary `6dbf7117`, itself nine
merges/four waves stale by this rebase) is replaced by this one, not
prepended. No per-item citation below is deleted, only re-homed/compacted —
dismissals are recorded, never deleted. Per the wave-35 amendment's added
rule, every "file X does not exist" claim carried from the prior header was
re-globbed before being carried; the one that was re-globbed and found FALSE
(TIER-1 pointer, below) is corrected rather than carried.

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
- **A branch-local PASS is not a closure** (DEC-644 wave-35 amendment): a
  perf/sweep row moves out of FAIL only on a reading taken at a boundary
  that contains EVERY fix credited with closing it; two lanes each
  measuring their own fix with the sibling fix absent produce two PASS
  readings and zero readings of the tree that actually shipped.
- **An absence is a measurement, not a note to carry** (DEC-358 wave-35
  amendment): a rebase re-globs every "file X does not exist" claim before
  carrying it; an existence claim that survives a rebase unre-globbed is
  DELETED rather than carried forward. Same applies to ref-existence
  claims — a `.git/packed-refs` stale entry is a live trap, not a citation.
- **The vendored frame pack is `docs/design/*.dc.html`**; where a research
  render measurement conflicts with vendored `docs/design/README.md`, the
  README wins.

## TIER 0 — re-verified, already correct or already merged, do not re-file

### Closed, carried (boundary `6dbf7117`, re-verified present on `0db68e36`)

- **`files library (page 1)` perf FAIL** (raw 484.4ms/adj 481.5ms vs 50ms
  budget, `docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md:67-84`)
  — CLOSED. `task-w29-b`'s real commit `c50e56f3` (ancestor of `main`)
  replaced the non-indexable `headshot_url` string-concat join with an
  indexed FK (`contact.headshot_file_id`, migration 0040) at all three call
  sites and rewrote `totalSizeBytes` as a SQL aggregate. PASS: raw
  17.7ms/adj 13.0ms — `docs/verification-log/task-w29-b-files-library-perf-c50e56f3.md`.
  Lands DEC-773's wave-29 "option 3" (real FK); do not re-file as unfixed.
- **`onboarding grid` perf FAIL** — CLOSED. `task-w29-a`, adjusted p95
  116.1ms → 23.0ms (PASS) —
  `docs/verification-log/task-w29-a-onboarding-perf-1d274c8b.md:59-62`.
- **Render-sweep interaction-state (2/4→3/3) incl. `.chq-cfp-step-next`
  focus** — CLOSED. `task-w29-c`,
  `docs/verification-log/task-w29-c-render-sweep-6aa4a438.md:69-106`:
  `.chq-cfp-step-next  cfp-primary-focus  focus  PASS`. Independently
  reconfirmed in a fresh full-gate run by `task-w35-b`
  (`docs/verification-log.md`, `task-w35-b` entry, DOCS ONLY) — same PASS.
- **`.chq-participation-menu-caret` contrast row** — CLOSED by `task-w29-d`
  (`add09a9e`, ancestor of `main`): `app/src/pages/speakers/speakers.css:384-403`,
  now `color: inherit;` (was hard-coded `var(--chq-muted)`). CAVEAT added
  this wave, do not drop it: `task-w35-b`'s fresh full-gate render-sweep run
  found the gate's contrast check has NO row for this selector at all — the
  original `task-w29-c`/`task-w29-d` PASS credit was never independently
  observed by an exercised check, only by the code shape. The code fix is
  real (verified in the tree); the CLOSED status rests on the code-shape
  citation, not a gate PASS row, until a contrast check for this selector is
  added and run.

### TIER 0 OWNED — surviving perf FAILs, reassigned this wave

Per DEC-644's wave-35 amendment, neither row below closes on its own PASS
reading — each was measured with the sibling fix absent, so no boundary
reading of the shipped tree (both fixes together) exists yet:

- **`reviewer queue`** — `task-w32-b` (`74c6377a`, ancestor of `main`,
  `src/routes/review/reviewer.ts` rewritten per DEC-829 wave-32 amendment)
  measured 48.7/32.2/38.9ms adj PASS — but in that same run `plan results
  (page 1)` still FAILed (72.9/50.3/57.3ms adj) and
  `src/routes/review/shared.ts` was untouched by this lane
  (`docs/verification-log.md:4599-4634`). STAYS OPEN.
- **`plan results (page 1)`** — `task-w32-a` (`904dd3d8`, ancestor of
  `main`, `src/routes/review/shared.ts` split into `rankPlanResults`/
  `hydrateResultsRows` per DEC-829 wave-32 amendment) measured raw
  44.8ms/adj 39.0ms PASS — but in that same run `reviewer queue` still
  FAILed and `src/routes/review/reviewer.ts` was untouched by this lane
  (`docs/verification-log.md:4553-4596`). STAYS OPEN.
- Both rows are now on `main` (both commits are ancestors), so the code
  fixes are real; what's missing is a single `perf:smoke` run at a tip
  containing both `74c6377a`'s and `904dd3d8`'s changes together, timing
  both rows in that one run. Deleted this wave: the stale `task-w31-a`/
  `task-w31-b`/`task-w31-c` ownership rows — all three branches are gone
  from `refs/heads` (deleted post-merge; `task-w31-c`'s scope, files
  library, closed above under a different named lane). **OWNED BY NAME by
  `task-w35-a`** until a merged-boundary reading (one `perf:smoke` run
  timing both rows on a tip containing both fixes) exists.

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
- **"`.chq-participation-menu-caret` contrast row has no gate check"** —
  found by `task-w35-b`'s fresh full-gate run; not a defect, a gate-coverage
  gap. Recorded above under the row's CLOSED entry, not filed separately.

### STALE-ON-MEASUREMENT (do not re-file — closed, re-checked this wave)

- **`.chq-review-checkbox-label` contrast** ratio 3.09 — NOT a live defect.
  Closed via DEC-426's wave-29 exemption path: an inactive-component
  disabled-token pair (`--chq-disabled` on `--chq-disabled-bg`) is exempt
  under WCAG 2.1 SC 1.4.3, recorded as `EXEMPT-BY-RULE` rather than a FAIL
  — `scripts/render-sweep-contrast.ts:77-84,112-115` (the `exempted`/
  `exemptNote` fields), asserted by
  `test/render-sweep-contrast.test.ts:61`. Reconfirmed present in
  `task-w35-b`'s fresh full-gate run ("one expected EXEMPT-BY-RULE contrast
  row").
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

No item currently qualifies for this tier at this boundary (`0db68e36`) —
every DEC amendment checked across waves 29-35 (DEC-773 wave-29/31, DEC-830
wave-29, DEC-829 wave-32, DEC-644 wave-31/32/35, DEC-099 wave-35) has either
a landed, ref-verified fix or — for the two rows in TIER 0 OWNED above — two
landed, ref-verified fixes still missing a joint boundary reading, which is
a narrower and different problem than "zero commits" and is tracked there,
not here. Section kept (empty) so a future wave files into it rather than
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
- **DEC-099 wave-35 Vary: Cookie population + fix** — `task-w35-c`
  (`beb58e29`, still UNMERGED, see IN FLIGHT below — listed here only as a
  pointer, not yet CLOSED): built
  `test/public-cacheability-enumeration.test.ts`, enumerating every GET
  route under `/e/*`, `/embed/*` and `/` and asserting `Cache-Control !=
  no-store <=> Vary: Cookie`; found a real violation in
  `publicNotFound`/`publicErrorDocument`/`publicRoutes.onError`. Do not
  re-file the population-derivation gap once `task-w35-c` merges — verify
  the fix landed first (DEC-069).

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
task (DOCS ONLY) — the exercised PASS/FAIL receipt is `task-w27-g`'s scope
(see TIER-1 pointer below — the fidelity-recheck file at that citation
DOES exist, contra the previous header's claim).

### Render-sweep items closed in the tree (carried, quoted)

- `/portal/tasks` measure fix — `src/routes/portal/portal.css.ts:417-430`
  (`min-width: 0` on `.chq-measure`, DEC-253 wave-25 amendment).
- `/admin/submissions` filterbar 44px floor —
  `app/src/pages/submissions/submissions.css:557-564` (DEC-253/DEC-367).

## IN FLIGHT — owned by a branch, do not re-file

Ref-measured at THIS task's own runtime against `0db68e36` (28 refs total;
`git for-each-ref refs/heads` + `git merge-base --is-ancestor <ref> main`
for every `task-w*` ref):

- **NO `task-w30-*`, `task-w31-*`, `task-w32-*`, or `task-w33-*` refs
  exist.** All merged, branches deleted. The prior header's own IN FLIGHT
  fences for waves 31-33 point at nothing; do not re-file any wave
  30-through-33 scope on the strength of an old "OWNED BY" line (DEC-069
  wave-17 amendment).
- **`task-w34-a`** — ancestor of `main` (merged, `merge task-w34-a` on
  `main`'s first-parent line, carrying `c6ef98d3`'s DEC-774 wave-34
  Promise.all collapse). MERGED.
- **`task-w35-a`** — ancestor of `main` ("scribe wave 35",
  `a0b8501b`): touched `decisions/DEC-063.md`, `DEC-099.md`, `DEC-338.md`,
  `DEC-358.md`, `DEC-644.md`, `field-guide/index.md` only. MERGED, but its
  content is the scribe pass, not a perf fix — see TIER 0 OWNED above for
  the ownership this wave's brief assigns to this name regardless.
- **`task-w35-b`** — tip `70294572`, NOT an ancestor of `main`. UNMERGED,
  real commit: "render-sweep design-fidelity reading @ a0b8501b (log-only)"
  — a fresh full-gate render-sweep run, DOCS ONLY (`docs/verification-log.md`
  entry only, no product-code diff). Falsified one prior credit (see
  DISMISSED alarms above: no gate row exists for
  `.chq-participation-menu-caret` contrast) and reconfirmed two others.
- **`task-w35-c`** — tip `beb58e29`, NOT an ancestor of `main`. UNMERGED,
  real commit: "DEC-099 wave-35: derived population for the Vary:Cookie
  claim + fix found by building it" — adds
  `test/public-cacheability-enumeration.test.ts` and a real product fix in
  `setCacheHeaders`'s callers (see DISMISSED-VERIFIED-CLOSED pointer
  above). OWNED, verify merged before treating the fix as landed.
- **`task-w35-d`** — tip equals its own merge-base with `main`
  (`a0b8501b`, same sha as `task-w35-a`'s tip): PRODUCED NOTHING as
  measured. Not further triaged (DOCS ONLY scope this task).
- **`task-w35-e`** — tip equals `main`'s current tip (`0db68e36`) exactly:
  this lane's own commits ARE `main`'s current head (the `merge
  task-w34-a` step). MERGED / is-main.
- **`task-w17-i`** (`7b78d8b6`) — STILL UNMERGED, unchanged across many
  waves: "Sign-in page names the event and its open CFP (DEC-716)." Very
  stale; needs a fresh boundary before re-attempt.
- **Every other live ref** — `mail-rich-shape-fallback`, `manual-qa`,
  `task-custodian-w68-4`, `task-w68-b/c/d/e`, `task-w71-a/c/d/e`,
  `task-w72-a`-`j` — all UNMERGED but belong to waves numbered ahead of
  wave 35 (68/71/72), a different/later campaign. Flagged, not triaged.

### TIER-1 pointer — `task-w27-g` owns fidelity-recheck verdicts, cite as OWNED

**Correction (re-globbed this wave, per DEC-358's wave-35 amendment):** the
prior header (carried unresolved from wave 27 through wave 31) claimed
`docs/verification-log/task-w27-g-fidelity-recheck-*.md` "does not exist."
Re-globbed at this wave's runtime: `ls
docs/verification-log/task-w27-g-fidelity-recheck-ceda66f2.md` — **the file
EXISTS.** The stale claim is the seed case for this wave's DEC-358
amendment (an absence claim decays exactly like a presence claim, and this
one was carried unre-globbed across at least four waves). Not
independently re-read for content this task (DOCS ONLY rebase); next TIER-1
touch should read it rather than trust either this note or the deleted
prior claim.

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
