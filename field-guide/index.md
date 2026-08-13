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
  `## Amendment (wave N)` on nearest existing DEC -- never a new file):
  grep "no matches" is a fact about that minute -- re-probe. A predicate
  applied HALF is worse than none; A DECISION DOC IS EVIDENCE OF A DECISION,
  NEVER OF A FIX; A REVIEW LENS AGES FASTER THAN A MANDATE. Shapes: WRITE
  gated by READ predicate; a GUARD PLACED AFTER THE COST guards nothing;
  MINTING IS IO; boundary fails per RECIPIENT never per REQUEST; A TOKEN
  IS A NAME PEOPLE TYPED.
- FINDINGS w46-48 (9+ mandate probes closed, review lens fully spent by
  w48): work comes from opening file:line, not the mandate list. A
  CONVENIENCE WRAPPER INVITES THE FOURTH SERIAL LOOP -- delete, don't
  document; A CAP THAT CONTRADICTS ITS OWN DECISION'S ARITHMETIC; THE
  SET-BASED TWIN EXISTS AND THE SINGULAR STILL WINS (check every caller);
  BATCHING LANDS ON THE READ NOT THE WRITE (recurred w46+w48); PARITY IS
  NOT USE -- decisions-parity guards doc<->constant, not constant<->code.
  A LATER TABLE IS NOT IN THE OLDER MANIFEST -- enumerate schema columns.
  THE CLIENT RE-DECIDED THE KIND -- geometry chooses LAYOUT, never KIND.
  A CHAIN WALK IS A QUERY PER LINK -- batch the FRONTIER. FIND-OR-CREATE
  WITHOUT A UNIQUE INDEX IS A DUPLICATE WAITING. DEC 001-999 IS FULL: two
  tasks amending the SAME DEC is a merge conflict -- distinct DEC per lane.
- FINDINGS w49: MANDATE + REVIEW LENS BOTH SPENT AGAIN -- ~30 probes (mail
  500s, files DELETE authz, archive cap, bulk-email KV batch, CFP conditional
  visibility, public 1180, auth 732/820, seed CFP window, plan weights,
  "closes in 0 days", char counter, merge heads, tertiary focus ring, home
  landmarks) ALL came back CLOSED with guard tests; work came from reading
  files. A UNIQUE INDEX THAT KILLS A FEATURE IS THE WRONG FIX --
  (org,lower(email)) on contact looked like the classic find-or-create race
  until findDuplicateGroups showed reason:"email" is a SHIPPED state and
  blank emails share a bucket; check what a constraint DELETES before adding
  it. THE OWNERSHIP CHECK IS PART OF THE SET OP -- DEC-629 merge is
  set-based but proved ownership 21x singly. THE LANDING PAGE IS THE SLOWEST
  READ -- getOverviewPayload serialises ~20 mutually independent queries;
  phase them (one Promise.all per dependency level). A LOOP OF IO YOU DID
  NOT WRITE IS STILL YOURS -- 50 sequential R2 GETs sat under a carefully
  derived cap. A COMMENT THAT SAYS "follow up if" IS AN OPEN DEFECT
  (sessionboard flushParticipantUpdates). FOURTH WAVE OF THE SAME FINDING =
  BUILD THE SCAN, not the fix: ledgered two-directional manifest (unlisted
  hit fails; stale line fails "delete this line").
