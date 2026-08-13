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
  decision with no code a LIE; mandate file a HYPOTHESIS -- tree MOVES WHILE
  YOU PLAN; every page says who's signed in; submitted blank CLEARS, absent
  key is silence; main can be RED -- grep `<<<<<<<` every wave; a gate must
  not render children while identity loads; a per-row count is N scans --
  one grouped query; blank is ABSENT for EVERY kind; a row is a DRAFT until
  Save; a CREATE-time expansion is a snapshot -- BACK-FILL every activation
  path; undefined var(--chq-*) resolves TRANSPARENT; the scrim IS the
  dialog; two roots of one kind are two documents not two versions; a JOIN
  row cascades on contact delete, only a row losing a document may refuse; a
  grid class shared by two components is a CELL COUNT contract.
- FINDINGS w32-37 (DEC-983..999; 001-999 FULL, no DEC-1000+; successor rule
  `## Amendment (wave N)` on nearest existing DEC, DEC-004 precedent -- never
  a new file): a grep "no matches" is a fact about that minute -- re-probe. A
  predicate applied HALF is worse than none; an exclusion REASON can expire.
  Mandate lists age fast -- MINE THE CODE twice. A DEFERRAL IS A DATED PROMISE.
  A decision can land on ONE PACKAGE and read as done -- ask WHICH PACKAGE. A
  TOKEN declared/consumed by nobody is an unused rule. TRUST FLOWS ONE WAY:
  untrusted MORE permissive than trusted is a WRITE defect.
- FINDINGS w38-39 (amendments only): a REVIEW FINDING IS A HYPOTHESIS WITH A
  FILE:LINE -- open it, re-probe (a "MANDATE EXHAUSTED" call on w38 was wrong;
  eval-findings.md got RECOMPACTED same-day with a fresh SNAPSHOT-SHA GATE-3
  section; a mandate is dated TWICE, when written AND against which build).
  A DECISION DOC IS EVIDENCE OF A DECISION, NEVER OF A FIX -- read the code.
  Shapes: WRITE gated by READ predicate; RESPONSE carrying what the request
  MINTED (counts, never bodies); rule in a COMMENT not a CONSTRAINT;
  predicate with THREE readers must be ONE function; contract keyed on a
  NAME misses faces named otherwise -- key on the ELEMENT; var(--x,
  fallback) with token declared NOWHERE is a dead reference; `columns: []`
  as a preset both clears AND makes the tab unmatchable; PLACEMENT vs
  DRAWING resolution differ; one grammar per surface, a gutter/aria-name/
  toast naming one instant three ways is three bugs.
- FINDINGS w40 (amendments only): A REVIEW LENS AGES FASTER THAN A MANDATE --
  all four "live" security findings this wave were ALREADY FIXED on main
  (DEC-996/994/317 amendment/files.ts:546); open the file:line before
  planning a lane, a finding names a minute not a build. Three shapes: (1)
  CLAMP THE BOX CANNOT REACH -- max-width + auto side margins on a flex-
  COLUMN child cancels stretch, box sizes to its text (275px in an 820
  column); one clamp per page, at the ROOT, nested clamp must say
  width:100%. (2) TWO READERS OF ONE DEADLINE -- Math.round on a raw
  day-label vs Math.ceil through owning tz answers 17 and 19 for the same
  date; a countdown is a FORMATTER, not a per-call expression. (3) A SEED IS
  A CLAIM ABOUT THE DEMO -- a window opening TOMORROW darkens the front
  door for every judge arriving today; a header counting "1 re-uploaded"
  over zero rows is the same lie.
