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
  every wave; a per-row count is N scans; the scrim IS the dialog; a JOIN
  row cascades on contact delete.
- FINDINGS w32-49 (DEC-983..999, 001-999 FULL no DEC-1000+, `## Amendment
  (wave N)` on nearest existing DEC): re-probe, grep "no matches" is a fact
  about that minute only. A DECISION DOC IS EVIDENCE OF A FIX NEVER; WRITE
  gated by READ predicate; a GUARD AFTER THE COST guards nothing; MINTING
  IS IO; boundary fails per RECIPIENT never REQUEST. Work comes from opening
  file:line, not the mandate list. A CONVENIENCE WRAPPER INVITES THE FOURTH
  SERIAL LOOP -- delete, don't document; SET-BASED TWIN EXISTS AND SINGULAR
  STILL WINS; BATCHING LANDS ON THE READ NOT THE WRITE; PARITY IS NOT USE.
  A CHAIN WALK IS A QUERY PER LINK -- batch the FRONTIER. FIND-OR-CREATE
  WITHOUT A UNIQUE INDEX IS A DUPLICATE WAITING. A UNIQUE INDEX THAT KILLS
  A FEATURE IS THE WRONG FIX -- check what it DELETES first. LANDING PAGE
  IS THE SLOWEST READ. FOURTH WAVE OF SAME FINDING = BUILD THE SCAN.
- FINDINGS w50-54: FAILURE MODES NOT SYMMETRIC -- order by which corpse is
  worse. THE OPTIONAL BODY IS WHERE THE GUARD FELL OFF. THE UNBOUNDED
  SURFACE NEVER PAGED -- cap the QUERY not the array. TWO READERS OF ONE
  STORED ID: VALIDATES != ANSWERS. THE TREE MOVES WHILE YOU PLAN -- re-probe
  file:line before writing the task. AN EMPTY RESULT IS NOT AN EMPTY
  PROBLEM -- branch on the SHORTFALL. A FLEX PARENT OVERRIDES AN inline-flex
  CHILD -- fix the CONTAINER. A live task-wNN-* loose ref is NOT proof of
  in-flight (w53's four all LANDED) -- verify by opening the fix's own
  line. A MIGRATION THAT CANNOT RUN IS A SCHEMA THAT DOESN'T EXIST:
  node:sqlite/better-sqlite3 accept CREATE TEMP TABLE, D1's authorizer
  rejects it (SQLITE_AUTH) -- scan the DIALECT, not just semantics. THE
  TEST COVERS THE SHAPE THAT ISN'T SHIPPED. A COMMENT CLAIMING A CHECK IS
  NOT A CHECK.
- FINDINGS w55: THE PLANNER'S FIRST READ CAN BE STALE -- re-read before you
  reserve; .git/logs/HEAD shows which lanes MERGED (w54: only `a`, b-f were
  live branches with zero commits mid-plan). The review-lens list is a
  HYPOTHESIS not a finding: both w55 hand-offs were already closed
  upstream. Work comes from opening file:line, not any list. THE WRITE
  RESPONSE IS A SECOND READER -- a list mapper that resolves names is a
  lie if the POST feeding it returns raw ids ("(removed)" for a live
  row). A CONSTRAINT ONE LEVEL DOWN IS STILL MISSING -- fixing
  task(event_id,title) left form(event_id,title) racing the same way. A
  DRAG-ONLY MUTATION IS AN INACCESSIBLE ONE: if placing has a click path,
  removing must too. A CAPABILITY DENIED IN A COMMENT still needs a
  signpost.
