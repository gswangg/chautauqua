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
  (wave N)` on nearest existing DEC, compacted): re-probe, grep "no matches"
  is a fact about that minute only. DECISION DOC != FIX; MINTING IS IO;
  boundary fails per RECIPIENT never REQUEST; CHAIN WALK IS QUERY-PER-LINK --
  batch the FRONTIER; FIND-OR-CREATE WITHOUT UNIQUE INDEX IS A DUPLICATE
  WAITING; FAILURE MODES NOT SYMMETRIC; OPTIONAL BODY IS WHERE THE GUARD FELL
  OFF; UNBOUNDED SURFACE NEVER PAGED -- cap the QUERY not the array; TREE
  MOVES WHILE YOU PLAN; MIGRATION THAT CAN'T RUN IS A SCHEMA THAT DOESN'T
  EXIST; COMMENT CLAIMING A CHECK IS NOT ONE.
- FINDINGS w55-60 (compacted): re-read before reserve; mandate can run out ->
  read repos; sweep every writer of a table a unique index lands on; JS cap
  over unbounded read -> count/slice in SQL; revert mandate is not a revert;
  `.size` is a GROUP BY; no lower bound is a forever loop; short-circuit over
  a KDF is an oracle; config throw on anonymous surface is a 500; a decision
  naming its own consumers is a checklist to WALK; a UI label is a spec; a
  module header listing its own cascade is a checklist -- the guard is not
  the cascade; a one-way status is a broken loop; two sibling dedupes that
  both preserve progress make the third between them the bug.
- FINDINGS w61-62 (compacted): MANDATE SPENT repeatedly -- stop re-reading
  eval-findings, read the code. Sibling counts on one header need the SAME
  predicate; a count's population is part of its copy; a chase fix needs a
  portal mirror; "sent" is a status not a row count; a parsed-not-passed
  param is a confident wrong answer; a dry run must model its own collapse;
  a rule private to one module isn't owed to the next; a nudge with no link
  isn't one; a sanitizer for one serializer is owed to every serializer; a
  header is a line ending at CRLF; an attachment in multipart/alternative
  REPLACES the body; IO you don't consume is still IO; a cap on one sibling
  measures the others, no ORDER BY is nondeterministic; a fn whose only
  caller is vi.fn is dead.
- FINDINGS w63: MANDATE SPENT, SIXTH CONFIRMATION -- run-3 P0s and gate-3
  P1s all re-probed CLOSED at file:line; stop re-reading eval-findings for
  code work and read the code. A REFUSAL LIST IS DATED THE DAY IT WAS
  WRITTEN -- deleteTrack's blockers predate saved embeds; the newest FK
  consumer is the one the guard never heard of. A COUNT FROM `visibleRows`
  IS A COUNT OF THE PAGE -- server pagination turns a client tally into an
  understatement, worst in an irreversible dialog. "NEVER A NEW ENDPOINT" !=
  "NEVER A QUERY PER ROW" -- one grouped aggregate is neither. AUTH IS A TAX
  ON EVERY ROUTE: two sequential SELECTs are subtracted from every screen's
  50ms budget; the write nobody reads (last_used_at) was awaited inline
  under a comment promising it wasn't. A DESIGN HANDOFF SENTENCE CAN BE A
  MISSING TABLE -- breaks had no schema, route, or render. A WATERMARK ONLY
  SEES THE COLUMN IT COMPARES: participant writes bump participant.updated_at,
  so the Airtable push never re-sends a submission whose speakers changed --
  EXISTS can't rescue a DELETE. THE PARENT ROW IS THE SYNC UNIT; STAMP OWED BY ITS CHILDREN'S WRITERS.
