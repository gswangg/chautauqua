# v12 mobile + fidelity campaign mandate

The campaign goal: every screen matches its v12 frame on desktop AND phone.
Authority: docs/design/*.dc.html (v12 geometry), DESIGN-RULINGS.md (rulings),
DEVIATIONS.md (user overrides). This file is the campaign mandate the planner
works from, tiered.

## Tier 0 — fidelity on landed work (verify first, then fix)

The v12 speakers redesign and the wave-1 phone clusters (Contacts, Comms,
Submissions, Content) were implemented by pre-campaign lanes. Audit them
against their frames BEFORE building new work on top:
- Speakers desktop: grid weight inversion, column-head aggregates
  ("7 of 12 done", name links to task view), single "Edit tasks" control,
  bulk bar (Remind these / Not needed for these), the NEW task page in both
  states ("One task, every speaker" / "One task · still waiting" — answers
  table, export, reminder history, per-row standing notes), speaker detail
  (per-session participation menus in Sessions rows, tasks tracks
  1fr 132px 96px 150px), dense/roomy token pairing.
- Wave-1 phone clusters at 390: every width:390 frame in their .dc.html.
File a finding per divergence; fix findings as worker tasks.

## Tier 1 — remaining phone clusters (implement to frame)

Phone frames (width:390) per file: Settings 9 · Public and Portal 14 ·
Review 5 · Home 3 · Account 2 · Speakers 2 · Agenda 1 · Overview 1 · Docs 1.
Cluster boundaries: app/src/pages/<cluster>/** for SPA pages; src/routes/
(portal/, public/, docs-site, root, auth) for SSR surfaces. The SHELL lane
(admin nav/header phone chrome, page padding, drawer behavior — app/src
App shell + app/src/styles.css + src/views/theme.ts) is its OWN task; page
tasks must not touch shell files and instead record shell needs as findings.

## Tier 2 — cross-cutting sweeps (after T1 lands)

- 44px-floor sweep at 390 across every interactive element (measure, don't
  grep — the ruling names two evasion modes).
- Density-pairing audit: dense tokens only in matrix cells; roomy everywhere
  a row is a real target; colour/weight identical per pair.
- Horizontal-overflow probe at 390 on every page.
- Disabled-token compliance (two legal uses) at phone sizes.

## Hard rules (every role, non-negotiable)

- NEVER `git push`. NEVER deploy. NEVER `wrangler` with `--remote`. Local
  commits/merges only — the user reviews before anything leaves the machine.
- Port 8878 and everything under ~/.claude/jobs/ are OFF LIMITS. Dev servers
  for probes run on free ports above 9100 and are killed by PID (never by
  name) before the probe finishes.
- Desktop is FROZEN: phone work lives in max-width media blocks (DEC-385
  single-direction); desktop pins stay green; a desktop-affecting change is
  legal only when a v12 desktop frame demands it.
- Workers run TARGETED tests only; the full suite runs at merge-train
  batches and verification waves.
- macOS zsh: never write bare `==`/`===` tokens in shell commands.

## Wave-1 handoff findings (pre-campaign lanes; planner must schedule)

Shell lane (T1, blocking several page frames):
- Phone page scaffold: frames draw header (flex-shrink:0) / body (flex:1,
  overflow-y:auto) / pinned footer inside the 390 viewport; pages scroll as
  one document today. Needed by: Contacts drawer errand flow, Submissions
  detail decision bar, Content docked bars (Approve N / Download all /
  Ask for changes).
- Bottom tab bar: CSS exists (styles.css:390-402) but Submissions reports
  nothing renders the five-item nav; reconcile and mount it.
- .chq-drawer phone inset 16px (now 20px 26px; sticky-bar negative margins
  at styles.css:1128-1145 are paired to the 26px and must move with it).
- Drawer back-link header (`‹ Contacts` 44px) — ModalFrame affordance.
- .chq-header phone slot treatment (selection counter "2 of 318").
- .chq-page-title phone size (Files H1 wants 25px at 390).
- Global: .chq-table td:first/last-child 16px inset stacks on .chq-main's
  gutter at 390 (32px total) for every card-stacking table; comms
  neutralized its own two tables; fix globally.

Unclaimed frame: "CFP form · 390" (Chautauqua Submissions.dc.html:468)
renders from app/src/pages/forms/** — no lane owned it. Schedule it.

Feature-shaped gaps (frame draws behavior, not just geometry — schedule as
tasks, or record as DEVIATIONS if the planner judges them out of scope):
- Comms.tsx phone landing: frame draws a DRAFT IN PROGRESS card + "Read the
  draft" over Recent sends, superseding the DEC-621 three-button chooser.
- Content queue "Select mode" (Select link swaps row verbs for a docked
  bar; header becomes "3 selected · All 5 · Done").
- Import CSV one-column-per-screen pagination (Next column / Skip).
- Submissions card third action: frame draws bordered "Read"; app has
  borderless tertiary "Waitlist" — design decision needed.

Cascade rule (two lanes hit it independently): a stylesheet whose desktop
rules are declared AFTER its max-width block silently kills equal-
specificity phone overrides. content.css and comms.css are fixed and
pinned; sweep the remaining stylesheets for the same exposure.

## User-filed (2026-08-19, morning review — fix agent dispatched, lenses must verify)
- Speakers surfaces show NATIVE focus rings; the design-system :focus-visible
  treatment (styles.css:225) must reach every interactive element there.
- Task view answered tab offered "Open" universally; the response viewer is
  form-only. Per-kind actions: form=Open, file_request=file link, general=none.

## Eval root-cause round (2026-08-19 evening) — swarm follow-ups
- INTEGRITY: src/decisions-data/DEC-986.md (scribe wave 10/11) documents phone-CFP
  fixes that DO NOT EXIST in the tree — cfp-steps-script.tsx:33 still calls
  setStep('2') with no reportValidity(), form-render.tsx:278 still uses singular
  querySelector. (a) Actually implement the phone-CFP step-1 validation dead-end
  fix; (b) correct the false doc; (c) lens: audit other scribe-authored DEC docs
  from waves 10-11 for claims not backed by the diff.
- Pre-existing UX bug (portal edit): "Add co-presenter" is a full-page POST that
  silently discards unsaved title/abstract/track edits (a55cce81, by the page's
  own inviting copy order). Schedule a fix (preserve the draft across the POST or
  make the add row-scoped).
