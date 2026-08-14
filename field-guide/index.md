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
- FINDINGS w32-54 (DEC-983..999, 001-999 FULL no DEC-1000+, `## Amendment
  (wave N)` on nearest existing DEC): re-probe, grep "no matches" is a fact
  about that minute only. DECISION DOC != FIX; MINTING IS IO; boundary fails
  per RECIPIENT never REQUEST. CHAIN WALK IS QUERY-PER-LINK -- batch the
  FRONTIER. FIND-OR-CREATE WITHOUT UNIQUE INDEX IS A DUPLICATE WAITING.
  FAILURE MODES NOT SYMMETRIC. OPTIONAL BODY IS WHERE THE GUARD FELL OFF.
  UNBOUNDED SURFACE NEVER PAGED -- cap the QUERY not the array. TREE MOVES
  WHILE YOU PLAN. MIGRATION THAT CAN'T RUN IS A SCHEMA THAT DOESN'T EXIST
  (D1 rejects CREATE TEMP TABLE). COMMENT CLAIMING A CHECK IS NOT A CHECK.
- FINDINGS w55-58: PLANNER'S FIRST READ CAN BE STALE -- re-read before
  reserve. MANDATE CAN RUN OUT -> READ REPOS. A CONSTRAINT ONE LEVEL DOWN IS
  STILL MISSING -- sweep every writer of a table a unique index lands on. A
  JS CAP OVER AN UNBOUNDED READ: count/slice in SQL. A REVERT MANDATE IS NOT
  A REVERT -- open the file. THE COUNT YOU ONLY `.size` IS A GROUP BY. NO
  LOWER BOUND IS A FOREVER LOOP. A SHORT-CIRCUIT OVER A KDF IS AN ORACLE. A
  CONFIG THROW ON AN ANONYMOUS SURFACE IS A 500.
- FINDINGS w59-60: THE MANDATE IS SPENT, CONFIRMED TWICE — gate-3/eval items
  re-verified CLOSED at file:line. Work now comes only from READING. A
  DECISION THAT NAMES ITS OWN CONSUMERS IS A CHECKLIST — WALK IT: DEC-829's
  chase alone skipped acceptedSpeakerConditions. A UI LABEL IS A SPEC.
  A CANONICAL TASK MUST WRITE WHERE ITS NAME POINTS. A MODULE HEADER THAT
  LISTS ITS OWN CASCADE IS A CHECKLIST — submission-delete's prose omitted
  evaluation and plan_reviewer. THE GUARD IS NOT THE CASCADE. A ONE-WAY
  STATUS IS A BROKEN LOOP. WHEN TWO SIBLING DEDUPES BOTH PRESERVE PROGRESS,
  THE THIRD ONE BETWEEN THEM IS THE BUG. RE-READ BEFORE RESERVING.
- FINDINGS w61: THE MANDATE IS SPENT, FOURTH CONFIRMATION — ten more
  eval-findings items re-probed CLOSED at file:line. THREE SIBLING COUNTS ON
  ONE HEADER, TWO CARRY THE PREDICATE: "N accepted · M tasks open · K overdue"
  — only M had no roster/chase clause, so a declined speaker inflates it
  forever. A COUNT'S POPULATION IS PART OF ITS COPY. THE MIRROR OF A CHASE FIX
  IS A PORTAL FIX: w59 stopped emailing declined speakers; their portal still
  listed the tasks. "SENT" IS A STATUS, NOT A ROW COUNT — a `since` filter with
  no `status` prints failures as sends. A PARAMETER PARSED AND NOT PASSED IS A
  WRONG ANSWER WITH A CONFIDENT ENVELOPE (groupBy=batch dropped four). A DRY RUN
  THAT DOESN'T MODEL ITS OWN COLLAPSE LIES IN ADVANCE. A RULE PRIVATE TO ONE
  MODULE CANNOT BE APPLIED BY THE NEXT — the `err.cause` walk was fixed for
  tasks in w48 and still missing in segments, turning a promised 400 into a 500.
  A NUDGE WITH NO LINK IS NOT A NUDGE.
