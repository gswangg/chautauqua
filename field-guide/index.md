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
  WITHOUT A UNIQUE INDEX IS A DUPLICATE WAITING. A UNIQUE INDEX THAT KILLS
  A FEATURE IS THE WRONG FIX -- check what it DELETES first. LANDING PAGE
  IS THE SLOWEST READ -- phase independent queries. FOURTH WAVE OF SAME
  FINDING = BUILD THE SCAN (two-directional ledger).
- FINDINGS w50-51: FAILURE MODES NOT SYMMETRIC -- order by which corpse is
  worse. THE OPTIONAL BODY IS WHERE THE GUARD FELL OFF. THE UNBOUNDED
  SURFACE NEVER PAGED -- cap the QUERY not the array. AN ENUMERATION IN AN
  OLD AMENDMENT IS A CHECKLIST THE NEXT MUST WALK. TWO READERS OF ONE
  STORED ID: VALIDATES != ANSWERS.
- FINDINGS w52-53: THE TREE MOVES WHILE YOU PLAN -- re-probe file:line
  right before writing the task. A LEDGER THAT OUTLIVES THE LANE THAT
  COULD NOT FIX IT BECOMES PERMISSION. AN EMPTY RESULT IS NOT AN EMPTY
  PROBLEM -- branch on the SHORTFALL, never the count. A FLEX PARENT
  OVERRIDES AN inline-flex CHILD -- fix the CONTAINER, never the shared
  class. CHECK .git/refs/heads BEFORE PLANNING -- a live task-wNN-* loose
  ref MAY mean that lane is in flight, but VERIFY.
- FINDINGS w54: a live task-wNN-* loose ref is NOT proof a lane is in
  flight -- w53's four all LANDED; verify by opening the fix's own line
  before reserving files. A MIGRATION THAT CANNOT RUN IS A SCHEMA THAT
  DOESN'T EXIST: node:sqlite/better-sqlite3 accept CREATE TEMP TABLE, D1's
  authorizer rejects it (SQLITE_AUTH), so a green migration test hid a
  missing UNIQUE index and 500'd the core accept path for six waves --
  scan the DIALECT, not just the semantics. THE TEST COVERS THE SHAPE
  THAT ISN'T SHIPPED (conditional-visibility tests use a <select>; the
  CFP now ships radio cards, and querySelector on a radio GROUP always
  reads option one). A COMMENT CLAIMING A CHECK IS NOT A CHECK
  (safeReferrerPath "same-origin only" never compares hosts). Mandate
  spent a FIFTH wave: 5 of 6 named claims already closed. Work comes from
  opening file:line.
