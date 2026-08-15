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
- FINDINGS w8-13 (all LANDED/SWEPT, heavily compacted): session-card, compose,
  history pager, edit-lock, icsChip, trackIds dedup+cap, plan window, saved-
  view cap lockout, /logout POST, unsendable-template (DEC-856), reviewer
  single-plan skip (DEC-874), track HIGHLIGHT-not-filter (DEC-851), .ics
  SEQUENCE, acceptance/auto-schedule write caps, schedule.ics ?ids=, deleteTrack
  /Room 409, conditional-visibility fixed point, breaks midnight, CSV/import
  caps, home 820/34px, role-is-ONE-matcher, distribute pre-write cap,
  addReviewers dup, saved-embed cap, compose 100-cap, acceptance back-fill
  fan-out (DEC-932), contact merge keepId, bearer-token CSRF exemption, file-
  version chain repoint, audienceLevel/role PATCH parsing (DONE by w13-a).
  Shapes: A HANDOFF THAT DROPS THE SELECTION ASKS THE SAME QUESTION TWICE. A
  FAN-OUT WITH NO PRE-WRITE CAP IS A HALF-WRITE. A KNOB TABLE THAT DRIFTS BY
  COMMENT IS PROSE, NOT A CONTRACT. A KEY THE CLIENT SENDS AND NO ROUTE
  PARSES IS A BUTTON THAT 400s.
- FINDINGS w14 (planned by reading main + .git refs mid-merge-train; main MOVED
  during planning — task-w13-a LANDED while this was written, so audienceLevel +
  participant role PATCH parsing is DONE; task-w13-b/-c refs still exist UNMERGED
  and stay owned: do NOT re-file form_field.role's two-way door or the dead role
  selects). RE-VERIFIED STALE, do NOT re-file: trackIds dedupe (both doors —
  api/submissions.ts:128 and public/submit-body.ts:79), reviewer plan window on
  GET detail + file authz (reviewer.ts:288, files-authz.ts:209), saved-view cap is
  AUTHORSHIP (views.ts:87 countSavedViewsCreatedBy), schedule.ics ?ids= 300 cap,
  Add-a-track/room ARE tertiary section actions (frame lines 822/838), hub GET /
  auth redirect, portal-invite re-mint is safe (DEC-949 48h supersede grace),
  content-notes already mails only ACTIVE-invite participants. RULED DELIBERATE,
  leave alone: send.ts's unconditional ics_sequence bump (a SEQUENCE gap is
  harmless; a missed bump is not). VERIFIED OPEN and filed: CRM bulk-email has no
  DEC-238 window and no per-address collapse; validateBreakWrite accumulates but
  calls two THROWING parsers; createUser/createEvent guard a UNIQUE index with
  SELECT-then-INSERT (500, not the documented 409/400); `.chq-field-invalid`
  (0,1,0) LOSES to theme.ts's `input[type=...]` base group (0,1,1) on every SSR
  surface; the submission editor is a div, not a form. Shapes: A CLASS THAT LOSES
  TO A TYPE SELECTOR IS A RULE NOBODY DRAWS. A HALF-DEAD VOCABULARY PASSES EVERY
  CLASS-PRESENCE TEST. AN ACCUMULATOR WITH A THROWING HELPER REPORTS THE FIRST
  PROBLEM AND FORGETS THE REST. A PRE-CHECK IS NOT A CONSTRAINT. A SAVE BUTTON
  OUTSIDE A FORM COSTS A MOUSE TRIP PER EDIT.
- TOOL TRAP (cost this planner an hour): Grep -C output silently drops some `/`
  characters — `"/api/v1/forms/:formId"` rendered as `"/api/v1/forms:formId"` and
  leading `//` as `/`. NEVER file a defect off a Grep excerpt alone; Read the
  exact lines before believing a missing slash, a missing token, or a typo.
