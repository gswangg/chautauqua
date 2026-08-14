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
- FINDINGS w55-60 (compacted): re-read before reserve; mandate can run out ->
  read repos; sweep every writer of a table a unique index lands on; JS cap
  over unbounded read -> count/slice in SQL; revert mandate is not a revert;
  `.size` is a GROUP BY; no lower bound is a forever loop; short-circuit over
  a KDF is an oracle; config throw on anonymous surface is a 500; a decision
  naming its own consumers is a checklist to WALK; a UI label is a spec; a
  module header listing its own cascade is a checklist (submission-delete
  omitted evaluation/plan_reviewer); the guard is not the cascade; a one-way
  status is a broken loop; when two sibling dedupes both preserve progress,
  the third between them is the bug.
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
- FINDINGS w62: MANDATE SPENT, FIFTH CONFIRMATION — reminder tail, login KDF,
  fireAcceptance-on-re-accept and the anonymous .ics organizer all re-verified
  CLOSED at file:line. THE SANITIZER YOU WROTE FOR ONE SERIALIZER IS OWED TO
  EVERY SERIALIZER: ics.ts strips C0/DEL because public CFP text reaches it —
  the MIME builder and the XML feed builder take the same input and never got
  the rule. A HEADER IS A LINE; A LINE ENDS AT CRLF. AN ATTACHMENT PUSHED INTO
  multipart/alternative REPLACES THE BODY, it does not accompany it. IO YOU
  DON'T CONSUME IS STILL IO — and when minting REVOKES, an unused mint is
  destructive: mint only what the message carries. A CAP ON ONE SIBLING IS A
  MEASUREMENT OF THE OTHERS — three reads on one handler, only one capped.
  A CAP WITH NO ORDER BY IS A NONDETERMINISTIC TRUNCATION. A FUNCTION WHOSE
  ONLY CALLER IS A vi.fn IS DEAD — delete it, don't cap it.
