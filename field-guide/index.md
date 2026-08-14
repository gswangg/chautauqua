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
  reserve; .git/logs/HEAD shows which lanes MERGED. The hand-off LIST IS A
  HYPOTHESIS not a finding. THE MANDATE CAN RUN OUT: once spent, work comes
  from READING REPOS. A CONSTRAINT ONE LEVEL DOWN IS STILL MISSING -- sweep
  every writer of a table the wave a unique index lands on it. A JS CAP
  OVER AN UNBOUNDED READ: a population you only COUNT/SLICE must be
  counted/sliced in SQL; the FRONTIER is a query not a filter.
- FINDINGS w57: A REVERT MANDATE IS NOT A REVERT -- DEC-996's mailer swap
  was still live three waves after the P0 said revert (resend.ts present, no
  send_email binding, RESEND_API_KEY in env.ts); mandate and scribe commits
  are not merges, open the file. A DECISION WITH NO CODE HIDES IN THE ORPHAN
  LIST: DEC-725 (Airtable incremental + backoff) was recorded, never built --
  but the ratchet's 765 "UNVERIFIED" entries are mostly missing-`void`
  convention noise, so a recent DEC is only an orphan once you READ its
  module. THE COUNT YOU ONLY `.size` IS A GROUP BY -- review progress/remind
  read every reviewer-submission pair of a round to print one integer per
  reviewer. THE SECOND SCAN IS THE ONE NOBODY CAPS: the plan-filtered load
  bounded nothing and hydrated tracks with a whole-event join. WHEN TWO
  SIBLING QUERIES DIFFER, THE YOUNGER ONE IS RIGHT -- airtable's speakers
  join is order-stable "so automations don't re-fire", its tracks join is
  not.
- FINDINGS w58: A MANDATE OUTLIVES ITS FACTS — six more gate-3/run-3 items
  re-opened at file:line (CFP conditional logic w54-e data-field-id,
  plan-editor dirty guard DEC-745, reviewer shell 403 DEC-395,
  "(removed)" labels DEC-659, contact-create 409, conflict pair labelling)
  were ALL already CLOSED; findings come from reading repos. NO LOWER BOUND
  IS A FOREVER LOOP: a due-date gate with no tail and no terminal state
  re-sends until the heat death of the event. A SHORT-CIRCUIT OVER A KDF IS
  AN ORACLE — constant-time inside the compare is worthless if the caller
  decides whether to call it. ONE FLAG DOING TWO JOBS: `accepted_at IS NULL`
  as both "stamp the timestamp" and "run the planner" silently loses every
  member added while un-accepted — split the trigger from the record. A
  CONFIG THROW ON AN ANONYMOUS SURFACE IS A 500: an OPTIONAL field
  (ICS ORGANIZER) must degrade; only the path that needs it may fail loudly.
