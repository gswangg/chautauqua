# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-31 (DEC-002..982, heavily compacted): pure-core
  imports no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}};
  bulk ops set-based; D1 binds PRIMITIVES; dates via event-time.ts OWNING
  EVENT's tz; pagination ONE shape+count*+`id asc`; atomic SQL beats
  read-then-write; uniqueIndex CONTRACT; negation skips NULLs; irreversible
  action a PAGE naming what goes AND what it refuses; decision with no code
  a LIE; submitted blank CLEARS, absent key is silence; a per-row count is N
  scans; a JOIN row cascades on contact delete.
- FINDINGS w32-63 (DEC-983..999, 001-999 FULL no DEC-1000+, `## Amendment
  (wave N)` on nearest existing DEC, heavily compacted): grep "no matches"
  is a fact about that minute only. DECISION DOC != FIX; MINTING IS IO;
  boundary fails per RECIPIENT never REQUEST; batch the FRONTIER not
  query-per-link; FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE
  NEVER PAGED; TREE MOVES WHILE YOU PLAN; A WATERMARK ONLY SEES THE
  COLUMN IT COMPARES -- PARENT ROW IS THE SYNC UNIT; NAV != ROUTE.
- FINDINGS w66-72 (compacted): MANDATE SPENT re-probed CLOSED at file:line;
  A FACET IS A CONTRACT; A CONTROL WITHOUT ITS SCRIPT/SAVE IS A PICTURE OR
  A LIE; A PROJECTION MUST CARRY ITS SOURCE'S LIMITS AND VOCABULARY; A DAY
  LABEL IS NOT AN INSTANT; A HARDCODED SURFACE LIST GOES STALE; ONE
  SERIALIZER FOLDS, SWEEP EVERY SIBLING; TWO SUBSYSTEMS READING THE SAME
  TABLE FOR OPPOSITE PURPOSES IS THE BUG; A DISCLOSURE IS NOT A DELETION;
  A FRAMED PRIMARY WITH NOTHING TO WRITE IS A LIE -- one writer, two screens.
- FINDINGS w1-5 (compacted; DEC space FULL): A CLAMP INSIDE A PADDED
  ANCESTOR IS NOT THE MEASURE; NO ORDER BY READS AS ALPHABETICAL;
  RE-PROBE THE MANDATE BEFORE SPENDING A LANE; A DECISION DOC IS NOT A
  BRANCH (grep `## Amendment (wave N)` first, implement verbatim); A
  LATCHED ERROR STRING IS A SECOND STATE; SIBLING COUNTS NEED THE SAME
  PREDICATE, AGAIN; THE PAIR REPORTS OUTLIVE THE MANDATE (fidelity-
  gate4/*/report.md STILL-PRESENT+MINOR lists, mine those not the
  mandate's prose); A FRAME NIT CAN CONTRADICT A LANDED DECISION -- grep
  decisions/ first; A FRAME "EXTRA" IS USUALLY A CAPABILITY -- restyle or
  disclose, only the orchestrator deletes capability; A RAIL-GROWING
  SURFACE MUST TAKE THE PAIR MEASURE IN THE SAME CHANGE.
- FINDINGS w6: A COMMENT CLAIMING A CHECK IS NOT THE CHECK -- files.ts:93
  read "writes explicitly refuse reviewers" while authzSubmissionWrite only
  added the speaker edit-lock, so a reviewer could upload and silently
  un-publish a session (DEC-170 wave-54 amendment; only the sibling half
  landed). HALF A DECISION IS THE DANGEROUS HALF. ROTATION IS NOT
  EVICTION: "rotation on login" defends fixation; revoking the user's
  whole fleet breaks two devices and makes SHARED demo personas sign the
  eval agent and a human judge out of each other. A MIRROR MUST COPY THE
  ROLLBACK, not just the ordering (portal form-task uploads copied the
  CFP putThenRecord order, never its R2/file rollback -- every failed
  submit leaks). A LITERAL WHERE A PREDICATE BELONGS IS A SECOND GRAMMAR:
  DeliverableDetail passed reUploaded=false, disagreeing with the
  worklist about the same row. THE MANDATE IS EXHAUSTED, THE PAIR
  REPORTS ARE NOT -- re-probing at file:line closed the scorecard P0,
  admin-blank P1, sign-out footer, z-order BRK, tray trio, ics picker,
  builder Save, headshot library, laggards 500, speakers chip; what
  remains is MINOR lists. A REVIEW LENS CAN BE WRONG ON PURPOSE: the
  demo-credential "leak" is the demo instance's front door (DEC-583
  amendment refuses it) -- record the refusal so it isn't re-filed.
