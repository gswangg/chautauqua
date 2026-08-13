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
  EVENT's tz; rows graded from ENUMERATION never sample; pagination ONE
  shape+count*+`id asc`; atomic SQL beats read-then-write; hand-listed
  manifests desync -- ENUMERATE/IMPORT; uniqueIndex CONTRACT; negation skips
  NULLs; merge a SET showing EVERY differing field; irreversible action a PAGE
  naming what goes AND what it refuses; publish the WINDOW not a flag;
  decision with no code a LIE; every page says who's signed in; submitted
  blank CLEARS, absent key is silence; main can be RED -- grep `<<<<<<<`
  every wave; a per-row count is N scans (one grouped query); a CREATE-time
  expansion is a snapshot -- BACK-FILL every path; the scrim IS the dialog;
  a JOIN row cascades on contact delete.
- FINDINGS w32-45 (DEC-983..999, 001-999 FULL no DEC-1000+, successor rule
  `## Amendment (wave N)` on nearest existing DEC): grep "no matches" is a
  fact about that minute -- re-probe; A DECISION DOC IS EVIDENCE OF A FIX
  NEVER; WRITE gated by READ predicate; a GUARD AFTER THE COST guards
  nothing; MINTING IS IO; boundary fails per RECIPIENT never REQUEST.
- FINDINGS w46-49: work comes from opening file:line, not the mandate list.
  A CONVENIENCE WRAPPER INVITES THE FOURTH SERIAL LOOP -- delete, don't
  document; SET-BASED TWIN EXISTS AND SINGULAR STILL WINS; BATCHING LANDS
  ON THE READ NOT THE WRITE; PARITY IS NOT USE (doc<->constant only). A
  CHAIN WALK IS A QUERY PER LINK -- batch the FRONTIER. FIND-OR-CREATE
  WITHOUT A UNIQUE INDEX IS A DUPLICATE WAITING; two tasks amending the
  SAME DEC = merge conflict. A UNIQUE INDEX THAT KILLS A FEATURE IS THE
  WRONG FIX -- check what it DELETES first. LANDING PAGE IS THE SLOWEST
  READ -- phase independent queries. "follow up if" IS AN OPEN DEFECT.
  FOURTH WAVE OF SAME FINDING = BUILD THE SCAN (two-directional ledger).
- FINDINGS w50-51: mandate SPENT twice running, ~25+ items re-probed and
  closed by reading file:line. FAILURE MODES NOT SYMMETRIC -- order by
  which corpse is worse. THE OPTIONAL BODY IS WHERE THE GUARD FELL OFF.
  THE UNBOUNDED SURFACE NEVER PAGED -- cap the QUERY not the array. AN
  ENUMERATION IN AN OLD AMENDMENT IS A CHECKLIST THE NEXT MUST WALK
  (partial conversions recur). A BOUNDARY THAT SWALLOWS MUST STILL TELL
  THE READER. TWO READERS OF ONE STORED ID: VALIDATES != ANSWERS. A
  PAYLOAD CARRYING THE ANSWER MUST NOT BE SUMMARISED INTO A SENTENCE.
- FINDINGS w52-53: mandate SPENT for the FOURTH wave running -- ~30+
  named file:line claims re-probed and already closed each time. Work
  comes from the gate-4 blocking set / re-reading files, not the mandate
  list. THE TREE MOVES WHILE YOU PLAN -- re-probe file:line right before
  writing the task. A LEDGER THAT OUTLIVES THE LANE THAT COULD NOT FIX IT
  BECOMES PERMISSION. A DISPLAY-ONLY REASON CODE IS A CLAIM THE WRITER
  MUST HONOUR. AN EMPTY RESULT IS NOT AN EMPTY PROBLEM -- branch on the
  SHORTFALL, never the count. A CLASS INTERPOLATED INTO A CSS STRING IS
  INVISIBLE TO GREP (`.${ACCENT_BOUND_CLASSES[0]}` hid a rule). A FLEX
  PARENT OVERRIDES AN inline-flex CHILD -- default align-items:stretch
  turns a pill into a strip; fix the CONTAINER, never the shared class.
  REMOVING A BAD WIDTH IS NOT ADDING A BOUND. CHECK .git/refs/heads
  BEFORE PLANNING -- a live task-wNN-* loose ref means that lane is in
  flight; re-planning it wastes the whole wave.
