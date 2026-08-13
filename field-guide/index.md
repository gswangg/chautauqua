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
  not render children while identity loads; a per-row count is N scans -- one
  grouped query; blank is ABSENT for EVERY kind; a row is a DRAFT until Save;
  a CREATE-time expansion is a snapshot -- BACK-FILL every activation path;
  undefined var(--chq-*) resolves TRANSPARENT; the scrim IS the dialog; two
  roots of one kind are two documents not two versions; a JOIN row cascades
  on contact delete, only a row losing a document may refuse; a grid class
  shared by two components is a CELL COUNT contract.
- FINDINGS w32-37 (DEC-983..999; 001-999 FULL, no DEC-1000+; successor rule
  `## Amendment (wave N)` on nearest existing DEC, DEC-004 precedent -- never
  a new file): grep "no matches" is a fact about that minute -- re-probe. A
  predicate applied HALF is worse than none; an exclusion REASON can expire.
  Mandate lists age fast -- MINE THE CODE twice. A DEFERRAL IS A DATED PROMISE.
  ONE PACKAGE can land and read as done -- ask WHICH PACKAGE; an unconsumed
  TOKEN is an unused rule; TRUST FLOWS ONE WAY.
- FINDINGS w38-39 (amendments only): a REVIEW FINDING IS A HYPOTHESIS WITH A
  FILE:LINE -- open it, re-probe. A DECISION DOC IS EVIDENCE OF A DECISION,
  NEVER OF A FIX -- read the code. Shapes: WRITE gated by READ predicate;
  RESPONSE carrying what the request MINTED (counts never bodies); rule in a
  COMMENT not a CONSTRAINT; predicate with THREE readers must be ONE function;
  contract keyed on NAME misses faces named otherwise -- key on ELEMENT; one
  grammar per surface -- gutter/aria-name/toast naming one instant 3 ways.
- FINDINGS w40 (amendments only): A REVIEW LENS AGES FASTER THAN A MANDATE --
  4/4 "live" security findings were ALREADY FIXED on main; open file:line
  before planning a lane. (1) CLAMP THE BOX CANNOT REACH -- max-width + auto
  margins on a flex-COLUMN child cancels stretch; one clamp per page at the
  ROOT, nested clamp needs width:100%. (2) TWO READERS OF ONE DEADLINE --
  Math.round vs Math.ceil through owning tz disagree; countdown is a
  FORMATTER not a per-call expression. (3) A SEED IS A CLAIM: a window opening
  TOMORROW darkens the front door for a judge arriving today.
- FINDINGS w41 (amendments only): FULL BLEED BY ABSENCE, NOT ESCAPE -- a chrome
  band inside a measured page bleeds by declaring NO max-width/side-margin
  (precedent .chq-review-editor-title-row); 100vw math overshoots because
  .chq-main scrolls INTERNALLY. Shapes: a STATUS stated in one box while the
  actions that change it sit in another is one instant named twice; a COLUMN
  duplicating the filter above it is chrome (kind chip vs KIND column); a
  two-view surface reached by a link is a DESTINATION not a tablist; a rule
  that STATES its method ("averaged by weight") without showing its work
  reads as a bug -- print the reconciliation; enumerate-vs-sample has a READ
  face: iterating the ANSWERS map hides every unanswered question -- enumerate
  the FORM. Re-probe paid again: 12/~20 P1s were already fixed on main and all
  six security lens items were closed -- open the file before the lane.
