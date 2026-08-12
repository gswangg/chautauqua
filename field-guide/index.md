# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1 (DEC-002..365, COMPLETE): pure-core src/{auth,domain,forms,
  mail,lib} import nothing node:/cf; 012/013 route files export Hono
  sub-apps, errors {error:{code,message,fields?}}; bulk ops set-based.
- REDESIGN w1-10 (DEC-366..419, FUNCTION FROZEN): tokens frozen, ONE
  dialog contract, phone @700px; D1 binds PRIMITIVES (epoch-ms NUMBER);
  dates via event-time.ts OWNING EVENT's tz never toISOString.
- STAGE1-CLOSE w11-38 (DEC-420..569, compacted): ledger names its sha; ONE
  email rule via findAccountUserId; universal rows graded from ENUMERATION
  never sample; pagination ONE shape+count*+`id asc`; a cap the UI can't
  see LIES, render `total`; atomic SQL beats read-then-write; hand-listed
  manifests desync -- enumerate; conditional visibility is a FIXED
  POINT; hand-copied vocabularies drift -- IMPORT them; a uniqueIndex is
  a CONTRACT; a `position` column nobody sets is dead; negation skips NULLs.
- FINDINGS w1-9 (DEC-570..654, compacted): full suites SERIALIZED; real
  <button> not `div draggable`; colour alone isn't track identity -- NAME
  it; blank CSV cell is ABSENT DATA; seed has ONE clock; imported row
  keeps THEIR id via namespaced `external_ref`; a drawer is a RECORD;
  two readings END in one resolver; anonymity is a RATCHET; merge takes
  a SET; confirmation is a DIALOG not window.confirm; items+total from
  ONE where clause; a join row's identity is the PAIR its uniqueIndex
  names; disclosure toggles hiding state should be a visible tab; raw
  id leaks -- render LABELS; a worklist row carries its action.
- FINDINGS w10-11 (DEC-655..669, compacted): a scope check that skips
  the plan's own filter grants what the queue hides -- every reader of
  "in scope?" ends in ONE rule. A guard whose comment names routes it
  doesn't guard is a manifest already desynced: enumerate the repo.
  Cacheability is a DEFAULT (no-store) plus "own header wins". A subset
  vocabulary encodes a server fact -- test it EQUALS those keys. An
  import is PLANNED before applied: the dry run names REPLACEs and
  collisions. Every send ends in ONE reporter (sent+failed+skipped+
  remaining). A union makes items AND total lie: a second scope is a
  second TAB.
- FINDINGS w12 (DEC-670..674, compacted): a capped ANONYMOUS list may
  only count what it shows, never the hidden rows; export = same where
  clause everywhere; a chromeless surface is CLOSED both ways, proved
  by rendering + enumerating hrefs; a builder's option list is the
  server's vocabulary IMPORTED through one named boundary module; a
  worklist whose regions live one navigation away is a report.
- FINDINGS w13 (DEC-675..680): an IMPORT is not exempt from closed
  vocabularies -- validate status/role/order in the PLANNER so the dry
  run names the row+value; an imported participant is RECORDED
  (visible=false), never published -- the importer is not exempt from
  the organizer's own visibility gate. A rule the server enforces and
  the UI never states is a trap: a frozen criteria list renders LOCKED
  with its reason+count; a relative weight renders its computed share.
  ONE reporter means the only one -- a surface typing away `failed[]`
  to print its own "Sent N" is a second reporter; scan-lock it. A
  loading indicator is DELAYED (~250ms); an empty state never renders
  mid-load. A manifest saying "Enumerated from ..." has desynced --
  derive coverage from the route table, walk DETAIL pages too. A
  `total` that is `rows.length` after a materialized scan is the read
  the page window exists to avoid -- count(*), one where clause.
