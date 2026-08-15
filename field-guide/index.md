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
- FINDINGS w14 pre-notes: task-w13-b/-c refs UNMERGED, stay owned. RULED
  DELIBERATE: send.ts's unconditional ics_sequence bump. Shapes: A CLASS THAT
  LOSES TO A TYPE SELECTOR IS A RULE NOBODY DRAWS. A PRE-CHECK IS NOT A
  CONSTRAINT. A SAVE BUTTON OUTSIDE A FORM COSTS A MOUSE TRIP/EDIT.
- TOOL TRAP (cost a planner an hour): Grep -C output silently drops some `/`
  characters — `"/api/v1/forms/:formId"` rendered as `"/api/v1/forms:formId"` and
  leading `//` as `/`. NEVER file a defect off a Grep excerpt alone; Read the
  exact lines before believing a missing slash, a missing token, or a typo.
- FINDINGS w14/w15 (compacted): w14-a/-b/-c LANDED (bulk-email dedupe, breaks
  accumulation, onConflictDoNothing); task-w14-d (.chq-field-invalid specificity) has a
  ref, UNMERGED, do NOT re-file. w15 re-verified closed prior suspects (q narrowing,
  results head, public agenda/session-detail, CSV formula neutralize, import dedupe,
  reviewer file authz, dev mailbox gate) and filed real gaps: send.ts window w/o intra-
  batch collapse, MAX_PARTICIPANTS enforced at 2 of 4 doors, updateEvent 500 not 400,
  mail envelope skips addressValue. Shapes: A CAP AT TWO OF FOUR DOORS IS A SUGGESTION.
- FINDINGS w16 (VERIFICATION WAVE; planned by reading main c0b14342). REF TRUTH at
  planning: task-w14-d AND task-w15-a/-b/-c/-d/-e all have refs and are ALL UNMERGED
  (updateEvent still unguarded events.ts:215-243; send.ts:112-139 window but no
  intra-batch collapse; sessionboard.ts:500-660 no participant cap). task-w15-f NEVER
  EXISTED; its scope (mail envelope) taken as w16-a. DISMISSED after re-verification, do
  NOT re-file: trackIds dedupe (submissions.ts:127-131, submit-body.ts:71-79); reviewer
  plan-window on read (reviewer.ts:283-290) and file authz (files-authz.ts:191-210);
  saved-view cap IS authorship (views.ts:82-97 -> repo/views.ts:129-143). ALSO VERIFIED
  BUILT while hunting: Home hub + auth redirects, saved-embed ?embed resolver w/
  DEC-822 empty-200, password reset 4 states, /logout POST + ?signed-out=1, per-version
  delete w/ newest-confirms, content-note mailer, distribute preview, phone triage cards,
  files-library column swap + orphan row. Shapes: A RULE ENFORCED AT THE HEADER AND NOT
  THE ENVELOPE IS NOT A RULE. A RESEARCH-RENDER PIXEL NEVER OUTRANKS THE VENDORED WIDTH
  RULE (1372@114 IS 1440+34 at 1600). TWO HARNESS LANES SHARING A PORT MEASURE EACH
  OTHER. WHEN NOTHING IS LEFT TO BUILD, THE RISK IS UNMEASURED, NOT UNBUILT.
