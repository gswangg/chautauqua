# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email;
  authz every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; dates via event-time.ts; pagination ONE shape+
  count*+id asc; atomic SQL>read-then-write; uniqueIndex CONTRACT; MINTING
  IS IO; UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE.
- FINDINGS w2-24 (heavily compacted): DateField/search/CSV/compose/reviewer-
  scope/error-vocab/locked-field/write caps unified; contact merge, CSRF,
  bulk-email dedupe, table-layout, sub-pixel geometry, role="cell" wraps not
  replaces, bleed-vs-clamp, citations must quote, FIELD ORGANISER WRITES
  THAT NO SURFACE READS. TOOL TRAP: Grep -C drops some `/`. LINE NUMBER IS
  NOT AN IDENTITY. RULING WITH NO SCAN DRIFTS BACK. REF LIST IS A SNAPSHOT.
- FINDINGS w25-27 (compacted): MANDATE WAS MEASURED ALL ALONG — a code read
  invents defects, a gate finds them; read newest verification-log DETAIL
  first (DEC-620, DEC-976 quoted-line-or-rumour, DEC-129 suffix-sha-never-
  overwrite). THE RED TEST WAS THE MANDATE. FAN-OUT OWNS ITS OWN CLEANUP
  (DEC-530). KV IS NOT A PURGE BUS (DEC-083). A GATE'S OWN RECEIPT IS THE
  MANDATE (DEC-069/129). LINE-HEIGHT 1 IS A CLIP (DEC-991). CHECK PASSING 9x
  HAS STOPPED CHECKING (DEC-063). Trust `.git` refs for OWNERSHIP, working
  tree for STATE, never conflate.
- FINDINGS w28 (compacted): AN ASSERTION OUTLIVES WHAT IT MEASURED (DEC-244,
  a check depends only on state it created or a literal it re-reads, fix by
  CREATING state not lowering the number). A GATE MEASURES THE PRODUCT TREE
  (DEC-069, void-sha = newest `src/**`/`app/src/**`/`migrations/**`/
  `package.json`; `scripts/**`+`test/**` allow-listed). Repairing a lying
  instrument BEFORE the run is a precondition, not a merge that voids the
  reading (DEC-453). A required gate whose lane has a live branch is
  PENDING-OWNED(<branch>) — never absent, never PASS by inference (DEC-453).
- FINDINGS w29 (main `3564c774` after `c6dbdb7c` "scribe wave 28"; w28 lanes
  b/d/e = zero commits, a/c carry work. The w27-b "37 failing tests" receipt
  is STALE: measured `ceda66f2`, one commit before merge repair `d8974cf6`.
  A RECEIPT'S BOUNDARY OUTRANKS ITS PROSE.)
- A GATE'S OWN INSTRUMENTS LIE HALF THE TIME (w29): of 5 "open" render-sweep
  items, 3 were the probe, 1 was the CSS. `.chq-cfp-step-next` is
  `display:none` at desktop (phone-only wizard) while the focus probe Tabs
  for it at desktop — unreachable BY CONSTRUCTION. A VIEWPORT IS STATE
  (DEC-409): a probe declares the viewport it measured. TWO PROBES CANNOT
  DISAGREE ABOUT ONE ELEMENT (DEC-426). THE DISABLED REGISTER IS EXEMPT BY
  WCAG 1.4.3, NOT A DEFECT — exemptions print their citation (DEC-426).
- A LINE QUOTED OUT OF ITS SECTION IS A RUMOUR WITH A CITATION (DEC-976 w29):
  a finding cited `README.md:350` for the ADMIN speakers toolbar; `:345`
  heads that block "Public filter bar" — already built twice. Cite `path:line`
  AND the enclosing heading; cross-heading findings are VOID.
- A COUNT IS NOT A LICENCE TO SCAN (DEC-829/DEC-773 w29): the two worst reads
  pay whole-population cost for one number. Onboarding grid drives 3
  statements off `from contact` via correlated EXISTS — 116ms/800 contacts,
  995ms/6,000, measures the ORG DIRECTORY not the roster. Files library
  materializes every chain so JS sums sizeBytes despite its header claiming
  no whole-event scan — 474ms, worst read measured. DRIVING RELATION IS THE
  SCOPED SET; TOTALS ARE AGGREGATES. `headshot_url='/headshots/'||file.id`
  is a JOIN PREDICATE NO INDEX CAN SERVE.
- DEC space FULL (001-999); w29 amended DEC-829/773/409/426/830/976.
