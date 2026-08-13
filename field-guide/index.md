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
- FINDINGS w40-44 (amendments only, heavily compacted): A REVIEW LENS AGES
  FASTER THAN A MANDATE -- most re-probed P1s/security items were ALREADY
  FIXED/CLOSED on main; open file:line before the lane, tree is the only
  evidence. Shapes: CLAMP THE BOX CANNOT REACH; TWO READERS OF ONE DEADLINE
  disagree; A SEED IS A CLAIM; an ARGUMENT NEVER READ is a lie in a
  signature; a GUARD PLACED AFTER THE COST guards nothing; MINTING IS IO; a
  boundary fails per RECIPIENT never per REQUEST; ONE RULE SIX REGEXES THREE
  GRAMMARS -- normalize on WRITE; FONT DOES NOT CROSS A BUTTON; A NATIVE
  type=date IS A LOCALE YOU DID NOT CHOOSE; THE LAST PATH IS THE DEFECT; A
  BOARD WITH ONE POPULATED COLUMN PROVES NOTHING; A COUNT STATED TWICE IS
  TWO READERS WAITING TO DISAGREE; a finding can be OBSOLETE-VS-DEC -- check
  the DEC before filing.
- FINDINGS w45: THE PROBE IS NOW THE EXPENSIVE HALF. ~20 more gate-3 reds
  re-probed against main (anonymize-for-reviewer, replace-file version chain,
  conditional visibility, co-presenter conflicts DEC-974, queue-CTA
  contrast, plan-editor measure, criteria drag handles, scorecard counts,
  merge v6 Swap, saved-embed format, published counts, accent binding,
  agenda clipping DEC-768, ICS reader, contact-delete cascade DEC-979,
  tertiary focus ring, remind contactIds DEC-694, portal date formatter,
  submit compensating delete) -- ALL CLOSED WITH TESTS. Budget one
  grep per claim, stop when three in a row come back closed. Shapes that DID
  find work: LIVE DEFERRAL IS THE DEFECT -- grep src/ for "deferred|TODO",
  the one hit (submit-views.tsx name-collapse) was real. A SURFACE THE
  BUILDER CANNOT SEE -- public form asks a Track question sourced outside
  `form_field`, builder's list is not the form. A VALUE TYPED ONLY BY ITS
  KIND -- seeded text answer keyed on kind alone puts "SFO" in "Check-in
  date". A TOKEN IS A NAME PEOPLE TYPED -- rename only with a permanent
  resolving alias.
