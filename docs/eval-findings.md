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

## TIER 1 — re-verified open items (orchestrator promotion, 2026-08-15 morning)

The gate-7 evidence is NOT archive-stale — it was MEASURED TODAY against boundary
ea2a5543 (a few waves behind current main): the sbek run at
killmysaas-evals/runs/2026-08-15T07-46-32/report.json (89.0 composite) and the six
fleet reports at chautauqua-research/fidelity-gate7/pair*/report.md. Note on lineage:
the vendored docs/design/*.dc.html IS the v9 pack — the research repo's
design-frames-v9 PNGs are renders of these exact files; distrust of "v9" is
misplaced.

1. **⚡ EMB session-card speaker title/company** (~1.3 composite): sbek EMB-01/09
   reasoning (measured on prod today) — "the required speaker job title and company
   are NOT shown on the session cards... only bold speaker names." Render
   "Name · Title, Company" second line in the muted register on SessionCard
   (src/routes/public/cards.tsx SpeakerNames); public sessions query must select
   job_title/company. EMB-09 also wants the description on agenda-style cards.
2. **⚡ Compose-flow turn diet**: CFP-04/16 cannot_judge AGAIN today — both CFP
   scenarios capped with the compose steps eating the budget before the
   close-the-call step. Fewer clicks per compose step, default-forward selections.
   (Step-4 anatomy + dedupe landed post-boundary — the DIET half remains.)
3. **CNT-S3 session-edit loop**: capped at the session-edit step again today
   (CNT-10 cannot_judge) — cheapen edit-save-reload on the admin session detail.
4. **Gate-7 fleet remaining MAJORs** (measured today, per-pair detail in
   fidelity-gate7/pair*/report.md; several already converted post-boundary —
   re-verify against current main before re-filing as closed): 07 comms step-1
   SLOT/footer + templates-grid overlap + history-tab chrome · 05 files-library
   column swap + orphan row + upload-reject modal + content-detail 1180/32
   container · 04 participation panel 420 + speaker-detail grid/theads + reminders
   modal (prints localhost:8799) + write-failed banner anatomy + search excluded
   from hasActiveNarrowing · 02 SESSION DETAILS label-left grid + participant
   chips · 09 field widths (dates 200, seats 110) + shared destructive-far-left
   footer + Add-track tertiary + portal what-speakers-may-edit toggles + CFP-edit
   intro/description binding + saved-embed single-card anatomy · CLASS 1 admin
   measure 1372@114 + topbar 59 (everywhere) · 12-home chrome at 46px gutters +
   732 body · 10 active-filter ink chip + TBD room on public (ruling A25) +
   speakers toolbar right-cluster + underlined initials + blue avatars · 11
   /account/password broken button + bare-page must be a real 820 column
   (auth.css.ts body flex shrink-wrap) + AUTH_CSS .chq-field-invalid cascade
   inert · 03 duplicated results head + FORM ANSWERS stacked + plan-editor draft
   footer.

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
  just the base; N-aware clash caption; occupied-slot "place anyway" path.
- Phone shells: bottom fixed tab bar + inset scroll, 44px targets
  everywhere, phone landing/content parity (Comms landing content,
  Submissions triage cards' verbose fields, Settings subscreens as routes,
  phone CFP 2-step wizard, phone password screen's fixed footer + Cancel,
  roster screen, Home footer media rule).
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
