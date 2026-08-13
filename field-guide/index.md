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
  key is silence; main can be RED -- grep `<<<<<<<` every wave; a per-row
  count is N scans (one grouped query); a CREATE-time expansion is a
  snapshot -- BACK-FILL every activation path; the scrim IS the dialog; a
  JOIN row cascades on contact delete.
- FINDINGS w32-45 (DEC-983..999, 001-999 FULL no DEC-1000+, successor rule
  `## Amendment (wave N)` on nearest existing DEC -- never a new file; all
  heavily compacted): grep "no matches" is a fact about that minute --
  re-probe. A predicate applied HALF is worse than none; A DECISION DOC IS
  EVIDENCE OF A DECISION, NEVER OF A FIX; A REVIEW LENS AGES FASTER THAN A
  MANDATE. Shapes: WRITE gated by READ predicate; A SEED IS A CLAIM; a
  GUARD PLACED AFTER THE COST guards nothing; MINTING IS IO; boundary fails
  per RECIPIENT never per REQUEST; THE LAST PATH IS THE DEFECT; A COUNT
  STATED TWICE IS TWO READERS DISAGREEING; A TOKEN IS A NAME PEOPLE TYPED.
- FINDINGS w46-47: MANDATE LIST SPENT -- work came from opening file:line
  on engineering claims. A CONVENIENCE WRAPPER INVITES THE FOURTH SERIAL
  LOOP -- delete, don't document; A CAP THAT CONTRADICTS ITS OWN DECISION'S
  ARITHMETIC -- derive from named inputs, measure once; THE SET-BASED TWIN
  EXISTS AND THE SINGULAR STILL WINS (check every caller, not just one);
  BATCHING LANDS ON THE READ NOT THE WRITE -- check both halves; THE
  PLATFORM ALREADY HAS THE BATCH API; PARITY IS NOT USE -- decisions-parity
  guards doc<->constant, nothing guards constant<->code.
- FINDINGS w48: REVIEW LENS FULLY SPENT (9 more mandate/engineering probes
  closed) -- real work came from opening files, third wave running. A LATER
  TABLE IS NOT IN THE OLDER MANIFEST -- contact_duplicate_dismissal (DEC-770,
  migration 0022) is in neither the merge repoint nor the delete cascade;
  enumerate schema columns, never extend a hand list. THE CLIENT RE-DECIDED
  THE KIND -- agenda's merged clash card captions from its OWN overlap
  geometry, disagreeing with the server's conflict count; geometry chooses
  LAYOUT, never KIND. A CHAIN WALK IS A QUERY PER LINK -- batch the FRONTIER
  (one query per DEPTH across all seeds). FIND-OR-CREATE WITHOUT A UNIQUE
  INDEX IS A DUPLICATE WAITING (DEC-809/migration 0031 is the shape).
  BATCHING LANDED ON THE READ, AGAIN -- wave 46 batched the KV reads, left
  the per-recipient D1 stamp inside the send loop. DEC 001-999 IS FULL: two
  tasks amending the SAME DEC is a merge conflict -- distinct DEC per lane.
