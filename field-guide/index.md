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
  not render children while identity loads; a per-row count is N scans (one
  grouped query); blank is ABSENT for EVERY kind; a row is a DRAFT til Save;
  a CREATE-time expansion is a snapshot -- BACK-FILL every activation path;
  undefined var(--chq-*) resolves TRANSPARENT; the scrim IS the dialog; two
  roots of one kind are two documents not versions; a JOIN row cascades on
  contact delete; a grid class shared by two components is a CELL COUNT.
- FINDINGS w32-39 (DEC-983..999; 001-999 FULL, no DEC-1000+; successor rule
  `## Amendment (wave N)` on nearest existing DEC, DEC-004 precedent -- never
  a new file; compacted): grep "no matches" is a fact about that minute --
  re-probe. A predicate applied HALF is worse than none; an exclusion REASON
  can expire; a DEFERRAL IS A DATED PROMISE; an unconsumed TOKEN is an unused
  rule; TRUST FLOWS ONE WAY. A REVIEW FINDING IS A HYPOTHESIS WITH A FILE:LINE;
  a DECISION DOC IS EVIDENCE OF A DECISION, NEVER OF A FIX. Shapes: WRITE
  gated by READ predicate; RESPONSE carrying what the request MINTED; rule in
  a COMMENT not a CONSTRAINT; predicate with THREE readers is ONE function;
  contract keyed on NAME misses faces named otherwise; one grammar/surface.
- FINDINGS w40-41 (amendments only, compacted): A REVIEW LENS AGES FASTER
  THAN A MANDATE -- 4/4 "live" security (w40) and 12/~20 P1s + all six
  security items (w41) were ALREADY FIXED on main; open file:line first.
  CLAMP THE BOX CANNOT REACH -- max-width+auto margins on a flex-COLUMN
  child cancels stretch; one clamp per page at ROOT, nested needs
  width:100%. TWO READERS OF ONE DEADLINE disagree -- countdown is a
  FORMATTER not a per-call expression. A SEED IS A CLAIM: a window opening
  TOMORROW darkens the front door for a judge today. FULL BLEED BY ABSENCE
  not escape (.chq-main scrolls INTERNALLY, 100vw overshoots). Shapes: a
  STATUS in one box while its actions sit elsewhere is named twice; a COLUMN
  duplicating the filter above it is chrome; a link-reached two-view surface
  is a DESTINATION not tablist; a rule STATING its method without showing
  its work is a bug; enumerate the FORM, not the answers map.
- FINDINGS w42 (amendments only): A MANDATE LIST IS A LAGGING INDEX -- re-probing
  ~15 gate-3 P1s today found the public 1180 pair, the search row, List/Grid,
  auth 732/820, the ONE 404 card, the CFP seed window, the 30-min agenda
  lattice, the CFP builder clamp, template measure, import synonyms, the merge
  rebuild and the ICS single-reader ALREADY on main. Open the file before the
  lane; the tree is the only evidence. Shapes: an ARGUMENT THAT IS NEVER READ is
  a lie in a signature (validateUpload takes `kind`, dispatches on extension); a
  GUARD PLACED AFTER THE COST guards nothing (CSRF checked after the body is
  materialized); MINTING IS IO -- a write inside a per-recipient loop is the same
  defect as a read; a DEFAULT THE GATE REFUSES needs a set-based writer or the
  surface stays empty at scale; a FRAME DRAWN AT TEN ROWS never authorizes
  deleting a pager, and its words never authorize a false claim about the math.
