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
- FINDINGS w32-45 (DEC-983..999, 001-999 FULL no DEC-1000+, successor rule
  `## Amendment (wave N)` on nearest existing DEC -- never a new file; all
  heavily compacted): grep "no matches" is a fact about that minute --
  re-probe. A predicate applied HALF is worse than none; A DEFERRAL IS A
  DATED PROMISE; TRUST FLOWS ONE WAY; A DECISION DOC IS EVIDENCE OF A
  DECISION, NEVER OF A FIX; A REVIEW LENS AGES FASTER THAN A MANDATE -- open
  file:line before the lane, stop probing after three closed in a row.
  Shapes: WRITE gated by READ predicate; CLAMP THE BOX CANNOT REACH; A SEED
  IS A CLAIM; a GUARD PLACED AFTER THE COST guards nothing; MINTING IS IO;
  boundary fails per RECIPIENT never per REQUEST; normalize regex on WRITE;
  FONT DOES NOT CROSS A BUTTON; A NATIVE type=date IS A LOCALE YOU DID NOT
  CHOOSE; THE LAST PATH IS THE DEFECT; A COUNT STATED TWICE IS TWO READERS
  DISAGREEING; a finding can be OBSOLETE-VS-DEC; A TOKEN IS A NAME PEOPLE
  TYPED -- rename only with a permanent resolving alias.
- FINDINGS w46: THE MANDATE LIST IS SPENT -- real work came from opening
  file:line on ENGINEERING claims instead. Shapes: A CONVENIENCE WRAPPER
  INVITES THE FOURTH SERIAL LOOP -- batching landed on 4 of 5 fan-outs
  because the singular API stayed callable, delete don't document; A
  SAMPLE ONE-PER-FILE IS NOT AN ENUMERATION; THE LEAST REVERSIBLE ACTION IS
  THE LEAST GUARDED; A CAP THAT CONTRADICTS ITS OWN DECISION'S ARITHMETIC
  -- derive the number from named inputs and MEASURE it once; A LINE
  NUMBER IS A CURSOR THAT MOVES; A CLASS WITH ONE MEMBER IS A CLAIM THE
  HARNESS CANNOT SUPPORT.
- FINDINGS w47: MANDATE SPENT, CONFIRMED TWICE -- 10 more gate-3/review-lens
  claims re-probed came back CLOSED WITH TESTS; a gate report names a
  SNAPSHOT, four waves of merges have passed it -- work came from opening
  files. Shapes: THE SET-BASED TWIN EXISTS AND THE SINGULAR STILL WINS
  (DEC-924's addReviewers shipped; distribute still loops the singular);
  BATCHING LANDED ON THE READ NOT THE WRITE (import dedupe pre-pass
  chunked, commit loop one stmt/row -- check both halves); A CAP NOBODY CAN
  REACH (2000 rows x 3 stmts vs ~1000-subrequest ceiling); THE PLATFORM
  ALREADY HAS THE BATCH API -- R2 delete takes an ARRAY, the abstraction
  manufactured the loop; AN AMENDMENT THAT ADDS COPY MUST DELETE THE COPY
  IT SUPERSEDES; PARITY IS NOT USE -- decisions-parity guards
  doc<->constant, nothing guarded constant<->code.
