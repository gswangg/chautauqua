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
  reserve; hand-off LIST IS A HYPOTHESIS. MANDATE CAN RUN OUT -> READ REPOS.
  A CONSTRAINT ONE LEVEL DOWN IS STILL MISSING -- sweep every writer of a
  table a unique index lands on. A JS CAP OVER AN UNBOUNDED READ: count/slice
  in SQL, the FRONTIER is a query not a filter. A REVERT MANDATE IS NOT A
  REVERT -- open the file, don't trust merges. THE COUNT YOU ONLY `.size` IS
  A GROUP BY. NO LOWER BOUND IS A FOREVER LOOP. A SHORT-CIRCUIT OVER A KDF
  IS AN ORACLE. ONE FLAG DOING TWO JOBS loses state added mid-flag. A CONFIG
  THROW ON AN ANONYMOUS SURFACE IS A 500 -- an OPTIONAL field must degrade.
- FINDINGS w59: THE MANDATE IS SPENT, CONFIRMED TWICE — nine gate-3/eval
  items re-verified CLOSED at file:line. Work now comes only from READING.
  A DECISION THAT NAMES ITS OWN CONSUMERS IS A CHECKLIST — WALK IT: DEC-829
  listed "assignment/chase/public-visible" readers; the chase alone skipped
  acceptedSpeakerConditions, so a declined speaker is emailed forever while
  the overdue count says 0. A UI LABEL IS A SPEC: "title for this batch"
  (singular) sat over a loop minting one session PER ROW. A CANONICAL TASK
  MUST WRITE WHERE ITS NAME POINTS: "Finalize bio + headshot" had no path to
  contact.headshot_url, so the cell goes green and the programme stays blank.
- FINDINGS w60: A MODULE HEADER THAT LISTS ITS OWN CASCADE IS A CHECKLIST —
  submission-delete's prose named 8 tables and quietly omitted evaluation and
  plan_reviewer. THE GUARD IS NOT THE CASCADE: refusing SUBMITTED evaluations
  is not deleting the DRAFT ones. A ONE-WAY STATUS IS A BROKEN LOOP — nothing
  writes content_status on upload, so approve/ask-for-changes never reopens
  and DEC-881's "2 re-uploaded + 3 not reviewed = 5" can be false. WHEN TWO
  SIBLING DEDUPES BOTH PRESERVE PROGRESS, THE THIRD ONE BETWEEN THEM IS THE
  BUG (merge kept 'complete' and merged pipeline stage, then dropped an
  accepted invite). A RECONCILE THAT READS THE WHOLE SET TO USE A SUBSET is
  the hot path's cost. AND: RE-READ BEFORE RESERVING — a planned task
  ("back-fill every event task on activation") was already DEC-932, live at
  status.ts:261; the amendment doc existed AND the code did.
