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
