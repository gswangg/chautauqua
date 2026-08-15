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

Corrected this wave against actual branch/main state (see notes below —
two of the branches named in this task's brief are already merged, not
in-flight; recorded accurately here rather than as given):

- **`task-w8-d`** (compose step-1 slot column + footer) — UNMERGED
  (`git merge-base --is-ancestor task-w8-d main` fails). Owns
  `app/src/pages/comms/ComposeWizard.tsx` step-1 table. Note: this branch's
  diff against current `main` is wide (touches `HistoryTab.tsx`,
  `BulkActionBar.tsx`, `Agenda.tsx`) because it was cut before `task-w8-b`
  and `task-w8-e` merged — it needs a rebase onto current `main`, not a
  plain merge, or it will revert already-landed work.
- **`task-w8-c`** (review round name + window) — UNMERGED
  (`git merge-base --is-ancestor task-w8-c main` fails; `roundLabel`/
  `roundMeta` do not exist in `main`'s
  `app/src/pages/review/ReviewerQueue.tsx`). This wave's task brief asserted
  w8-c had landed at `ReviewerQueue.tsx:502-512` — re-checked and that is
  NOT true against current `main`; correcting the record here rather than
  propagating the stale claim. Owns the plan-scoped queue header subtitle.

Already landed, NOT in flight (corrected from this wave's task brief):

- **`task-w8-b`** (Submissions→Comms `?ids=` handoff + ComposeWizard
  entry-effects landing rule) — MERGED (`git merge-base --is-ancestor
  task-w8-b main` succeeds; commit `6b5ae238` "merge task-w8-b" is in
  `main`'s history). STRUCTURAL: `app/src/pages/submissions/BulkActionBar.tsx:77`
  links to `/comms?tab=compose&ids=${emailIds.join(',')}`.
- **`task-w8-e`** (Comms History pager) — MERGED (commit `508c0152` "merge
  task-w8-e" is in `main`'s history). STRUCTURAL:
  `app/src/pages/comms/HistoryTab.tsx:42-160` renders `page`/`perPage` state
  wired to a real pager (prev/next, `paginationSummary`).
- **`task-w8-a`** as named in this wave's brief (public session-card
  speaker title/company, EMB-01/09) — no branch by that name currently
  exists (the `task-w8-a` name is reused from an earlier, unrelated wave's
  submission-detail-page task, already merged and gone). The EMB-01/09 work
  itself is done on `main` — see the TIER 0 closure above.

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
   slot-column structural fixes are w8-b (landed)/w8-d (in flight, see IN
   FLIGHT above) — the DIET half itself, beyond those structural fixes,
   remains open.)
2. **CNT-S3 session-edit loop**: capped at the session-edit step again today
   (CNT-10 cannot_judge) — cheapen edit-save-reload on the admin session detail.
3. **Gate-7 fleet remaining MAJORs** (measured today, per-pair detail in
   fidelity-gate7/pair*/report.md; several already converted post-boundary —
   re-verify against current main before re-filing as closed; four sub-items
   closed this wave, see TIER 0 above): 07 comms step-1 SLOT/footer +
   templates-grid overlap + history-tab chrome · 05 files-library
   column swap + orphan row + upload-reject modal + content-detail 1180/32
   container · 04 participation panel 420 + speaker-detail grid/theads + reminders
   modal (prints localhost:8799) + write-failed banner anatomy + search excluded
   from hasActiveNarrowing · 02 SESSION DETAILS label-left grid + participant
   chips · 09 Add-track tertiary + CFP-edit intro/description binding +
   saved-embed single-card anatomy · CLASS 1 admin
   measure 1372@114 + topbar 59 (everywhere) · 12-home chrome at 46px gutters +
   732 body · 10 active-filter ink chip + TBD room on public (ruling A25) +
   speakers toolbar right-cluster + underlined initials + blue avatars · 11
   AUTH_CSS .chq-field-invalid cascade inert · 03 duplicated results head +
   FORM ANSWERS stacked + plan-editor draft footer.

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
