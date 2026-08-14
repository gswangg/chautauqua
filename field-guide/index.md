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
- FINDINGS w32-63 (DEC-983..999, 001-999 FULL no DEC-1000+, `## Amendment
  (wave N)` on nearest existing DEC, heavily compacted): re-probe, grep "no
  matches" is a fact about that minute only. DECISION DOC != FIX; MINTING IS
  IO; boundary fails per RECIPIENT never REQUEST; batch the FRONTIER not
  query-per-link; FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE
  NEVER PAGED -- cap the QUERY not the array; TREE MOVES WHILE YOU PLAN;
  COMMENT CLAIMING A CHECK IS NOT ONE; a module-header naming its own
  consumers is a CHECKLIST TO WALK; sibling counts need the SAME predicate;
  no ORDER BY is nondeterministic; A WATERMARK ONLY SEES THE COLUMN IT
  COMPARES -- PARENT ROW IS THE SYNC UNIT; WHEN THE DEC SPACE IS FULL, amend
  the DECISION THE CODE ACTUALLY CITES; NAV MEMBERSHIP IS NOT ROUTE
  MEMBERSHIP -- derive nav by FILTERING routes.
- FINDINGS w66-71 (compacted): MANDATE SPENT repeatedly, re-probed CLOSED at
  file:line each round; work comes from READING A LANDED STACK'S CONSUMERS one
  wave downstream; A BOUNDARY IS ONLY AS WIDE AS ITS REASON; A FACET IS A
  CONTRACT (knob in every reader at once); A CONTROL WITHOUT ITS SCRIPT/SAVE
  IS A PICTURE OR A LIE; WALK THE LIFECYCLE, NOT THE ROUTE; A PROJECTION MUST
  CARRY ITS SOURCE'S LIMITS AND VOCABULARY; A DAY LABEL IS NOT AN INSTANT; A
  NOW-DERIVED PAGE CANNOT JOIN A PURGE-KEYED CACHE; A HARDCODED SURFACE LIST
  GOES STALE -- pair with a COUNT assertion; A COMMENT EXPLAINING AN ABSENCE
  IS THE ABSENCE'S ONLY GUARD; classify by the MOST PUBLIC-REACHING WRITE;
  IMMUTABLE MAY DESCRIBE BYTES, NEVER AN AUTHORIZATION OUTCOME; ONE
  SERIALIZER FOLDS, SWEEP EVERY SIBLING; WAVE N-1 MAY STILL BE IN FLIGHT --
  check .git/logs/HEAD for `merge task-w<N-1>-*` before re-planning; TWO
  SUBSYSTEMS READING THE SAME TABLE FOR OPPOSITE PURPOSES IS THE BUG -- sweep
  every consumer of a fact; A CAPTION FUNCTION RETURNING NULL FOR AN UNKNOWN
  KIND IS A SILENT SURFACE; A PAIR TUPLE IS A CARDINALITY ASSUMPTION -- widen
  to a list; A COVERAGE TEST IS ONLY AS WIDE AS THE SUB-APPS IT MOUNTS.
- FINDINGS w72: WAVE N-1 STILL IN FLIGHT AGAIN — w70 had landed (4 merges + a
  merge-train repair) and TWO fresh mandate commits arrived AFTER w71 was
  planned; read `.git/logs/HEAD` past the last `scribe wave N` for mandate
  commits too, not just merges. A PER-INSTANCE Z-FIX IS A CLASS BUG DEFERRED:
  DEC-900 raised the clash card, then the placed card, then a break band
  reintroduced the same strike-through — name the TIER as a token and pin the
  z-index DECLARATION COUNT so a new overlay must be classified. BLEED BY
  ABSENCE ONLY REACHES THE PARENT'S CONTENT BOX — across a PADDED ancestor,
  cancel that padding through the SAME token, never vw/cqw. A DISCLOSURE IS
  NOT A DELETION: an unframed editor on a canvas moves behind the shared
  ModalFrame with its props byte-identical, so the in-flight lane editing that
  panel never conflicts. A PROJECTION DROPS THE HALF NOBODY ASKED FOR: the
  queue computed `format` over EVERY scoped id and threw the recused half
  away — check what a batched lookup's second consumer never received. A
  FRAMED PRIMARY WITH NOTHING TO WRITE IS THE OTHER LIE: give it the page's
  real editable fact and keep validation server-side, one writer, two screens.
