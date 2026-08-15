# Eval findings — rebased 2026-08-15

Verified against `main` sha `541688f54670cfa8596c4fc749cfa9c5d47a6286`. The prior
generation of this file (1,505 lines, written against `chautauqua-research/design-
frames-v7/v8/v9` — a pack not vendored in this repo, plus a long series of dead
gate-N fleet/sbek verdicts and snapshot shas) is archived verbatim, never deleted,
at `docs/mandates/findings-archive-2026-08-15.md`. Line references inside the
archive do not resolve against the current tree; nothing there is authoritative
until someone re-verifies it and moves it into a tier below.

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

Rewritten this wave (w12-e, 2026-08-15) from actual ref/main state, not
inherited from the prior wave's write-up. Method: `git for-each-ref
refs/heads` enumerated every `task-w*` ref that exists today, then `git
merge-base --is-ancestor <ref> main` was run against each. **Result: as of
this wave, there is no unmerged branch in the w8–w11 range at all** — every
named lane below has landed. The prior wave's IN FLIGHT entry for
`task-w8-c`/`task-w8-d` (UNMERGED, `roundLabel`/`roundMeta` "do not exist in
main's ReviewerQueue.tsx") was already false when it was written: the merge
commits (`6f86b89` "merge task-w8-c", `2f0d2f13` "merge task-w8-d") are both
in `main`'s history today, and neither ref exists anymore (deleted post-merge,
same pattern as `task-w8-a` below) — so the ancestor check the prior wave
cited as failing cannot be re-run against those ref names; it was checked
against a stale/wrong ref state or never actually run. Both are confirmed
landed by symbol/behavior citation instead:

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
   Walked sub-item by sub-item this wave against current `main` + the
   vendored `docs/design/*.dc.html`/README pack. Nothing is deleted — a
   closed item keeps its citation so the next wave doesn't re-derive it:

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
   - **05 files-library column swap + orphan row + upload-reject modal +
     content-detail 1180/32 container** — VERIFIED-OPEN, partially. An
     `UploadRejectedModal.tsx` component exists (`app/src/pages/content/
     UploadRejectedModal.tsx`), so "upload-reject modal" as a bare presence
     claim is not a gap — but the fleet report's complaint was about
     anatomy/fidelity, not existence, and that was not re-measured this
     wave. "column swap", "orphan row", and "content-detail 1180/32
     container" were not re-checked. Carried forward as-is, not re-tiered.
   - **04 participation panel 420 + speaker-detail grid/theads + reminders
     modal (prints localhost:8799) + write-failed banner anatomy + search
     excluded from hasActiveNarrowing** — VERIFIED-OPEN, not re-checked this
     wave beyond a keyword grep that found no `420px participation-panel`
     rule under that name (`app/src/pages/comms/comms.css:444` is an
     unrelated `min-height: 420px` on a different component). Carried
     forward as-is.
   - **02 SESSION DETAILS label-left grid + participant chips**,
     **09 Add-track tertiary + CFP-edit intro/description binding +
     saved-embed single-card anatomy**, **CLASS 1 admin measure 1372@114 +
     topbar 59 (everywhere)**, **10 active-filter ink chip + TBD room on
     public (ruling A25) + speakers toolbar right-cluster + underlined
     initials + blue avatars**, **11 AUTH_CSS .chq-field-invalid cascade
     inert**, **03 duplicated results head + FORM ANSWERS stacked +
     plan-editor draft footer** — NOT re-checked against current `main`
     this wave (task budget spent on the two proof items above); carried
     forward unchanged as VERIFIED-OPEN. Per the standing rule added this
     wave, none of these may move tier on inheritance alone — the next
     wave that touches one needs its own file:line or exercised citation.
     Partial note on "10": `PhoneAgenda.tsx:34,42` still has a `TBD` string
     fallback for room name (admin phone agenda, not the public surface the
     sub-item names) and `Agenda.render.test.tsx:366-368` asserts desktop
     agenda never renders literal "TBD" — the public-surface claim in "10"
     was not confirmed either way; do not read the admin-phone `TBD`
     literal as evidence for or against the public claim.

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
  Submissions triage cards' verbose fields, Settings subscreens as routes,
  phone CFP 2-step wizard, phone password screen's fixed footer + Cancel —
  DONE, cited above (STRUCTURAL: `src/routes/auth.css.ts:318-336`), roster
  screen, Home footer media rule — DONE, cited above (STRUCTURAL:
  `src/routes/public/home.css.ts:72-76`)). The un-cited items in this bullet
  (triage cards, Settings subscreens-as-routes, CFP 2-step wizard, roster
  screen) were NOT re-checked this wave and stay open/unverified.
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
