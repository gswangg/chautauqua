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
  manifests desync -- enumerate in a test; conditional visibility is a
  FIXED POINT; hand-copied vocabularies drift -- IMPORT them; a
  uniqueIndex is a CONTRACT; a `position` column nobody sets is dead --
  assign max+1 INSIDE the insert; a negated predicate skips NULLs.
- FINDINGS w1-9 (DEC-570..654, compacted): full suites SERIALIZED; real
  <button> not `div draggable`; colour alone isn't track identity -- NAME
  it; blank CSV cell is ABSENT DATA; seed has ONE clock; imported row
  keeps THEIR id via namespaced `external_ref`; a drawer is a RECORD;
  two readings END in one resolver; anonymity is a RATCHET; merge takes
  a SET; confirmation is a DIALOG not window.confirm; a filter after the
  page window lies -- items+total from ONE where clause; /api/v1 gets
  the envelope, a human a page; framing/cache/API-ref lists are CLOSED
  two-lists; a join row's identity is the PAIR its uniqueIndex names;
  absence claims are TESTABLE; state hidden behind a disclosure toggle
  should be a visible tab, ACTIVE from live filters; export = same WHERE
  as the list; raw id in UI is a handle leaking, render LABELS; a
  worklist row carries its action; a scale bar exits non-zero.
- FINDINGS w10-11 (DEC-655..669, compacted): a scope check that skips
  the plan's own filter grants what the queue hides -- every reader of
  "in scope?" ends in ONE rule. A guard whose comment names routes it
  doesn't guard is a manifest already desynced: enumerate the repo.
  Cacheability is a DEFAULT (no-store) plus "own header wins". A subset
  vocabulary encodes a server fact -- test it EQUALS those keys. A
  surface with no root is not guessable; a dead control on an empty cell
  should be CONDITIONAL. An import is PLANNED before applied: the dry
  run names REPLACEs and same-name-same-company collisions. Every send
  ends in ONE reporter accounting for sent+failed+skipped+remaining. A
  surface never asserts an unmeasured count. An internal shorthand is
  not public prose -- data stays null, only rendering gets a word. A
  union makes items AND total lie: a second scope is a second TAB.
- FINDINGS w12 (DEC-670..674): a capped ANONYMOUS list may only count
  what it shows -- a total computed outside the visibility predicate
  discloses the rows the predicate hid; report the cap as a fact, not a
  mismatched pair of numbers. Export = same where clause: not per-
  surface, EVERY filtered list's download inherits it. A chromeless
  surface is CLOSED both ways -- every link it renders stays inside it,
  every path it renders has a route; prove it by rendering each page and
  enumerating hrefs, never by inspection. A builder's option list is the
  server's vocabulary IMPORTED through one named boundary module, pinned
  by an equality test; a knob asking for an internal id is not a knob. A
  worklist whose other regions live one navigation away is a report.
