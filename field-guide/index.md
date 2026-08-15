# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; dates via event-time.ts OWNING EVENT's tz;
  pagination ONE shape+count*+id asc; atomic SQL > read-then-write;
  uniqueIndex CONTRACT; MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED;
  GUARD THAT NARROWS < NONE; MINT != DELIVERY.
- FINDINGS w2-69 (all LANDED, compacted): DateField/search, caps unified to
  src/domain, logout, CSV dup, compose step-4, canEditSubmission, reviewer
  scope null->LIST, evaluation lattice, date grammars, error vocabulary (V9),
  locked-field/minutes/score/clock single sources. w69: SWARM REBOOTED at
  gate-7. Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION.
- FINDINGS w8-13 (all LANDED/SWEPT, heavily compacted): session-card/compose/
  history-pager/edit-lock/icsChip/trackIds/plan-window/saved-view caps, .ics
  SEQUENCE, write caps (schedule.ics ?ids=, distribute, addReviewers, saved-
  embed, compose-100, acceptance back-fill DEC-932), contact merge keepId,
  bearer-token CSRF exemption, audienceLevel/role PATCH (DONE by w13-a).
  Shapes: A HANDOFF THAT DROPS THE SELECTION ASKS THE SAME QUESTION TWICE. A
  FAN-OUT WITH NO PRE-WRITE CAP IS A HALF-WRITE. A KNOB TABLE THAT DRIFTS BY
  COMMENT IS PROSE, NOT A CONTRACT. A KEY THE CLIENT SENDS AND NO ROUTE
  PARSES IS A BUTTON THAT 400s.
- TOOL TRAP (cost a planner an hour): Grep -C output silently drops some `/`
  characters — `"/api/v1/forms/:formId"` rendered as `"/api/v1/forms:formId"` and
  leading `//` as `/`. NEVER file a defect off a Grep excerpt alone; Read the
  exact lines before believing a missing slash, a missing token, or a typo.
- FINDINGS w14-16 (compacted, LANDED): bulk-email dedupe, breaks accumulation,
  onConflictDoNothing, mail envelope addressValue, trackIds dedupe, reviewer
  plan-window/file authz, saved-view cap. VERIFIED BUILT: Home hub/auth
  redirects, saved-embed ?embed + DEC-822 empty-200, password reset 4 states,
  /logout POST, per-version delete, content-note mailer, distribute preview,
  files-library column swap. Shapes: A CAP AT TWO OF FOUR DOORS IS A
  SUGGESTION. A RULE ENFORCED AT THE HEADER AND NOT THE ENVELOPE IS NOT A
  RULE. TWO HARNESS LANES SHARING A PORT MEASURE EACH OTHER.
- FINDINGS w17 (planned by READING .git at tip 9b21309c, not inheriting). REF TRUTH
  CORRECTION: w16's "task-w14-d + w15-a..-e all UNMERGED" was FALSE — reflog shows
  merges for w14-d, w15-a/-b/-c/-d/-e/-f and w16-a; those refs are deleted. w16-b
  (6aed4fe0) and w16-e (bdaf3997) have commits, UNMERGED, still owned. w16-c and
  w16-d BOTH point at c557cff9 = main's PARENT: zero commits, so walkthrough and
  perf-smoke NEVER RAN; w16-f never got a ref. DISMISSED after re-verification, do
  NOT re-file: bulk-email dedupe (bulk-email.ts:214-250), createUser onConflict
  (users.ts:106-124), breaks accumulation (breaks.ts:130-166), send.ts ics bump
  (send.ts:243-258, deliberate), MAX_PARTICIPANTS at ALL FOUR doors (submissions.ts:598,
  portal-edit.ts:487, contacts/import.ts:194, sessionboard.ts:622), envelope addressValue
  (email-binding.ts:236-240). ALSO CLOSED while sweeping: hasActiveNarrowing includes q
  (OnboardingGrid.tsx:128-135), no localhost:PORT literal in app/src, no TBD on
  src/routes/public (ruling A25), pubcache two-list closed enumeration + scan test.
  REAL DEFECT FOUND AND OWNED (w17-f): ENVELOPE_ALLOWLIST keys on path:line
  (envelope-sites.ts:33-73), drifted 5x. Shapes: A BRANCH WHOSE REF EQUALS ITS BASE
  MEASURED NOTHING. A LINE NUMBER IS NOT AN IDENTITY. A STALE MANDATE COSTS MORE THAN
  NO MANDATE. AN EXEMPTION THAT MATCHES NOTHING MUST FAIL LOUDLY, NOT PASS QUIETLY.
