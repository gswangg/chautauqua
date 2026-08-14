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
  a LIE; submitted blank CLEARS, absent key is silence; a JOIN row cascades
  on contact delete.
- FINDINGS w9-72 (DEC-002..999, 001-999 space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC; heavily
  compacted): grep "no matches" is a fact about that minute only;
  DECISION DOC != FIX; MINTING IS IO; boundary fails per RECIPIENT never
  REQUEST; batch the FRONTIER not query-per-link; FIND-OR-CREATE NEEDS A
  UNIQUE INDEX; UNBOUNDED SURFACE NEVER PAGED; A WATERMARK ONLY SEES THE
  COLUMN IT COMPARES; NAV != ROUTE; A DECISION DOC IS NOT A BRANCH -- grep
  decisions/ first, implement verbatim; A FRAME "EXTRA" IS USUALLY A
  CAPABILITY; A MIRROR MUST COPY THE ROLLBACK; A REVIEW LENS CAN BE WRONG
  ON PURPOSE (demo-credential, DEC-583) -- record refusals; A READER WITH
  NO WRITER IS A LIE THAT RENDERS NOTHING; A SECOND READER OF THE SAME
  WRITE INHERITS NONE OF ITS MANNERS -- grep EVERY caller; A GUESSABLE
  URL THAT 404s IS A DEAD END; A PROJECTION MUST CARRY ITS SOURCE'S
  LIMITS/VOCABULARY; A COPY OF A PROP IS A SNAPSHOT NOT A SUBSCRIPTION; A
  CAPTION THAT NAMES A NUMBER MUST COUNT; A PHONE SURFACE THAT REFUSES
  WHAT DESKTOP ALLOWS IS A DIFFERENT PRODUCT NOT A REFLOW (J9); HIDDEN AT
  TOP LEVEL WITH NO OVERRIDE IS A PICTURE THAT NEVER RENDERS (DEC-380/
  385/394/020/825). REFUSALS: aria-pressed (DEC-939), "Mean of submitted
  reviews" (DEC-873), Import-CSV link (DEC-662). Mechanics: lanes land
  MID-PLAN, re-open file:line at edit time; grep -C eats leading `//`;
  DEC-438 closes only on a NAMED EXECUTED TEST. DESKTOP MANDATE IS
  EXHAUSTED BY READING as of w12; new desktop findings need the
  external gate.
- FINDINGS w13 (planned against main with task-w12-a..d STILL UNMERGED —
  their DEC amendments were on main while their code was not). A PLANNED
  WAVE IS NOT A LANDED WAVE: re-open the FILE, never the decision doc.
  Re-probed 12 more mandate clauses (day-pill ?day= DEC-835, embed .ics
  picker, public 1180 pair, CFP Save, GET /logout, CFP conditional
  visibility, home landmarks, bulk-accept cap copy, submit-email limit,
  task-file taskAssignmentId authz) — ALL CLOSED. Desktop stays exhausted
  by reading. New shapes, all found in the mobile tree: A REGION'S
  POSITION IS ITS DOM ORDER, NOT ITS BORDER (.chq-tabbar declared
  border-top and rendered above main); URL STATE ONE WIDTH CANNOT READ IS
  A DEAD LINK (?section= renders only the rail at <=700); A SIBLING
  SURFACE IS A SECOND READER (portal home dropped the description
  /portal/tasks renders); A FORMATTER FAMILY WITH A GAP GETS
  HAND-ASSEMBLED (raw ISO day beside formatDayShort/Long). Mechanics:
  only max-width 700/900 (breakpoint-conformance); overflow-x:hidden
  banned (phone-wrap-conformance); no colour literal in a surface
  stylesheet (DEC-383) — never port a frame's hex or its drop shadow.
  Rulings landed as `## Amendment (wave 13)` on DEC-576/385/200/728/
  777/590/028. Named unbuilt mobile remainder: phone CFP 2-step wizard,
  phone roster screen, Comms/Submissions phone landing parity.
