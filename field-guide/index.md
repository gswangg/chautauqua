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
- FINDINGS w55-63 (compacted): re-read before reserve; mandate can run out ->
  read repos; sweep every writer of a table a unique index lands on; JS cap
  over unbounded read -> count/slice in SQL; a decision naming its own
  consumers is a checklist to WALK; a module header listing its own cascade
  is a checklist -- the guard is not the cascade; MANDATE SPENT repeatedly,
  re-probed CLOSED at file:line each wave -- read the code, not eval-
  findings; sibling counts need the SAME predicate; a dry run must model
  its own collapse; no ORDER BY is nondeterministic; A COUNT FROM
  `visibleRows` IS A COUNT OF THE PAGE; A WATERMARK ONLY SEES THE COLUMN IT
  COMPARES -- PARENT ROW IS THE SYNC UNIT.
- FINDINGS w64: THE HANDOFF IS THE MANDATE NOW -- eval-findings re-probed
  CLOSED a seventh time (all live at file:line). The open work was in
  docs/design/ read as a CHECKLIST: public agenda desktop still the
  room-lane MATRIX the handoff replaced, filter bar still the PILL ROW the
  handoff killed. A PARAM THE ROUTE PASSES AND THE PAGE HIDES IS A FEATURE
  NOBODY CAN REACH. A LIST FILTERS, A SCHEDULE HIGHLIGHTS. A WATERMARK
  BOUNDS THE PARENT SCAN ONLY. WHEN THE DEC SPACE IS FULL, PICK THE
  DECISION THE CODE ACTUALLY CITES and amend that one -- one DEC file per
  lane, checked against the in-flight wave's set first.
- FINDINGS w65: MANDATE SPENT AN EIGHTH TIME (re-probed CLOSED at file:line).
  Open work came from two VENDORED PACKS read as checklists and one HALF-
  LANDED STACK. A PACK THAT ARRIVES MID-WAVE IS NOT SELF-APPLYING -- the
  REVIEW PACK landed w62 and its two desktop P1s (queue row anatomy, two-
  column scorecard) sat unbuilt through w63/64 because nobody re-read it.
  A DEC THAT NAMES A MEASUREMENT NAMES THE FRAME IT WAS MEASURED FROM:
  DEC-874's "full-width button" and DEC-939's "clamps to --chq-measure"
  were both PHONE frames promoted to rules -- when a desktop frame finally
  arrives, amend the DEC, don't fight the frame. A FIX CAN CARRY ITS OWN
  BUG: pre-arming focusedId for number keys re-created the "one criterion
  styled unlike its siblings" defect DEC-939 killed -- arm the ROUTING,
  gate the INK. THE WAY IN IS PART OF THE FEATURE: breaks shipped schema +
  repo + API + mount + docs and zero UI, so the seed is the only writer --
  grep app/ for the noun before calling a stack landed. NAV MEMBERSHIP IS
  NOT ROUTE MEMBERSHIP: /gallery keeps its URL/feeds/embed row while
  leaving the nav; derive the nav list by FILTERING the route list.
