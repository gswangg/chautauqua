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
- FINDINGS w14 (all LANDED except task-w14-d unmerged .chq-field-invalid
  specificity, do NOT re-file; task-w13-b/-c refs still UNMERGED, stay owned).
  RULED DELIBERATE: send.ts's unconditional ics_sequence bump. Shapes: A CLASS
  THAT LOSES TO A TYPE SELECTOR IS A RULE NOBODY DRAWS. AN ACCUMULATOR WITH A
  THROWING HELPER REPORTS THE FIRST PROBLEM AND FORGETS THE REST. A PRE-CHECK
  IS NOT A CONSTRAINT. A SAVE BUTTON OUTSIDE A FORM COSTS A MOUSE TRIP/EDIT.
- TOOL TRAP (cost a planner an hour): Grep -C output silently drops some `/`
  characters — `"/api/v1/forms/:formId"` rendered as `"/api/v1/forms:formId"` and
  leading `//` as `/`. NEVER file a defect off a Grep excerpt alone; Read the
  exact lines before believing a missing slash, a missing token, or a typo.
- FINDINGS w15 (planned by reading main while the w14 merge train ran; main MOVED
  mid-planning). CORRECTION to the w14 note: w14-a/-b/-c ALL LANDED (bulk-email.ts:214
  intra-batch+window dedupe, breaks.ts:132 collectBoundedText accumulation, users.ts:106
  + events.ts:185 onConflictDoNothing). task-w14-d (.chq-field-invalid specificity) has
  a ref and is UNMERGED -- do NOT re-file. task-w14-e NEVER EXISTED (no ref); CNT-S3 was
  unowned and is taken here as w15-a. RE-VERIFIED CLOSED this wave, do NOT re-file:
  `q` IS in hasActiveNarrowing (OnboardingGrid.tsx:130); results head is single
  (ResultsTable.tsx:285,327); public agenda never renders TBD (ruling A25); public
  session-detail HAS the itinerary toggle (detail.tsx:124, ruling A26); toCsv neutralizes
  formula injection (lib/csv.ts:150); submission seq is an atomic subquery; import
  contactIds ARE deduped (import.ts:272 addContactId); reviewer file authz excludes
  anonymized + closed plans (files-authz.ts:205-210); dev mailbox is mount-gated.
  VERIFIED OPEN and filed: send.ts has the DEC-238 WINDOW but no intra-batch collapse
  (its sibling's comment claims parity it does not have); MAX_PARTICIPANTS_PER_SUBMISSION
  is enforced at 2 of 4 doors (CSV roster import + Sessionboard import bypass it);
  updateEvent guards event_slug_idx with isSlugTaken and no catch (500, not the 400 the
  route documents 170 lines above); the mail envelope recipient skips addressValue while
  its own To: header does not; the submission-detail editors are divs (only 6 <form>
  elements exist in the entire SPA). Shapes: A COMMENT THAT CLAIMS PARITY IS NOT PARITY.
  A CAP AT TWO OF FOUR DOORS IS A SUGGESTION. AN INSERT GUARD IS NOT AN UPDATE GUARD.
  THE ONE CALL SITE THAT SKIPS THE SANITIZER IS THE ONE THAT MATTERS.
