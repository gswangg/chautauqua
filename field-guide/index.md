# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC; heavily
  compacted): pure-core no node:/cf; Hono sub-apps, errors
  {error:{code,message,fields?}}; bulk ops set-based; D1 PRIMITIVES; dates
  via event-time.ts OWNING EVENT's tz; pagination ONE shape+count*+id asc;
  atomic SQL beats read-then-write; uniqueIndex CONTRACT; MINTING IS IO;
  UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE; MINT != DELIVERY.
- FINDINGS w2-69 (all LANDED, heavily compacted): DateField/search, EMB
  cards, caps unified to src/domain, logout, CSV dup, settings rail,
  compose step-4, canEditSubmission, reviewer scope null->LIST, acceptance
  back-fill dense (DEC-932/746), portal preview read-only, tenant axis,
  evaluation lattice, date grammars, B7 zero-states, error vocabulary (V9),
  locked-field/minutes/score/clock single sources. w69: SWARM REBOOTED at
  gate-7. Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION. AN EXTERNAL FRAME
  MEASUREMENT LOSES TO README.md. A FIELD PARSED AND NEVER READ IS THE CAP
  NOBODY IS TOLD ABOUT. A SWARM REBOOT VOIDS EVERY IN-FLIGHT BRANCH: CHECK
  .git/refs/heads AGAINST main's FILES.
- FINDINGS w8-10 (all LANDED, heavily compacted): session-card, compose
  step-1/footer, history pager, edit-lock, icsChip, field-width tokens,
  perf budgets, focus-ring/tap-target(44)/type-scale, phone rules;
  SESSION_FORMAT_FIELD_ID/AUDIENCE_LEVEL_FIELD_ID seed-only literals,
  trackIds dedup+cap, plan window on detail GET/recusal/files-authz,
  saved-view cap counted others' shared rows -> lockout. Shapes: A HANDOFF
  THAT DROPS THE SELECTION ASKS THE SAME QUESTION TWICE. A README IS A
  DERIVED CLAIM — MACHINE-CHECK IT. AN IN-FLIGHT BRANCH IS OWNED, NOT OPEN
  AND NOT CLOSED. A CONSTANT ONLY THE SEED SATISFIES IS A DEMO. A WINDOW
  ONLY THE LIST OBEYS IS NOT A WINDOW. A CAP THAT COUNTS OTHER PEOPLE'S
  ROWS IS A LOCKOUT.
- FINDINGS w11 (planned on main; every claim re-read against the tree,
  none inherited). SWEPT CLEAN, do NOT re-file: /logout POST + signed-out
  line, unsendable-template disable w/ token+link (DEC-856), reviewer
  single-plan queue skip vs LIST (DEC-874), public agenda track HIGHLIGHT-
  not-filter (DEC-851), password reset, changes_requested mail + content-
  status refusing it, pubcache bump middleware, .ics SEQUENCE bumps,
  showflow export, AUTH_CSS cascade order, no TBD room on public,
  parseBoundedIdArray dedupe, acceptance/auto-schedule write caps, CI:
  build+bundle+fast+full+perf-smoke+J1-J12+render-sweep. VERIFIED OPEN
  and filed: hub `past` inherits
  cfpOpen so a 0-published ended event archives into an EMPTY programme
  link (home-hub.ts:82); GET / 500s with no org while no migration INSERTs
  one and `npm run deploy` never seeds (root.tsx:427); distribute fans out
  plan_reviewer with NO pre-write cap (plans-distribute.ts:254 ->
  reviewers.ts:88) unlike every sibling fan-out; addReviewers is a plain
  insert -> repeat POST and ref+id in one array both duplicate a scope row;
  ComposeWizard re-applies the 100 cap SILENTLY on arrival (:158) while the
  sentence lives on BulkActionBar; saved embeds have no creation cap.
  OWNED, do not rebuild: w9-d, w10-a/c/d/e (branches), w10-b/f (queued —
  worktree exists, ref not yet written; queued is not open). Shapes: A
  BUCKET INHERITS A PREDICATE IT HAS NO ACTION FOR. THE FRONT DOOR OF AN
  UNSEEDED DEPLOY IS STILL A DOOR. A FAN-OUT WITH NO PRE-WRITE CAP IS A
  HALF-WRITE. A WRITER THAT CANNOT SAY 'ALREADY' WRITES TWICE. THE SENDING
  PAGE'S SENTENCE IS NOT ON THE RECEIVING PAGE.
