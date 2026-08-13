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
  decision with no code a LIE; every page says who's signed in; submitted
  blank CLEARS, absent key is silence; main can be RED -- grep `<<<<<<<`
  every wave; a per-row count is N scans (one grouped query); a CREATE-time
  expansion is a snapshot -- BACK-FILL every path; the scrim IS the dialog;
  a JOIN row cascades on contact delete.
- FINDINGS w32-45 (DEC-983..999, 001-999 FULL no DEC-1000+, successor rule
  `## Amendment (wave N)` on nearest existing DEC): grep "no matches" is a
  fact about that minute -- re-probe. A DECISION DOC IS EVIDENCE OF A
  DECISION, NEVER OF A FIX; A REVIEW LENS AGES FASTER THAN A MANDATE. WRITE
  gated by READ predicate; a GUARD PLACED AFTER THE COST guards nothing;
  MINTING IS IO; boundary fails per RECIPIENT never REQUEST.
- FINDINGS w46-48: work comes from opening file:line, not the mandate list.
  A CONVENIENCE WRAPPER INVITES THE FOURTH SERIAL LOOP -- delete, don't
  document; SET-BASED TWIN EXISTS AND SINGULAR STILL WINS (check every
  caller); BATCHING LANDS ON THE READ NOT THE WRITE; PARITY IS NOT USE --
  decisions-parity guards doc<->constant, not constant<->code. A LATER
  TABLE IS NOT IN THE OLDER MANIFEST. THE CLIENT RE-DECIDED THE KIND --
  geometry chooses LAYOUT never KIND. A CHAIN WALK IS A QUERY PER LINK --
  batch the FRONTIER. FIND-OR-CREATE WITHOUT A UNIQUE INDEX IS A DUPLICATE
  WAITING. DEC 001-999 FULL: two tasks amending the SAME DEC = merge
  conflict -- distinct DEC per lane.
- FINDINGS w49: MANDATE+LENS SPENT -- work came from reading files. A
  UNIQUE INDEX THAT KILLS A FEATURE IS THE WRONG FIX -- check what a
  constraint DELETES first. OWNERSHIP CHECK IS PART OF THE SET OP. LANDING
  PAGE IS THE SLOWEST READ -- phase independent queries (Promise.all per
  dependency level). A LOOP OF IO YOU DID NOT WRITE IS STILL YOURS. "follow
  up if" IS AN OPEN DEFECT. FOURTH WAVE OF SAME FINDING = BUILD THE SCAN:
  ledgered two-directional manifest (unlisted hit fails; stale line fails).
- FINDINGS w50: mandate SPENT, closed with live tests. FAILURE MODES ARE
  NOT SYMMETRIC -- order by which corpse is worse (orphan blob = garbage;
  row without bytes = data loss). THE OPTIONAL BODY IS WHERE THE GUARD
  FELL OFF -- name the optional case explicitly. THE UNBOUNDED SURFACE IS
  THE ONE THAT NEVER PAGED -- cap the QUERY, never the array. A COMMENT
  NAMING A THROW THE CALLEE NO LONGER PERFORMS LEAVES A DEAD CATCH.
- FINDINGS w51: mandate SPENT for the THIRD wave running -- ~25 more items
  re-probed by opening file:line and all closed. Work came from reading.
  NEW: AN ENUMERATION IN AN OLD AMENDMENT IS A CHECKLIST THE NEXT
  AMENDMENT MUST WALK -- DEC-713 wave-47 listed TWO single-delete sites,
  wave-50 converted one. A BOUNDARY THAT SWALLOWS MUST STILL TELL THE
  READER -- the swallowed send survived as on-screen copy asserting
  delivery. TWO READERS OF ONE STORED ID: the one that VALIDATES is not
  the one that ANSWERS. THE BUDGET LIST IS AS SAMPLED AS THE BUDGET -- SPEC
  §7 named four hot actions, the smoke measured one. A PAYLOAD THAT
  ALREADY CARRIES THE ANSWER MUST NOT BE SUMMARISED INTO A SENTENCE.
