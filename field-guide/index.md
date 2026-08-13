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
  re-probe. A predicate applied HALF is worse than none; a DEFERRAL IS A
  DATED PROMISE; TRUST FLOWS ONE WAY; a DECISION DOC IS EVIDENCE OF A
  DECISION, NEVER OF A FIX. Shapes: WRITE gated by READ predicate; predicate
  with THREE readers is ONE function; one grammar per surface.
- FINDINGS w40-43 (amendments only, compacted): A REVIEW LENS AGES FASTER
  THAN A MANDATE -- across waves, most re-probed P1s/security items were
  ALREADY FIXED/CLOSED on main; open file:line before the lane, tree is the
  only evidence, prod lags main. Shapes: CLAMP THE BOX CANNOT REACH; TWO
  READERS OF ONE DEADLINE disagree; A SEED IS A CLAIM; an ARGUMENT NEVER READ
  is a lie in a signature; a GUARD PLACED AFTER THE COST guards nothing;
  MINTING IS IO -- a write inside a per-recipient loop is a read's defect; A
  CONSTRUCTOR THAT THROWS IS A GUARD BEFORE THE MUTATION IS PAID FOR; a
  boundary fails per RECIPIENT never per REQUEST; ONE RULE SIX REGEXES THREE
  GRAMMARS -- normalize on WRITE; A PREDICATE HONOURED ON FOUR PATHS AND
  SKIPPED ON THE FIFTH is the root of separately-filed 'defects'.
- FINDINGS w44 (amendments only): THE MANDATE IS NOW MOSTLY A CLOSURE LEDGER
  -- ~22 of 25 re-probed gate-3 reds were ALREADY CLOSED on main with guard
  tests (auth flex-start, CFP-builder measure, content structural batch a-h,
  speakers matrix header, inline recusal, locked-plan eyebrow, focus ring,
  RecentSends columns, import alias, agenda click-unschedule, public width
  pairs, seed CFP window, .chq-file width, validateUpload `kind`, submit
  guard ordering, batched portal links on 2 of 3 paths). Budget the PROBE,
  not the fix; open the file:line before you write the lane. Shapes found by
  reading: FONT DOES NOT CROSS A BUTTON -- a class setting size/weight but
  not family renders UA Arial beside Figtree. A NATIVE type=date IS A LOCALE
  YOU DID NOT CHOOSE. THE LAST PATH IS THE DEFECT -- two of three send paths
  batched KV minting, so the third makes the rule's own comment a lie. A
  BOARD WITH ONE POPULATED COLUMN PROVES NOTHING -- an unfalsifiable
  vocabulary looks identical to "not implemented". AN AFFORDANCE ON EVERY ROW
  IS NOT AN AFFORDANCE. A COUNT STATED TWICE IS TWO READERS WAITING TO
  DISAGREE. Also: a finding can be OBSOLETE-VS-DEC not just stale -- check
  the DEC before filing (DEC-735 suggestion suffix, DEC-939 radiogroup).
