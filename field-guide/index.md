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
  over unbounded read -> count/slice in SQL; `.size` is a GROUP BY; no lower
  bound is a forever loop; short-circuit over a KDF is an oracle; a decision
  naming its own consumers is a checklist to WALK; a module header listing
  its own cascade is a checklist -- the guard is not the cascade; two
  sibling dedupes that both preserve progress make the third between them
  the bug.
- FINDINGS w61-63 (compacted): MANDATE SPENT repeatedly, re-probed CLOSED at
  file:line each wave -- read the code, not eval-findings. Sibling counts
  need the SAME predicate; "sent" is a status not a row count; a dry run
  must model its own collapse; an attachment in multipart/alternative
  REPLACES the body; no ORDER BY is nondeterministic. A REFUSAL LIST IS
  DATED THE DAY IT WAS WRITTEN. A COUNT FROM `visibleRows` IS A COUNT OF
  THE PAGE. AUTH IS A TAX ON EVERY ROUTE. A DESIGN HANDOFF SENTENCE CAN BE
  A MISSING TABLE. A WATERMARK ONLY SEES THE COLUMN IT COMPARES --
  participant writes bump participant.updated_at, so Airtable never re-
  sends a submission whose speakers changed; PARENT ROW IS THE SYNC UNIT.
- FINDINGS w64: THE HANDOFF IS THE MANDATE NOW -- eval-findings re-probed
  CLOSED a seventh time (reminder tail, login KDF oracle, re-accept
  fireAcceptance, ics organizer, MIME, portal-link minting, review caps,
  distribute anatomy, /admin 404, seed dates, home hub, participation menu,
  filter rules: all live at file:line). The open work was in docs/design/
  read as a CHECKLIST: the public agenda desktop is still the room-lane
  MATRIX the handoff replaced, the filter bar is still the PILL ROW the
  handoff killed, /speakers has no facet at all. A PARAM THE ROUTE PASSES
  AND THE PAGE HIDES IS A FEATURE NOBODY CAN REACH -- sessions ?day=
  filters in SQL under a comment saying it filters nothing. A LIST FILTERS,
  A SCHEDULE HIGHLIGHTS. A WATERMARK BOUNDS THE PARENT SCAN ONLY: airtable's
  child reads stayed org-wide, so the cap that protects the first FULL push
  condemns every INCREMENTAL one. WHEN THE DEC SPACE IS FULL, PICK THE
  DECISION THE CODE ACTUALLY CITES and amend that one -- one DEC file per
  lane, checked against the in-flight wave's set first.
