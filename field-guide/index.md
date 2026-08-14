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
- FINDINGS w32-49 (DEC-983..999, 001-999 FULL no DEC-1000+, `## Amendment
  (wave N)` on nearest existing DEC): re-probe, grep "no matches" is a fact
  about that minute only. DECISION DOC != FIX; MINTING IS IO; boundary fails
  per RECIPIENT never REQUEST. CHAIN WALK IS QUERY-PER-LINK -- batch the
  FRONTIER. FIND-OR-CREATE WITHOUT UNIQUE INDEX IS A DUPLICATE WAITING.
- FINDINGS w50-54: FAILURE MODES NOT SYMMETRIC. OPTIONAL BODY IS WHERE THE
  GUARD FELL OFF. UNBOUNDED SURFACE NEVER PAGED -- cap the QUERY not the
  array. TREE MOVES WHILE YOU PLAN -- re-probe file:line before writing
  task. MIGRATION THAT CAN'T RUN IS A SCHEMA THAT DOESN'T EXIST (D1 rejects
  CREATE TEMP TABLE). COMMENT CLAIMING A CHECK IS NOT A CHECK.
- FINDINGS w55-56: PLANNER'S FIRST READ CAN BE STALE -- re-read before
  reserve; hand-off LIST IS A HYPOTHESIS. MANDATE CAN RUN OUT -> READ REPOS.
  A CONSTRAINT ONE LEVEL DOWN IS STILL MISSING -- sweep every writer of a
  table a unique index lands on. A JS CAP OVER AN UNBOUNDED READ: count/slice
  in SQL, the FRONTIER is a query not a filter.
- FINDINGS w57: A REVERT MANDATE IS NOT A REVERT -- DEC-996's mailer swap
  was still live three waves later; open the file, don't trust merges. A
  DECISION WITH NO CODE HIDES IN THE ORPHAN LIST (DEC-725). THE COUNT YOU
  ONLY `.size` IS A GROUP BY. THE SECOND SCAN IS THE ONE NOBODY CAPS. WHEN
  TWO SIBLING QUERIES DIFFER, THE YOUNGER ONE IS RIGHT.
- FINDINGS w58: A MANDATE OUTLIVES ITS FACTS — six gate-3/run-3 items
  re-opened at file:line were ALL already CLOSED; findings come from reading
  repos. NO LOWER BOUND IS A FOREVER LOOP. A SHORT-CIRCUIT OVER A KDF IS AN
  ORACLE. ONE FLAG DOING TWO JOBS: `accepted_at IS NULL` as both "stamp" and
  "run the planner" loses members added while un-accepted. A CONFIG THROW ON
  AN ANONYMOUS SURFACE IS A 500: an OPTIONAL field must degrade.
- FINDINGS w59: THE MANDATE IS SPENT, CONFIRMED TWICE — nine more gate-3/eval
  items re-verified CLOSED at file:line this wave (.chq-file max-width:100%,
  Scorecard ring-not-armed-on-mount, aria-pressed refused by DEC-939, distribute
  cap/summary line, criteria drag handles, DateField (zero native type=date),
  agenda 30-min rules, public ?day= links, seed open_date in the past). Work now
  comes only from READING. A DECISION THAT NAMES ITS OWN CONSUMERS IS A
  CHECKLIST — WALK IT: DEC-829's prose lists "assignment / chase / public-visible"
  readers; every one composed acceptedSpeakerConditions EXCEPT the chase
  (reminders.ts listOutstandingForEvent + listRemindableContactIds), so a speaker
  who declined is emailed forever while the overdue count correctly says 0.
  A UI LABEL IS A SPEC: "Session title for this batch" (singular) sat over a loop
  minting one identical accepted session PER ROW. A CANONICAL TASK MUST BE ABLE
  TO WRITE WHERE ITS NAME POINTS: "Finalize bio + headshot" was a file_request
  over FILE_KINDS = presentation|poster|handout|recording — the headshot it asks
  for has no way to reach contact.headshot_url, so the cell goes green and the
  public programme stays blank.
