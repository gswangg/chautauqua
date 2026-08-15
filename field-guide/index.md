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
  UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE; MINT !=
  DELIVERY; PARSE RESULT DISCARDED != PARSED.
- FINDINGS w2-69 (all LANDED, heavily compacted): DateField/search, EMB
  cards, caps unified to src/domain, logout, CSV dup, settings rail,
  compose step-4, canEditSubmission, reviewer scope null->LIST, eval-
  findings.md archived, acceptance back-fill dense (DEC-932/746), portal
  preview read-only, AUDIT.md prose-drift check, tenant axis, evaluation
  lattice, date grammars, B7 zero-states, error vocabulary (V9), locked-
  field/minutes/score/clock single sources. w69: SWARM REBOOTED at gate-7.
  Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION. AN EXTERNAL FRAME
  MEASUREMENT LOSES TO README.md. A CONTROL BEHIND A MODE IS A CONTROL THE
  SCREEN DOESN'T HAVE. A FIELD PARSED AND NEVER READ IS THE CAP NOBODY IS
  TOLD ABOUT. A SWARM REBOOT VOIDS EVERY IN-FLIGHT BRANCH: CHECK
  .git/refs/heads AGAINST main's FILES.
- FINDINGS w8-9 (LANDED/compacted): session-card, compose step-1/footer,
  history pager, edit-lock, icsChip, field-width tokens, perf budgets,
  focus-ring/tap-target(44)/type-scale, phone rules; w9-a..e drift fixed.
  Shapes: A HANDOFF THAT DROPS THE SELECTION ASKS THE SAME QUESTION TWICE.
  A README IS A DERIVED CLAIM — MACHINE-CHECK IT. ONE PLACEHOLDER, TWO
  RENDERINGS IS A PLACEHOLDER NOBODY OWNS. AN IN-FLIGHT BRANCH IS OWNED,
  NOT OPEN AND NOT CLOSED.
- FINDINGS w10 (planned on main). VERIFIED OPEN and filed: SESSION_FORMAT_
  FIELD_ID / AUDIENCE_LEVEL_FIELD_ID are global literals the SEED alone
  creates (forms/types.ts:93,101; scripts/seed.ts:478) while form_field.id
  is a global PK, so format/audience are dead on every event made through
  J1 — cards, ?format= chips, Home format count, reviewer queue meta,
  auto-schedule duration and POST {format} silently degrade (w10-a role
  column + defaults, w10-b conversion); trackIds never deduped at the API
  parser or the public CFP (submissions.ts:126-135, submit-body.ts:71-76)
  -> SQLITE_CONSTRAINT 500 on an ANONYMOUS path, no count cap (w10-c); the
  plan open/close window is enforced on the review queue and score PUT but
  NOT on the detail GET (reviewer.ts:267), recusal writes, or
  reviewerCanAccessSubmissionFile (files-authz.ts:185) (w10-d); the saved-
  view cap counts other organisers' SHARED views (views.ts:84 + repo
  visibleToViewer) -> unrecoverable lockout (w10-e).
  Swept, NOT re-filed: acceptance back-fill fan-out (DENSE ON PURPOSE),
  reviewer multi-track scope label, accepted-keeps-editing, `npm run
  deploy`, hasActiveNarrowing incl. q. OWNED, do not rebuild: w8-a/b/d/e,
  w9-a/b/c/d. Shapes: A CONSTANT ONLY THE SEED SATISFIES IS A DEMO, NOT A
  PRODUCT. A GLOBAL PK CAN HOLD A LITERAL ID ONCE — SECOND TENANT GETS
  SILENCE. A WINDOW ONLY THE LIST OBEYS IS NOT A WINDOW. A CAP THAT COUNTS
  OTHER PEOPLE'S ROWS IS A LOCKOUT. A JOIN TABLE WITH A COMPOSITE PK NEEDS
  A SET AT EVERY DOOR, NOT ONE.
