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
- FINDINGS w1-6 (heavily compacted; DEC space FULL): RE-PROBE THE MANDATE
  BEFORE SPENDING A LANE; A DECISION DOC IS NOT A BRANCH (grep `##
  Amendment (wave N)` first, implement verbatim); THE PAIR REPORTS OUTLIVE
  THE MANDATE (fidelity-gate4/*/report.md STILL-PRESENT+MINOR lists); A
  FRAME NIT CAN CONTRADICT A LANDED DECISION -- grep decisions/ first; A
  FRAME "EXTRA" IS USUALLY A CAPABILITY -- restyle/disclose, never delete;
  A COMMENT CLAIMING A CHECK IS NOT THE CHECK -- HALF A DECISION IS THE
  DANGEROUS HALF; ROTATION IS NOT EVICTION; A MIRROR MUST COPY THE
  ROLLBACK not just the ordering; A REVIEW LENS CAN BE WRONG ON PURPOSE
  (demo-credential "leak" is the demo's front door, DEC-583) -- record
  refusals so they aren't re-filed.
- FINDINGS w7: THE MANDATE IS A DIGEST, NOT A LEDGER -- re-probing ~30
  residue clauses at file:line found most CLOSED; six survived. A READER
  WITH NO WRITER IS A LIE THAT RENDERS NOTHING: `audienceLevel`
  (ReviewerQueue+Scorecard) and `submissionsThisYear/lastSpokeYear`
  (speaker rail) both had readers and comments confessing the gap -- grep
  `unwired|no server route|when the wire|documented gap`. A STALE EXCUSE
  OUTLIVES ITS CAUSE: reviewer.ts:244 said "no reserved field id yet"
  while AUDIENCE_LEVEL_FIELD_ID had shipped and the public form already
  used it. ONE FORMATTER, TWO GRAMMARS: formatEventDay vs formatDayLong,
  ten public call sites on the wrong one -- fix the SHARED WRAPPER's body.
  A CHROME LABEL CAN BE ROLE-SCOPED: organizer "Jordan A.", reviewer "Sam
  Whitfield", one identityLabel served both wrong. REFUSALS RECORDED:
  aria-pressed on rating segments (DEC-939, radio group is correct ARIA);
  "Mean of submitted reviews" caption (DEC-873, our blend is weighted, the
  frame's copy would be false); roster Import-CSV link (DEC-662, kept).
  DEC space is closed -- new rulings land as `## Amendment (wave N)`
  appended to the EXISTING file at that id, never an overwrite.
