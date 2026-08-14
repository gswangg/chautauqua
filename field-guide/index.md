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
  COLUMN IT COMPARES -- PARENT ROW IS THE SYNC UNIT; NAV MEMBERSHIP IS NOT
  ROUTE MEMBERSHIP.
- FINDINGS w66-72 (compacted): MANDATE SPENT re-probed CLOSED at file:line;
  A FACET IS A CONTRACT; A CONTROL WITHOUT ITS SCRIPT/SAVE IS A PICTURE OR
  A LIE; A PROJECTION MUST CARRY ITS SOURCE'S LIMITS AND VOCABULARY; A DAY
  LABEL IS NOT AN INSTANT; A HARDCODED SURFACE LIST GOES STALE; ONE
  SERIALIZER FOLDS, SWEEP EVERY SIBLING; TWO SUBSYSTEMS READING THE SAME
  TABLE FOR OPPOSITE PURPOSES IS THE BUG; A DISCLOSURE IS NOT A DELETION;
  A FRAMED PRIMARY WITH NOTHING TO WRITE IS A LIE -- one writer, two
  screens.
- FINDINGS w1-4 (compacted; DEC space FULL): A CLAMP INSIDE A PADDED
  ANCESTOR IS NOT THE MEASURE; disable a 400-only control, name the
  blocking token; NO ORDER BY READS AS ALPHABETICAL; RE-PROBE THE
  MANDATE BEFORE SPENDING A LANE (a mandate clause is a hypothesis,
  gate-4 reds were measured on one commit and later waves close many
  silently); A DECISION DOC IS NOT A BRANCH -- read decisions/ before
  re-deciding, implement verbatim (grep `## Amendment (wave N)` first);
  A LATCHED ERROR STRING IS A SECOND STATE; A PAGE-LEVEL KEY HANDLER
  MUST ASK WHO HAS FOCUS; SIBLING COUNTS NEED THE SAME PREDICATE,
  AGAIN; THE PAIR REPORTS OUTLIVE THE MANDATE (fidelity-gate4/*/
  report.md STILL-PRESENT + MINOR lists); A FRAME NIT CAN CONTRADICT A
  LANDED DECISION -- grep decisions/ before filing a frame observation
  as work; A CONTROL ON EVERY CARD IS A LAYOUT DECISION; A PRIVATE COPY
  OF A TRANSFORM IS A SECOND GRAMMAR waiting to be measured.
- FINDINGS w5: A SURFACE THAT GROWS A RAIL MUST TAKE THE PAIR
  MEASURE IN THE SAME CHANGE -- w1-d rebuilt /schedule to the frame's
  list+rail while w1-a moved only its two twins to 820/60/300, so a
  300px rail now sits inside an 820 column. TWO TASKS IN ONE WAVE CAN
  SPLIT A CONTRACT: re-read the shared token, not just your own file.
  THE MANDATE IS MOSTLY CLOSED -- of the gate-4 P1s re-probed this
  wave, the public 1180 pair, select carets, day switcher, /sessions
  chronological order, session gutter, template measure, one History
  reader, bulk-template picker, match-columns screen, results 4-row
  preview, auth box-math and the 404 rhythm ALL landed in waves 1-3;
  mine the PAIR REPORTS' STILL-PRESENT lists, not the mandate's prose.
  A FRAME "EXTRA" IS USUALLY A CAPABILITY: Reset password, Delete plan,
  SESSION DETAILS -- restyle to the section-rule vocabulary or collapse
  behind a disclosure; only the orchestrator deletes capability.
