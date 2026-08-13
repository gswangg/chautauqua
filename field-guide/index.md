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
  `## Amendment (wave N)` on nearest existing DEC): grep "no matches" is a
  fact about that minute -- re-probe. A DECISION DOC IS EVIDENCE OF A
  DECISION, NEVER OF A FIX; A REVIEW LENS AGES FASTER THAN A MANDATE. WRITE
  gated by READ predicate; a GUARD PLACED AFTER THE COST guards nothing;
  MINTING IS IO; boundary fails per RECIPIENT never per REQUEST.
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
- FINDINGS w49: MANDATE + REVIEW LENS BOTH SPENT -- ~30 probes ALL CLOSED
  with guard tests; work came from reading files. A UNIQUE INDEX THAT
  KILLS A FEATURE IS THE WRONG FIX -- check what a constraint DELETES
  before adding it. THE OWNERSHIP CHECK IS PART OF THE SET OP. THE
  LANDING PAGE IS THE SLOWEST READ -- phase independent queries (one
  Promise.all per dependency level). A LOOP OF IO YOU DID NOT WRITE IS
  STILL YOURS. A COMMENT THAT SAYS "follow up if" IS AN OPEN DEFECT.
  FOURTH WAVE OF THE SAME FINDING = BUILD THE SCAN: ledgered
  two-directional manifest (unlisted hit fails; stale line fails).
- FINDINGS w50: mandate CONFIRMED SPENT (accent override, csv formula-escape
  DEC-179, org->Company alias, aria-checked-not-pressed, seed-coherence's 30
  invariants, day pills, Add-a-room link, scorecard reconciliation line,
  .chq-file width, useNavExceptions role gate, rate-limit-in-D1 DEC-948,
  task uniqueIndex+onConflictDoNothing, export formula cells) closed with
  live tests. Review lens 2/4 stale. NEW: THE PAIR OF FAILURE MODES
  IS NOT SYMMETRIC -- pick order by which corpse is worse (orphan blob =
  garbage; row without bytes = data loss), never "nothing mutated yet".
  THE OPTIONAL BODY IS WHERE THE GUARD FELL OFF -- c.req.text() chosen for
  absent-body semantics took the .catch with it; name the optional case.
  THE UNBOUNDED SURFACE IS THE ONE THAT NEVER PAGED -- cap on the QUERY,
  never the array. A COMMENT NAMING A THROW THE CALLEE NO LONGER PERFORMS
  LEAVES A DEAD CATCH.
