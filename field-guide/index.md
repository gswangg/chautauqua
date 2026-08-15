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
  set-based; D1 PRIMITIVES; dates via event-time.ts; pagination ONE
  shape+count*+id asc; atomic SQL > read-then-write; uniqueIndex CONTRACT;
  MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE.
- FINDINGS w2-13 (all LANDED/SWEPT, heavily compacted): DateField/search, caps
  unified to src/domain, logout, CSV dup, compose step-4, canEditSubmission,
  reviewer scope null->LIST, evaluation lattice, date grammars, error
  vocabulary (V9), locked-field/minutes/score/clock single sources,
  session-card/history-pager/edit-lock/icsChip/trackIds/plan-window/
  saved-view caps, .ics SEQUENCE, write caps (distribute, addReviewers,
  saved-embed, compose-100), contact merge keepId, CSRF exemption,
  audienceLevel/role PATCH. w69: SWARM REBOOTED at gate-7. Shapes: A CAP ONLY
  IN THE SPA IS A SUGGESTION. A HANDOFF THAT DROPS THE SELECTION ASKS THE
  SAME QUESTION TWICE. A FAN-OUT WITH NO PRE-WRITE CAP IS A HALF-WRITE. A
  KNOB TABLE THAT DRIFTS BY COMMENT IS PROSE, NOT A CONTRACT.
- TOOL TRAP: Grep -C drops some `/` chars (e.g. `//` -> `/`). NEVER file a
  defect off a Grep excerpt alone; Read exact lines first.
- FINDINGS w14-17 (all LANDED/DISMISSED, compacted): bulk-email dedupe, breaks
  accumulation, onConflictDoNothing, mail envelope addressValue, trackIds
  dedupe, reviewer plan-window/file authz, saved-view cap, ENVELOPE_ALLOWLIST
  path:line drift (envelope-sites.ts, -> w18-g), mandate rebase (-> w18-h).
  VERIFIED BUILT: Home hub/auth redirects, saved-embed empty-200, password
  reset 4 states, /logout POST, per-version delete, distribute preview.
  w16-c/-d, w17-a/-b all = their base: FOUR runtime lanes, ZERO commits ->
  DEC-119 wave-18 amendment bans server-booting worker lanes. Shapes: A CAP
  AT TWO OF FOUR DOORS IS A SUGGESTION. A LINE NUMBER IS NOT AN IDENTITY. A
  STALE MANDATE COSTS MORE THAN NO MANDATE.
- FINDINGS w18 (READ .git at tip 62685d2e, not inherited). REF TRUTH: w17
  committed NOTHING (task-w17-a/-b both = 5fc3db38, main's parent). RULE
  (DEC-119 amendment): no worker lane boots a server; merge train's own
  full-suite + build via scripts/with-test-lock.sh is the measurement.
  Branch names REUSED across generations — only refs + log tail are
  evidence. LANDED as amendments (space CLOSED, no new DEC ids): DEC-340
  onboarding grid unknown filter token now 400s not silent no-filter
  (tasks.ts:156-172); DEC-346 isSubmissionInReviewerScope shares sibling's
  cap/order/refusal (submissions.ts:396 vs :241); DEC-967 compose defaults
  statusFilter=['accepted'] only, not accepted+declined union
  (ComposeWizard.tsx:32-35); DEC-317 ics-unscheduled refusal hoisted to a
  wizard-level banner on every step, not just preview (:399-419 vs :1056);
  DEC-902 files-library table-layout:fixed + explicit actions width, File is
  sole remainder col (content.css:818-822); DEC-989 Content page per-view
  measure class on chq-page root, mirrors Comms; DEC-890 Templates rows
  carry only name, Delete moves to editor panel (TemplatesTab.tsx:232-247);
  DEC-603 History gets head + Export CSV link onto existing email-log export
  (exports.ts:120-147). DISMISSED: answerFieldRoleCondition missing event
  join (form-roles.ts:16 — answer-set-scoped by contract, joining would
  blank non-default-form answers). Shapes: A REFUSAL THAT RENDERS ON A STEP
  YOU CANNOT REACH IS A DEAD END. A CAPABILITY WITH NO DOOR IS NOT SHIPPED.
  TWO UNWIDTHED COLUMNS MEANS THE LAST ONE EATS THE MEASURE. A DEFAULT THAT
  UNIONS TWO DECISIONS SENDS THE WRONG MAIL ON THE SHORTEST PATH.
