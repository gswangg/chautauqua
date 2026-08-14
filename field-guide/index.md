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
  about that minute only. DECISION DOC != FIX; MINTING IS IO; boundary fails
  per RECIPIENT never REQUEST. CONVENIENCE WRAPPER INVITES 4TH SERIAL LOOP.
  CHAIN WALK IS QUERY-PER-LINK -- batch the FRONTIER. FIND-OR-CREATE
  WITHOUT UNIQUE INDEX IS A DUPLICATE WAITING. LANDING PAGE IS SLOWEST READ.
- FINDINGS w50-54: FAILURE MODES NOT SYMMETRIC. OPTIONAL BODY IS WHERE THE
  GUARD FELL OFF. UNBOUNDED SURFACE NEVER PAGED -- cap the QUERY not the
  array. TWO READERS OF ONE STORED ID: VALIDATES != ANSWERS. TREE MOVES
  WHILE YOU PLAN -- re-probe file:line before writing task. EMPTY RESULT !=
  EMPTY PROBLEM -- branch on SHORTFALL. MIGRATION THAT CAN'T RUN IS A
  SCHEMA THAT DOESN'T EXIST (D1 rejects CREATE TEMP TABLE). TEST COVERS
  SHAPE THAT ISN'T SHIPPED. COMMENT CLAIMING A CHECK IS NOT A CHECK.
- FINDINGS w55-56: PLANNER'S FIRST READ CAN BE STALE -- re-read before
  reserve; .git/logs/HEAD shows which lanes MERGED. The hand-off LIST IS A
  HYPOTHESIS not a finding -- work comes from opening file:line. THE MANDATE
  CAN RUN OUT: once the list is spent, work comes from READING REPOS. WRITE
  RESPONSE IS A SECOND READER -- a list mapper lying if POST returns raw
  ids. A CONSTRAINT ONE LEVEL DOWN IS STILL MISSING -- sweep every writer of
  a table the wave a unique index lands on it. DRAG-ONLY MUTATION IS
  INACCESSIBLE -- click path required too. CAPABILITY DENIED IN A COMMENT
  still needs a signpost. A JS CAP OVER AN UNBOUNDED READ: a population you
  only COUNT/SLICE must be counted/sliced in SQL; the FRONTIER (which ids)
  is a query not a filter. OPTIONAL `page` ARG IS AN UNBOUNDED BRANCH --
  delete when only caller pages.
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
