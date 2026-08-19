# v12 mobile + fidelity campaign mandate

The campaign goal: every screen matches its v12 frame on desktop AND phone.
Authority: docs/design/*.dc.html (v12 geometry), DESIGN-RULINGS.md (rulings),
DEVIATIONS.md (user overrides). This file is the campaign mandate the planner
works from, tiered.

## TIER 0 (2026-08-19 meta-probe, VERIFIED reds — work these before all else)
docs/probes/metafid-phoneA-2026-08-19.md (clusters A) AND docs/probes/metafid-phoneB-ssr-2026-08-19.md (clusters B+SSR) are the verified red sets, plus docs/probes/metafid-desktop-2026-08-19.md (desktop: one campaign regression + edges). The two CRITICALS in B are being fixed by a META lane — do not duplicate; take everything else. Start with
its two disproportionate root fixes (bordered-control negative-margin misuse;
settings section-action floor), then the S1 breaks, then S2 structure.

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
  fix; (b) correct the false doc; (c) lens: audit scribe-authored DEC docs
  from waves 10-11 for claims not backed by the diff, AND audit css/code
  comments for citations of DECs that do not exist (found: agenda.css cites
  a "DEC-021 delta-2 amendment" that grep cannot find; the 9f12f7ce commit
  body also justified its overlay on a false premise).
- Pre-existing UX bug (portal edit): "Add co-presenter" is a full-page POST that
  silently discards unsaved title/abstract/track edits (a55cce81, by the page's
  own inviting copy order). Schedule a fix (preserve the draft across the POST or
  make the add row-scoped).

## RULED (user, 2026-08-19): D19 cross-event switch — explicit, never silent
The URL write-through in useCurrentEvent.ts:90 stays (page and context move
together; the app keeps its one-event-at-a-time invariant), but the moment a
URL eventId OVERWRITES a different stored context, announce it: a banner
"Switched to <event B> · Back to <event A>" with a one-click return. No
transient/split-view state. Pin: navigating with a URL eventId equal to the
stored context shows no banner; differing shows exactly one, and the return
link restores the prior context.

## Scheduled: D21 stale-while-revalidate cache (swarm task)
lib/api.ts gains an SWR cache keyed on URL + the existing mutation-bump
counter: render last-known data on revisit (no skeleton when a cached
payload exists), refetch in background, reconcile. Respect the bump counter
for invalidation; add cross-page tests (contacts, speakers, submissions).

## Ruling needed (from the tracks/rooms refusal fix, bbcf8b06)
`discardDirtyAndClose` clears row errors but not the add forms' field errors,
so Done-with-discard parks an add refusal for the next drill-in. Needs a
ruling: does Done-discard also drop an unsaved add draft + its refusal?

## Citation corrections for the doc-integrity lens
- Commit 69baba8d and any comments citing DEC-919 for always-mounted bulk
  bars: correct authority is DEC-752/DEC-825 (DEC-919 is the public filter
  idiom). Sweep code comments for the propagated miscitation.
- Anywhere citing DEC-302 for flag-not-block scheduling: correct authorities
  are DEC-010 waves 66/71, DEC-557 clause (f), DEC-377, SPEC J9 (DEC-302 is
  npm audit advisories).

## Deferred design question (agenda 390, ruled interim by meta)
Publish schedule survives as the head's full-width action row (DEC-919
remedy). Whether it belongs in the phone dock instead is a frame deviation
needing a proper ruling later — the frame's dock draws only
Unscheduled + Auto-schedule.
