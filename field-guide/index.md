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
  row cascades on contact delete, only a row losing a document may refuse;
  a grid class shared by two components is a CELL COUNT contract.
- FINDINGS w32-37 (DEC-983..999; 001-999 FULL, no DEC-1000+; successor rule
  `## Amendment (wave N)` on nearest existing DEC, DEC-004 precedent -- never
  a new file): a grep "no matches" is a fact about that minute -- re-probe. A
  predicate applied HALF is worse than none; an exclusion REASON can expire.
  Mandate lists age fast -- MINE THE CODE twice. A DEFERRAL IS A DATED PROMISE.
  A decision can land on ONE PACKAGE and read as done -- ask WHICH PACKAGE. A
  TOKEN declared and consumed by nobody is the same lie as an unused rule.
  TRUST FLOWS ONE WAY: untrusted MORE permissive than trusted is a WRITE defect.
- FINDINGS w38 (amendments only): MANDATE EXHAUSTED after ~20 more re-probed
  items all closed; a REVIEW FINDING IS A HYPOTHESIS WITH A FILE:LINE -- open
  the line. Three defect shapes: (1) a WRITE gated by a READ predicate -- name
  a predicate after the verb it protects; (2) a RESPONSE carrying what the
  request MINTED -- a send reports counts, never bodies; (3) a rule stated in
  a COMMENT instead of a CONSTRAINT is not a contract. A predicate with THREE
  readers must be ONE function (DEC-318 guarded two of three; .ics disagreed).
- FINDINGS w39 (amendments only; `## Amendment (wave 39)` per decisions/README):
  the MANDATE WAS NOT EXHAUSTED -- docs/eval-findings.md was RECOMPACTED the
  same day w38 declared it dead, with a fresh GATE-3 section audited against a
  SNAPSHOT SHA. A mandate is dated TWICE: when written, and against which
  build -- re-read the header, then verify each item against main (~8/10
  GATE-3 reds were still live). w38's own lanes b-f had NOT landed while its
  amendments were already written -- A DECISION DOC IS EVIDENCE OF A DECISION,
  NEVER OF A FIX; read the code. Four defect shapes, "a rule keyed on the
  wrong thing": (1) a contract keyed on a NAME (selector suffix) misses faces
  named otherwise -- key on the ELEMENT the class lands on; (2) a
  var(--chq-x, fallback) whose token is declared NOWHERE is not a deliberate
  default, it is a dead reference wearing the fallback's value silently; (3) a
  PRESET meaning "these filters, default columns" written as `columns: []`
  both clears columns AND makes the derived active tab unmatchable -- an
  empty array is a value, absence is the silence; (4) PLACEMENT resolution and
  DRAWING resolution are two different numbers (15-min drops, 30-min rules) --
  conflating them strikes lines through the card the grid should show. One
  grammar per surface: a gutter/aria-name/toast naming one instant three ways
  is three bugs, not one style.
