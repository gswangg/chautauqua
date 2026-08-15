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
- FINDINGS w2-69 (all LANDED, compacted): DateField/search, caps unified
  to src/domain, logout, CSV dup, compose step-4, canEditSubmission,
  reviewer scope null->LIST, evaluation lattice, date grammars, error
  vocabulary (V9), locked-field/minutes/score/clock single sources. w69:
  SWARM REBOOTED at gate-7. Shapes: A CAP ONLY IN THE SPA IS A
  SUGGESTION. A FIELD PARSED AND NEVER READ IS THE CAP NOBODY IS TOLD
  ABOUT.
- FINDINGS w8-11 (all LANDED, heavily compacted): session-card, compose,
  history pager, edit-lock, icsChip, trackIds dedup+cap, plan window,
  saved-view cap lockout, /logout POST, unsendable-template (DEC-856),
  reviewer single-plan skip (DEC-874), track HIGHLIGHT-not-filter
  (DEC-851), .ics SEQUENCE, acceptance/auto-schedule write caps, CI full
  suite. Shapes: A HANDOFF THAT DROPS THE SELECTION ASKS THE SAME
  QUESTION TWICE. A CONSTANT ONLY THE SEED SATISFIES IS A DEMO. A
  FAN-OUT WITH NO PRE-WRITE CAP IS A HALF-WRITE.
- FINDINGS w12 (SWEPT CLEAN, compacted): schedule.ics whole-agenda vs
  ?ids=, expandRecipients cap, deleteTrack/Room 409, conditional-
  visibility fixed point, saved-view authorship cap, breaks cross-field
  midnight, CSV/import caps, home 820/34px. Shapes: A KNOB TABLE THAT
  DRIFTS BY COMMENT IS PROSE, NOT A CONTRACT. A CAP ON ONE DOOR IS A
  COUNTDOWN THE OTHER DOOR SPENDS.
- FINDINGS w13 (planned by reading main + .git refs, not a report; w12-a/b/c/e
  are OWNED branches with refs and NO merge — knob table, saved-embed surface,
  participant cap, role conversion follow-ups — and w12-d/f had no ref yet: do
  NOT re-file any of them). w10-b LANDED late (last reflog entry): role is now
  the ONE matcher, literals deleted, createDefaultForm + seed both stamp role.
  SWEPT CLEAN this wave, do NOT re-file: hub `past` inherits cfpOpen (fixed),
  GET / unseeded 500 (w11-a fresh-state branch), distribute pre-write cap
  (w11-b MAX_DISTRIBUTE_ASSIGNMENT_WRITES + preview writeCapExceeded),
  addReviewers duplicates (w11-c), saved-embed creation cap (DEC-822), compose
  100-cap (domain/compose.ts), acceptance back-fill fan-out (DEC-932 wave-6
  amendment: DENSE ON PURPOSE), reviewer multi-track label, npm run deploy,
  contact merge keepId, bearer-token CSRF exemption, file-version chain
  repoint, hasActiveNarrowing incl. q, createDefaultForm's role-tagged
  Format/Audience fields. VERIFIED OPEN and filed: PATCH /submissions/:id
  never parses `audienceLevel`, PATCH .../participants/:pid never parses
  `role` — both SPA controls 400 today, refusal names WRONG field;
  form_field.role has one minting site, no repair path (deletable, not
  restorable); role selects silently no-op when field absent; two retired
  constants still cited in ~10 comments (reviewer re-derived a closed
  finding from them). Shapes: A KEY THE CLIENT SENDS AND NO ROUTE PARSES IS
  A BUTTON THAT 400s. A REFUSAL KEYED ON A FIELD NOBODY SENT PAINTS THE
  WRONG CONTROL. A ROLE WITH ONE MINTING SITE AND NO REPAIR PATH IS A TRAP.
  `if (!x) return;` IS A DEAD CLICK. A COMMENT CITING A DELETED SYMBOL IS A
  CITATION NOBODY CAN CHECK.
