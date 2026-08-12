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
- FINDINGS w1-6 (DEC-570..630, compacted): full suites SERIALIZED; real
  <button> not `div draggable`; colour alone isn't track identity -- NAME
  it; blank CSV cell is ABSENT DATA; SSR phone layout is SECOND markup
  via display:none; seed has ONE clock -- SEED_NOW; a file id in a URL
  proves nothing -- walk to root; imported row keeps THEIR id, one
  namespaced `external_ref` per scope; a drawer is a RECORD: facts,
  history, action bar; two readings END in one resolver; anonymity is a
  RATCHET; merge takes a SET.
- FINDINGS w7-9 (DEC-631..654, compacted): confirmation is a DIALOG not
  window.confirm; a row showing a decision must CARRY it; a filter after
  the page window lies -- items+total from ONE where clause; /api/v1
  gets the envelope, a human a page; framing/cache/API-ref lists are
  CLOSED two-lists, enumerated not hand-maintained, closed both
  directions; a join row's identity is the PAIR its uniqueIndex names;
  an imported speaker carries the DEC-258 snapshot or renders nameless;
  absence claims are TESTABLE; a type floor misses what should be
  higher; scale is a profile at both ends; a disclosure you OPEN to
  learn which view you're in is state hidden -- tabs visible, ACTIVE
  from live filters; export = same WHERE as the list; raw id in UI is a
  handle leaking, render LABELS; a dialog is title+Close+primary FIRST+
  mock placeholder, scanned not remembered; a worklist row carries the
  action itself; duplicate upload vocabularies -- delete mirror, import
  core; a scale bar is a timed check exiting non-zero.
- FINDINGS w10 (DEC-655..661): a scope check that skips the plan's own
  filter grants what the queue hides and the results discard -- every
  reader of "in scope?" ends in ONE rule, and a row that could never be
  scored is refused at WRITE time. A speaker adding a speaker must pass
  the same gate an organizer's invite does; the asymmetry IS the defect
  -- record it, publish it on the organizer's existing toggle. A guard
  whose comment names the routes it does not guard is a manifest that
  already desynced: enumerate the repo. Cacheability is a DEFAULT
  (no-store) plus "a handler that sets its own header wins" -- a prefix
  list needs re-auditing every time a route lands, a default never does.
  A scope row carries its own LABEL from the server, batched per page;
  a ULID in the DOM is a handle leaking. A subset vocabulary encodes a
  server fact (which vars that path supplies) -- declare it in pure core
  and test it EQUALS those keys, or the UI offers a control whose only
  outcome is a rejection. A surface with no root is not guessable.
